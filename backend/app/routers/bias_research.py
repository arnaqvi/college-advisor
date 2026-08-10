"""POST /api/bias-research/college — per-college admissions-bias research.

Separate from the counselor-list heuristics in `frontend/src/lib/engine/
counselorBiasCheck.js` (list concentration/coverage — pure client-side math,
no LLM). This endpoint researches a single named college's own admissions
process for documented or commonly-discussed bias, using Claude's web search
tool, and reports findings as VERIFIED (backed by a source) or PERCEIVED
(anecdotal, no citation) — never fabricated.

Uses the same Anthropic API key / not-configured pattern as
app/routers/advisor.py. Citations come from the API's own citation objects
on the response's text blocks (url/title/cited_text), not from asking the
model to self-report sources in structured JSON — combining `output_config.
format` with web-search citations is not supported, so the response is
prose with citations attached, not a JSON schema.
"""

from typing import Annotated, Literal

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.models.college import College, Program
from app.models.user import User

router = APIRouter()

_SYSTEM_PROMPT = """You are researching whether a specific college's admissions process has \
any documented or widely-discussed bias. Follow these research steps:

1. Search the internet for information about {college_name}'s admissions counselors, \
admissions committee members, and admissions office leadership.
2. Identify any publicly reported, documented, or widely discussed biases in their \
admissions process. Look specifically for:
   - Institutional biases tied to the college's reputation or identity (e.g., strong \
preference for recruited athletes, legacy applicants, STEM/research-focused applicants, \
students with military or space-program interest, arts vs. science skew, etc.)
   - Known preferences of specific admissions counselors or regional reps, if publicly \
reported
   - Patterns in admitted student profiles that suggest an unstated preference (e.g., \
disproportionate representation of certain majors, extracurriculars, or backgrounds)
   - Any controversies, lawsuits, investigative journalism, or official statements \
related to admissions bias at this institution
   - Historical context (e.g., the school's founding mission, flagship programs, or \
notable alumni fields) that may influence what the admissions committee values
3. Distinguish between:
   - VERIFIED bias (backed by data, official statements, lawsuits, or investigative \
reporting)
   - PERCEIVED bias (commonly discussed anecdotally by applicants, counselors, or forums \
like Reddit/College Confidential, but not formally confirmed)

Do not fabricate claims; if no reliable information is found, state that clearly. Keep \
the tone factual and neutral, avoiding speculation presented as fact.

Structure your response in exactly two sections, using these headings verbatim:

## Verified
(bulleted, one claim per line, cite what backs each one — official statement, lawsuit, \
data, investigative reporting. If none found, write "No verified bias found.")

## Perceived
(bulleted, one claim per line, describe it as anecdotal. If none found, write "No \
commonly-discussed perceived bias found.")

Do not add any other sections or a closing summary."""


class Citation(BaseModel):
    url: str
    title: str
    cited_text: str


class CollegeBiasResearchOut(BaseModel):
    status: Literal["ok", "not_configured", "not_found"]
    college_name: str | None = None
    report: str | None = None
    sources: list[Citation] = []
    message: str | None = None


@router.post("/college/{program_slug}", response_model=CollegeBiasResearchOut)
async def research_college_bias(
    program_slug: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CollegeBiasResearchOut:
    """Keyed by `program_slug`, not a college id — `/api/colleges` rows are
    one-per-program (`ProgramOut.id` = `Program.slug`, see app/schemas/
    college.py), and that's the id the frontend already has in hand for
    everything in `studentProfile.counselorCollegeList`. Research is about
    the parent college, not the program, so this resolves slug -> college
    and only ever uses the college's name.
    """
    settings = get_settings()
    if not settings.anthropic_api_key:
        return CollegeBiasResearchOut(
            status="not_configured",
            message=(
                "Admissions bias research isn't set up yet. Get an API key from "
                "console.anthropic.com, then set ANTHROPIC_API_KEY."
            ),
        )

    result = await db.execute(
        select(College).join(Program, Program.college_id == College.id).where(Program.slug == program_slug)
    )
    college = result.scalar_one_or_none()
    if college is None:
        return CollegeBiasResearchOut(status="not_found")

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    try:
        response = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=1500,
            system=_SYSTEM_PROMPT.format(college_name=college.name),
            messages=[
                {
                    "role": "user",
                    "content": f"Research {college.name} for admissions bias, following the steps above.",
                }
            ],
            tools=[
                {
                    "type": "web_search_20260318",
                    "name": "web_search",
                    "max_uses": 3,
                    # Dynamic filtering (the default `allowed_callers`) routes each
                    # search through code execution to pre-filter results before
                    # they reach context — valuable for noisy/high-volume research,
                    # but real timing here showed 5 filtered searches + synthesis
                    # blowing well past a 120s proxy timeout. This is a single,
                    # low-volume, synchronous request behind a user-facing spinner,
                    # not a token-cost-sensitive batch job, so direct calls (no
                    # filtering overhead) trade a small amount of result-noise
                    # tolerance for a response that actually returns in time.
                    "allowed_callers": ["direct"],
                }
            ],
        )
    except anthropic.APIError as exc:
        raise HTTPException(
            status_code=502, detail=f"Admissions bias research is temporarily unavailable: {exc}"
        ) from exc

    if response.stop_reason == "refusal":
        return CollegeBiasResearchOut(
            status="ok",
            college_name=college.name,
            report="No reliable information could be researched for this college.",
            sources=[],
        )

    report_parts: list[str] = []
    sources_by_url: dict[str, Citation] = {}
    for block in response.content:
        if block.type != "text":
            continue
        report_parts.append(block.text)
        for citation in getattr(block, "citations", None) or []:
            if citation.type != "web_search_result_location":
                continue
            sources_by_url.setdefault(
                citation.url,
                Citation(url=citation.url, title=citation.title, cited_text=citation.cited_text),
            )

    return CollegeBiasResearchOut(
        status="ok",
        college_name=college.name,
        report="".join(report_parts) or "No reliable information could be researched for this college.",
        sources=list(sources_by_url.values()),
    )
