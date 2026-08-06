# Student Profile Onboarding — Design Doc

Design spec for the multi-step, gamified "build your college profile" onboarding flow.
Status: **design only** — no implementation yet. Written against the current Phase 1
scaffold (see `CLAUDE.md`, `frontend/CLAUDE.md`, `backend/README.md`, `docs/user-stories.md`)
so it plugs into what exists instead of assuming a parallel stack.

This supersedes the legacy flat `frontend/src/pages/Profile.jsx` (single-page,
`localStorage`-only, fields: `studentName`, `gpa`, `testScores`, `apCourses`, ... — see
`AppContext.jsx`). That page and `AppContext` are retired once onboarding ships; anything
in `EMPTY_PROFILE` maps onto the new schema below (mapping table in §4).

Fits into the existing plan: Phase 2 already calls for a `users` table with `role` +
`tier` (Free/Paid/Admin) and an `events` table every UI action reports to
(`trackEvent.js`, `docs/user-stories.md`). Onboarding reuses both — every step transition
is an `events` row, and every profile table has a `user_id` FK once Phase 2 auth lands.

---

## 0. Stack decision carried through this doc

| Layer | Existing | Onboarding module |
|---|---|---|
| Framework | React 18 + Vite + Tailwind | same |
| Language | `.jsx`, `tsconfig.json` present but unused | **`.tsx`** — new module only, no repo-wide migration |
| Routing | `react-router-dom` v6 | same, nested under `/onboarding/*` |
| State | Plain Context (`AuthContext`, `AppContext`), no Redux/Zustand | same pattern: one `OnboardingContext` + `useReducer`, not a new library |
| Backend | FastAPI + Poetry, SQLAlchemy 2.0 async, Pydantic v2, schema-less | adds real schema + routers, first tables in the repo |
| Animation | none yet | Framer Motion (new dep) |

Introducing TypeScript only inside `frontend/src/features/onboarding/` is a judgment
call — flag it to the user before merging; it's the path of least regret since it doesn't
force converting the 20 existing `.jsx` files, but it does mean the repo carries both
extensions until a future full migration.

---

## 1. UX Flow

```
Welcome (0%) → Basic Info → Academic History → Test Scores → Volunteer Work
  → Internships & Projects → Awards → Recommendations → Certifications
  → Completion Dashboard (100%)
```

Rules that apply to every step:
- **Non-linear after first pass.** Once a student has visited every step once, the step
  rail (persistent side/bottom nav) unlocks free jumping — this isn't a Duolingo hard-gate,
  it's a checklist. First-time users are soft-guided forward with a "Next" primary CTA.
- **Autosave on blur + 2s debounce**, not on every keystroke — avoids hammering the API
  and matches "save progress automatically" without a save button anywhere.
- **Every field is optional at the DB level.** "Required" is a UI/gamification concept
  (drives completion %), never a hard validation blocker — a student must always be able
  to leave a section half-done and come back. Only Welcome and Basic Info's identity
  fields (name, grad year) are true blockers, because every later completion-% calculation
  needs a grad year to contextualize "on track."
- **Undo**: last mutation per section kept in memory (not persisted) for a 10s toast
  ("Removed volunteer entry — Undo"); after 10s it's a real DELETE.
- **Milestone events** fire at 25/50/75/100% — each is one `events` row
  (`component: "onboarding"`, `event_type: "milestone_reached"`, `metadata.pct`) plus a
  confetti burst + toast. This reuses `trackEvent.js` as-is.

### Per-step UX

| Step | Primary content | Empty state | Gamification hook |
|---|---|---|---|
| Welcome | Hero illustration, "Start" / "Continue previous session" (only shown if `onboarding_progress` row exists) | — | 0% ring, streak intro copy |
| Basic Info | Name, grad year, school (typeahead), contact | — | +% per field group |
| Academic History | GPA (weighted/unweighted toggle), class rank (optional), transcript upload | "No transcripts yet — drag one in or use your camera" | Badge: "First Upload" |
| Test Scores | SAT/ACT/PSAT/None toggle chips, score report upload, score fields | "Haven't tested yet? Skip for now." | Disabled "Connect College Board — Coming Soon" pill |
| Volunteer Work | Timeline of cards, "+ Add experience" | Illustration + "Every hour counts — add your first one" | Badge: "Community Builder" at 3+ entries |
| Internships & Projects | Two tabs, portfolio-grid cards | Two separate empty states | Badge: "Builder" (1 project), "Innovator" (3+) |
| Awards | Badge-grid (visual, not list) | "Add your first award" | Level chips (School→International) double as visual reward |
| Recommendations | Contact cards + "Request via email" (Phase 2 workflow, disabled now) | "Ask a teacher, coach, or mentor" | Badge: "Well Recommended" at 2+ |
| Certifications | Provider-logo grid | "No certifications yet" | Badge: "Lifelong Learner" |
| Completion Dashboard | Rings/meters (§ below), missing-items list, suggestions | n/a | Final confetti at 100%, College Readiness Score reveal animation |

### Completion Dashboard metrics (all derived, not stored)

- **Profile Completion %** — weighted: Basic Info 15, Academic 20, Tests 15, Volunteer 10,
  Internships/Projects 15, Awards 10, Recommendations 10, Certifications 5.
- **Academic Strength** — GPA percentile bucket + rigor (AP/IB/Honors count) vs. grad year peers.
- **Volunteer Impact** — total hours + org diversity.
- **Leadership Score** — heuristic from role keywords ("President", "Captain", "Founder") across volunteer/internship/project entries — v1 keyword match, v2 candidate for an LLM classifier (future integration, §9).
- **Project Portfolio** — count + has-external-link ratio (GitHub/site/demo).
- **Recommendation Status** — requested vs. received vs. none.
- **Certification Count** — raw count, provider diversity.
- **College Readiness Score** — single weighted composite of the above, 0–100.

---

## 2. Responsive layout spec (per step)

Textual wireframe spec, not rendered mockups — feed this to a design tool or build directly from it.

**Mobile (< 640px, primary target):**
- Full-bleed single column, 16px gutter.
- Sticky top bar: back chevron · step title · circular progress ring (top-right).
- Sticky bottom bar: secondary "Back" (ghost) + primary "Continue" (filled), safe-area padded.
- Cards stack vertically, 12px gap, each with a subtle top-border accent color per section.
- Upload zones are full-width dashed-border tap targets ("Tap to upload or drag a file" —
  drag doesn't really apply on mobile, so copy adapts: "Tap to upload · Take a photo").

**Tablet (640–1024px):**
- Same single-column flow, max-width 640px, centered — do not go two-column here, it reads
  as cramped at this breakpoint for a form-like flow.

**Desktop (≥ 1024px):**
- Two-column: left rail (fixed, 280px) shows all 9 steps with checkmarks/percentages —
  this is the "free jump" nav described above; right column is the active step content,
  max-width 720px, centered in remaining space.
- Upload zones support real drag-and-drop with a visible dropzone highlight on `dragover`.

**Both themes**, token-driven (Tailwind CSS variables, not hardcoded classes):
```
--surface, --surface-raised, --text-primary, --text-secondary, --accent,
--accent-contrast, --success, --warning, --border
```
Dark theme isn't `bg-gray-900` sprinkled everywhere — it's driven by these tokens so a
theme toggle is a single class swap on `<html>` (`class="dark"`), matching Tailwind's
built-in `dark:` variant convention. Respect `prefers-color-scheme` on first load, persist
explicit choice in `localStorage`.

Motion (Framer Motion):
- Step transitions: 200ms slide + fade, respecting `prefers-reduced-motion` (fall back to
  fade-only, no slide, when set).
- Progress ring: animated stroke-dashoffset on value change, not a re-mount.
- Confetti: `canvas-confetti` (lightweight, no dependency on Framer for particles).

---

## 3. Frontend component structure

```
frontend/src/features/onboarding/
├── OnboardingLayout.tsx          # sticky bars, progress ring, step rail (desktop)
├── OnboardingRouter.tsx          # nested routes under /onboarding/:step
├── context/
│   ├── OnboardingContext.tsx     # useReducer + autosave + undo-toast state
│   └── onboardingReducer.ts      # pure reducer, unit-testable in isolation
├── hooks/
│   ├── useAutosave.ts            # debounced PATCH, exposes lastSavedAt
│   ├── useCompletionScore.ts     # derives % + sub-meters from context state
│   └── useUndo.ts                # 10s-window undo-toast primitive
├── api/
│   └── onboardingClient.ts       # typed fetch wrappers, one per resource
├── types/
│   └── onboarding.ts             # shared TS types, mirror Pydantic schemas 1:1
├── components/
│   ├── ProgressRing.tsx
│   ├── StepRail.tsx              # desktop left nav
│   ├── MobileStepBar.tsx
│   ├── UploadDropzone.tsx        # shared drag/drop/camera/preview/progress
│   ├── FileCard.tsx              # uploaded-file display, edit/delete
│   ├── EmptyState.tsx
│   ├── AchievementBadge.tsx
│   ├── ConfettiBurst.tsx
│   ├── TimelineCard.tsx          # volunteer/internship entries
│   ├── PortfolioCard.tsx         # projects
│   └── MilestoneToast.tsx
└── steps/
    ├── WelcomeStep.tsx
    ├── BasicInfoStep.tsx
    ├── AcademicHistoryStep.tsx
    ├── TestScoresStep.tsx
    ├── VolunteerStep.tsx
    ├── ProjectsStep.tsx          # internships + personal projects, tabbed
    ├── AwardsStep.tsx
    ├── RecommendationsStep.tsx
    ├── CertificationsStep.tsx
    └── CompletionDashboardStep.tsx
```

`App.jsx` gains one addition (plain JS import of a `.tsx` file works fine under Vite):
```jsx
<Route path="/onboarding/*" element={<OnboardingRouter />} />
```

---

## 4. Database schema

SQLAlchemy 2.0 async, subclassing the existing `Base` in `backend/app/models/base.py`.
All tables FK to `users.id` (the Phase 2 table already planned in `docs/user-stories.md`).

```python
# backend/app/models/onboarding.py

from datetime import date, datetime
from sqlalchemy import ForeignKey, String, Text, Date, DateTime, Numeric, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class OnboardingProgress(Base):
    __tablename__ = "onboarding_progress"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    current_step: Mapped[str] = mapped_column(String(50), default="welcome")
    completed_steps: Mapped[str] = mapped_column(Text, default="[]")  # JSON list, Postgres JSONB later
    last_active_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)


class AcademicRecord(Base):
    __tablename__ = "academic_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    high_school_name: Mapped[str] = mapped_column(String(255))
    graduation_year: Mapped[int] = mapped_column(Integer)
    gpa: Mapped[float | None] = mapped_column(Numeric(3, 2))
    gpa_scale: Mapped[str] = mapped_column(String(10), default="4.0")
    class_rank: Mapped[str | None] = mapped_column(String(50))  # "45/320" — free text, optional


class TestScore(Base):
    __tablename__ = "test_scores"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    test_type: Mapped[str] = mapped_column(String(10))  # sat | act | psat
    test_date: Mapped[date | None] = mapped_column(Date)
    reading_score: Mapped[int | None] = mapped_column(Integer)
    writing_score: Mapped[int | None] = mapped_column(Integer)
    math_score: Mapped[int | None] = mapped_column(Integer)
    total_score: Mapped[int | None] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(20), default="manual")  # manual | college_board_sync (future)


class VolunteerExperience(Base):
    __tablename__ = "volunteer_experiences"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    organization: Mapped[str] = mapped_column(String(255))
    role: Mapped[str | None] = mapped_column(String(255))
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    hours: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text)
    skills_learned: Mapped[str | None] = mapped_column(Text)
    reflection: Mapped[str | None] = mapped_column(Text)


class Internship(Base):
    __tablename__ = "internships"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    company: Mapped[str] = mapped_column(String(255))
    role: Mapped[str | None] = mapped_column(String(255))
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    supervisor_name: Mapped[str | None] = mapped_column(String(255))
    responsibilities: Mapped[str | None] = mapped_column(Text)
    skills: Mapped[str | None] = mapped_column(Text)
    achievements: Mapped[str | None] = mapped_column(Text)


class PersonalProject(Base):
    __tablename__ = "personal_projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    technologies: Mapped[str | None] = mapped_column(String(500))
    github_url: Mapped[str | None] = mapped_column(String(500))
    website_url: Mapped[str | None] = mapped_column(String(500))
    video_url: Mapped[str | None] = mapped_column(String(500))


class Award(Base):
    __tablename__ = "awards"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255))
    organization: Mapped[str | None] = mapped_column(String(255))
    award_date: Mapped[date | None] = mapped_column(Date)
    level: Mapped[str] = mapped_column(String(20))  # school|district|state|national|international
    description: Mapped[str | None] = mapped_column(Text)


class Recommendation(Base):
    __tablename__ = "recommendations"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    recommender_name: Mapped[str] = mapped_column(String(255))
    position: Mapped[str | None] = mapped_column(String(255))
    school_or_org: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    relationship: Mapped[str] = mapped_column(String(50))  # teacher|coach|counselor|mentor|professor
    status: Mapped[str] = mapped_column(String(20), default="not_requested")  # not_requested|requested|received


class Certification(Base):
    __tablename__ = "certifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255))
    provider: Mapped[str] = mapped_column(String(100))  # google|microsoft|aws|coursera|... (maps to logo asset)
    completion_date: Mapped[date | None] = mapped_column(Date)
    expiration_date: Mapped[date | None] = mapped_column(Date)
    credential_id: Mapped[str | None] = mapped_column(String(255))
    credential_url: Mapped[str | None] = mapped_column(String(500))


class UploadedFile(Base):
    """Polymorphic attachment — one table for every upload across all sections."""
    __tablename__ = "uploaded_files"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    owner_type: Mapped[str] = mapped_column(String(30))  # "transcript"|"test_score"|"volunteer"|... |"recommendation"
    owner_id: Mapped[int | None] = mapped_column(Integer)  # nullable: transcripts attach to user, not a row
    file_name: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    storage_key: Mapped[str] = mapped_column(String(500))  # blob path, §6
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ExternalConnection(Base):
    """Placeholder rows for future OAuth integrations — College Board, Parchment, Drive, etc."""
    __tablename__ = "external_connections"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    provider: Mapped[str] = mapped_column(String(50))  # college_board|act|parchment|naviance|scoir|common_app|google_drive|dropbox|onedrive
    status: Mapped[str] = mapped_column(String(20), default="not_connected")
    access_token_encrypted: Mapped[str | None] = mapped_column(Text)
    connected_at: Mapped[datetime | None] = mapped_column(DateTime)
```

**Legacy field mapping** (`AppContext.EMPTY_PROFILE` → new schema):
`studentName`/`highSchoolName` → `academic_records` + `users`; `gpa`/`gpaScale`/`classRank`
→ `academic_records`; `testScores` (free text) → `test_scores` (structured); `apCourses`/
`ibCourses`/`honorsCourses` → folded into a `rigor_courses` JSON column on
`academic_records` (not worth a separate table — no per-course upload/dates needed);
`extracurriculars` → split across `volunteer_experiences`/`internships`; `awards` (free
text) → `awards` (structured); `counselorName`/`counselorEmail` → a `Recommendation` row
with `relationship="counselor"`, or optionally kept on `academic_records` if not every
counselor doubles as a recommender — confirm with product before dropping the dedicated
fields.

---

## 5. API design

FastAPI routers under `backend/app/routers/onboarding/`, one router per resource, all
async, all Pydantic v2 request/response models. Every route requires the (Phase 2) auth
dependency; `user_id` comes from the session, never from the request body.

```
GET    /api/onboarding/progress                  -> OnboardingProgress
PATCH  /api/onboarding/progress                  -> { current_step }

GET    /api/onboarding/academic-record           -> AcademicRecord | null
PUT    /api/onboarding/academic-record            (upsert — one-per-user)

GET    /api/onboarding/test-scores               -> TestScore[]
POST   /api/onboarding/test-scores
PATCH  /api/onboarding/test-scores/{id}
DELETE /api/onboarding/test-scores/{id}

# same CRUD shape repeats for:
#   /volunteer-experiences, /internships, /projects, /awards,
#   /recommendations, /certifications

POST   /api/onboarding/files                     -> presigned upload flow, §6
DELETE /api/onboarding/files/{id}

GET    /api/onboarding/completion-summary        -> derived scores (§1), computed
                                                     server-side so scoring logic has
                                                     one implementation, not duplicated
                                                     in useCompletionScore.ts (that hook
                                                     becomes a thin cache/optimistic-UI
                                                     layer over this endpoint)

GET    /api/onboarding/connections                -> ExternalConnection[]
POST   /api/onboarding/connections/{provider}/connect   -> 501 Not Implemented (Phase future)
```

Every mutating route emits an `events` row (reusing the Phase 2 `events` table already
planned) — this is what powers "resume where you left off" and any future admin-side
analytics on drop-off per step.

Pydantic v2 example (mirrors the TS types in `frontend/.../types/onboarding.ts` 1:1):

```python
from pydantic import BaseModel, field_validator

class VolunteerExperienceIn(BaseModel):
    organization: str
    role: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    hours: int | None = None
    description: str | None = None
    skills_learned: str | None = None
    reflection: str | None = None

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v, info):
        start = info.data.get("start_date")
        if v and start and v < start:
            raise ValueError("end_date must be on or after start_date")
        return v
```

---

## 6. File upload architecture

No upload handling exists yet — this is new. Given the Azure stack (per global
conventions), design for **Azure Blob Storage**, not local disk, even in early phases —
avoids a rewrite later and local dev can point at Azurite (the Azure Storage emulator).

**Flow (presigned URL pattern — files never transit the FastAPI process):**
1. Client calls `POST /api/onboarding/files` with `{ file_name, content_type, size_bytes, owner_type, owner_id }`.
2. Backend validates (§8), creates the `uploaded_files` row (`storage_key` pre-generated as `{user_id}/{owner_type}/{uuid}-{file_name}`), and returns a **SAS URL** (short-lived, write-only, scoped to that blob path) via `azure-storage-blob`'s `generate_blob_sas`.
3. Client `PUT`s the file bytes directly to the SAS URL, tracking upload progress via `XMLHttpRequest.upload.onprogress` (native `fetch` can't report upload progress — this is the one place the frontend can't avoid `XMLHttpRequest` or a wrapper like `axios`).
4. Client calls `PATCH /api/onboarding/files/{id}` with `{ status: "complete" }` once the SAS `PUT` succeeds; backend does a HEAD on the blob to confirm size/existence before flipping status — never trust the client's word alone.
5. Deletes: `DELETE` route removes both the blob and the DB row in the same request (blob delete first; if it 404s because it was already gone, proceed — don't fail the whole delete over a missing blob).

**Constraints:** 15MB per file (transcripts/score reports are usually <5MB; generous
headroom for photographed transcripts), `application/pdf` + `image/jpeg` + `image/png` +
`image/heic` (mobile camera). Reject everything else at both the presigned-URL step
(content_type check) and via the SAS token's own content-type restriction.

**`UploadDropzone.tsx`** is one shared component (not one per section) — takes
`ownerType`/`ownerId`/`accept`/`multiple` props, handles drag-over state, the native
`<input type="file" capture="environment">` for mobile camera capture, upload progress
bar, and renders `FileCard.tsx` for each completed upload (thumbnail for images, PDF icon
+ filename for documents, delete/replace affordance).

---

## 7. State management approach

Stays inside the existing plain-Context convention — no new library.

- **`OnboardingContext`**: `useReducer` holding `{ progress, sections: {...}, dirty: Set<sectionKey> }`. Actions are section-scoped (`SET_ACADEMIC_RECORD`, `ADD_VOLUNTEER_ENTRY`, `REMOVE_VOLUNTEER_ENTRY`, ...) — a single flat reducer, not one per section, since cross-section derivations (completion %) need to see everything at once anyway.
- **`useAutosave`**: subscribes to `dirty`, debounces 2s per section key (not globally — editing Volunteer shouldn't delay an in-flight Academic save), calls the matching API client function, clears that key from `dirty` on success, leaves it (and shows a small "not saved — retrying" indicator) on failure with exponential backoff.
- **Optimistic updates everywhere**: reducer applies the change immediately; failure rolls back via the `useUndo` snapshot rather than a separate rollback path — reuses the same mechanism.
- **Server is the source of truth on load**: `OnboardingProvider` mount does one `GET` per resource (parallelized), not a localStorage read — this is the one deliberate deviation from `AppContext`'s localStorage-first pattern, because onboarding data must survive a device switch (a student filling this out on a phone, then continuing on a school Chromebook). `localStorage` is used only as an offline-write buffer if a PATCH fails outright (queued, retried on reconnect via `navigator.onLine` listener), not as the primary store.

---

## 8. Validation rules

| Section | Field | Rule |
|---|---|---|
| Basic Info | Graduation year | Integer, current year ≤ x ≤ current year + 6 |
| Basic Info | Email | Standard email regex, required only if student self-registered without one |
| Academic | GPA | 0 ≤ x ≤ scale (4.0, 4.5, or 5.0 — scale selector constrains the max) |
| Academic | Class rank | Free text, no format enforced (schools format wildly differently) — display as entered |
| Test Scores | SAT total | 400–1600; section scores 200–800 each, must sum to total ± rounding tolerance of 0 (exact) |
| Test Scores | ACT total | 1–36; section scores 1–36 |
| Test Scores | Test date | Not in the future |
| Volunteer/Internship | End date | ≥ start date (validator above); both optional (ongoing roles have no end date) |
| Volunteer | Hours | Non-negative integer, soft-cap warning (not a hard block) above 2000 for a single entry — catches obvious typos without blocking legitimately dedicated students |
| Awards | Level | Enum-constrained (school/district/state/national/international) — dropdown, not free text, so the Award Recognition badge-grid can group reliably |
| Recommendations | Email | Valid email if provided; not required to save a draft entry with just a name |
| Certifications | Credential URL | Valid URL scheme if provided; not fetched/verified server-side (no SSRF risk from validating format only) |
| All file uploads | Content-type + size | Enforced both client-side (fast feedback) and server-side (authoritative) — never trust client-only validation |

General rule: **almost nothing is a hard blocker.** The only true required-to-proceed
fields are graduation year (Basic Info) and, before reaching the Completion Dashboard,
at least a name — everything else feeds the completion score rather than gating
navigation. This is the mechanism that makes "leave and come back" actually work instead
of just being a slogan.

---

## 9. Future-ready integration points

All modeled through the single `external_connections` table (§4) + a common adapter
interface, so adding a provider is "write one adapter class," not a schema change:

```python
class ExternalConnectionAdapter(Protocol):
    provider: str
    async def get_oauth_url(self, user_id: int) -> str: ...
    async def handle_callback(self, user_id: int, code: str) -> None: ...
    async def sync(self, user_id: int) -> None: ...  # pulls scores/transcripts into the real tables
```

| Provider | Target table on sync | UI placeholder now |
|---|---|---|
| College Board | `test_scores` (`source="college_board_sync"`) | "Connect College Board" button, disabled, labeled "Coming Soon" — styled to look official (per spec) but non-interactive |
| ACT | `test_scores` | same pattern, ACT-branded |
| Parchment | `academic_records` + a new `uploaded_files` row (official transcript) | "Import from Parchment" card, disabled |
| Naviance / Scoir | cross-cutting (these are counselor platforms — likely sync academic + recommendation status) | "Connect your counselor platform" card |
| Common App | export target, not import — a future `POST /api/onboarding/export/common-app` that maps this schema to Common App's activity/honors format | "Export to Common App" — build after the schema stabilizes, not now |
| Google Drive / Dropbox / OneDrive | alternate source for `POST /api/onboarding/files` — "import from" instead of local upload | "Import from..." option inside `UploadDropzone` |

The `access_token_encrypted` column exists now so the table shape doesn't change when
these ship — encrypt with the same secret-handling approach as any other credential in
this repo (env-var-sourced key, never committed — ties into the global "never commit
secrets" rule).

---

## 10. Premium UI notes

- **Illustrations**: use a consistent open-source set (e.g. unDraw or Blush, recolored to
  the accent token) rather than mixing styles — visual consistency across 9 steps matters
  more than any single illustration being perfect.
- **Iconography**: `lucide-react` — already a dependency, keep using it instead of adding
  a second icon library.
- **Typography**: one display weight for step titles + celebratory copy, one body weight
  for everything else — avoid a third weight, it's what makes onboarding flows feel
  cluttered instead of confident.
- **Microcopy tone**: encouraging, second person, present tense — "Nice, that's one
  volunteer experience logged!" not "Volunteer experience successfully saved." Never
  guilt-trip incomplete sections ("You're missing 3 things!") — frame as opportunity
  ("Adding a project could boost your Leadership Score").
- **Badge grid** (Awards step) doubles as the visual language for the Achievements system
  referenced in gamification — same `AchievementBadge.tsx` component in both places, so
  the two systems feel unified instead of bolted together.

---

## Open decisions for the user to confirm before implementation

1. TypeScript scoped to the new `features/onboarding/` folder only vs. a wider migration — recommended: scoped.
2. Counselor identity: dedicated fields on `academic_records` vs. always a `Recommendation` row — needs a product call, not an engineering one.
3. Azure Blob Storage now vs. local disk for an early demo, migrate later — recommended: Blob Storage from the start, using Azurite locally, to avoid a storage-layer rewrite.
4. Whether `College Readiness Score`'s "Leadership Score" heuristic should ship as simple keyword-matching (v1, cheap, deterministic) or wait for an LLM-based classifier — recommended: v1 keyword heuristic now, revisit only if it proves inaccurate in practice.
