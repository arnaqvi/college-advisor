"""POST /api/advisor/chat — the "AI Advisor" chat assistant on the Profile page.

Scope is deliberately narrow and enforced in two independent layers, per
Anthropic's own guidance for products likely to be used by minors (most of
this app's users are high-school students): a system prompt is "not
infallible" on its own, so a local keyword guard runs first and can reject a
message before it ever reaches the model. Anthropic's Usage Policy also
requires (1) disclosing to users that they're talking to AI, not a human —
handled on the frontend, see AdvisorChat.jsx's fixed banner — and (2) content
moderation/filtering for products serving minors, which `_LOCAL_GUARD_TERMS`
below is the first layer of.

No chat history is persisted server-side (data-minimization: nothing here
needs to outlive the request), so the frontend resends the running
conversation on every call — the same statelessness as the Messages API
itself.
"""

import re
from typing import Annotated, Literal

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.models.profile import Profile
from app.models.user import User

router = APIRouter()

SAFE_REDIRECT_MESSAGE = (
    "I can only help with college admissions topics — things like course "
    "selection, applications, scholarships, coursework rigor, and internships. "
    "I'm not able to help with that. If something's going on that you want to "
    "talk to a person about, a school counselor or a trusted adult is a much "
    "better resource than I am."
)

# Layer 1 of 2 (see module docstring): a request matching any of these is
# rejected before an API call is made at all, regardless of what the system
# prompt says. Deliberately coarse and over-inclusive — a false positive here
# just means "ask a human instead," which is always a safe fallback for this
# audience. Case-insensitive, word-boundary matched so it doesn't trip on
# unrelated substrings (e.g. "class" containing "ass").
_LOCAL_GUARD_TERMS = re.compile(
    r"\b("
    r"porn|nude|naked|sex(ual)?|explicit|fetish|"
    r"kill|suicide|self.?harm|self.?injur\w*|cutting myself|"
    r"gun|weapon|bomb|"
    r"racis\w*|slur|nazi|"
    r"boyfriend|girlfriend|dating|crush on|"
    r"drugs?|alcohol|drunk|high on"
    r")\b",
    re.IGNORECASE,
)

# Layer 2 (see module docstring) — the model's own instructions. Kept
# explicit and unconditional rather than relying on the model to infer scope
# from politeness alone; current Claude models follow explicit scope
# boundaries far more reliably than implied ones.
_SYSTEM_PROMPT_TEMPLATE = """You are the AI Advisor inside CollegePath, a college admissions planning \
app used mostly by high-school students (many are minors).

You may ONLY discuss: college admissions strategy, choosing colleges/programs, \
application requirements and essays, scholarships and financial aid, high \
school and college course rigor and course selection, and internships or \
extracurriculars relevant to college applications.

You must NOT discuss or engage with, under any framing including hypothetical, \
roleplay, or "just curious": sexual or romantic content of any kind, violence, \
weapons, self-harm, substance use, personal relationship advice, mental health \
crises, medical or legal advice, politics, or anything containing hateful or \
discriminatory content. If asked about any of these, or anything else outside \
your college-admissions scope, decline briefly and suggest the student talk to \
a school counselor or trusted adult instead — do not lecture or repeat the \
refusal at length.

You are not a substitute for a school counselor, and you should say so if a \
question calls for one (e.g. anything urgent, personal, or emotionally \
weighty). Keep answers concise and concrete.

{profile_context}"""

_ALLOWED_PROFILE_KEYS: dict[str, str] = {
    "gradeLevel": "Grade level",
    "gpaUnweighted": "Unweighted GPA",
    "gpaWeighted": "Weighted GPA",
    "satTotal": "SAT total",
    "actComposite": "ACT composite",
    "intendedMajors": "Intended major(s)",
    "targetStates": "Target states",
    "homeState": "Home state",
}


async def _profile_context_block(db: AsyncSession, user: User) -> str:
    """A short, allowlisted summary of the student's saved profile.

    Deliberately does NOT pass the raw profile blob to the model — it can
    contain uploaded documents as base64 data URLs (see Profile.jsx) and
    essay drafts, neither of which this feature needs and both of which are
    exactly the kind of extra data collection Anthropic's minors guidance
    says to avoid. Only a handful of academic-planning fields are included.
    """
    result = await db.execute(select(Profile).where(Profile.user_id == user.id))
    row = result.scalar_one_or_none()
    if row is None:
        return "The student hasn't filled out their profile yet — ask for grade level and academic stats if relevant."

    import json

    try:
        data = json.loads(row.data)
    except (ValueError, TypeError):
        return ""

    lines = [
        f"- {label}: {data[key]}"
        for key, label in _ALLOWED_PROFILE_KEYS.items()
        if data.get(key)
    ]
    if not lines:
        return "The student's profile is mostly empty — ask for grade level and academic stats if relevant."
    return "Known student context (use it to personalize, don't just repeat it back):\n" + "\n".join(lines)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatIn(BaseModel):
    message: str = Field(max_length=4000)
    # Running conversation so far, oldest first, NOT including `message`.
    # Capped well below what would meaningfully affect cost/latency for a
    # sidebar chat panel.
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)


class ChatOut(BaseModel):
    status: Literal["ok", "not_configured"]
    reply: str | None = None
    message: str | None = None


@router.post("/chat", response_model=ChatOut)
async def chat(
    payload: ChatIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChatOut:
    settings = get_settings()
    if not settings.anthropic_api_key:
        return ChatOut(
            status="not_configured",
            message=(
                "The AI Advisor isn't set up yet. Get an API key from console.anthropic.com, "
                "then set ANTHROPIC_API_KEY via /set-app-env."
            ),
        )

    if _LOCAL_GUARD_TERMS.search(payload.message):
        return ChatOut(status="ok", reply=SAFE_REDIRECT_MESSAGE)

    profile_context = await _profile_context_block(db, current_user)
    system_prompt = _SYSTEM_PROMPT_TEMPLATE.format(profile_context=profile_context)

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    messages = [{"role": m.role, "content": m.content} for m in payload.history]
    messages.append({"role": "user", "content": payload.message})

    try:
        response = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=1024,
            system=system_prompt,
            messages=messages,
        )
    except anthropic.APIError as exc:
        raise HTTPException(status_code=502, detail=f"AI Advisor is temporarily unavailable: {exc}") from exc

    if response.stop_reason == "refusal":
        return ChatOut(status="ok", reply=SAFE_REDIRECT_MESSAGE)

    text = next((block.text for block in response.content if block.type == "text"), "")
    return ChatOut(status="ok", reply=text or SAFE_REDIRECT_MESSAGE)
