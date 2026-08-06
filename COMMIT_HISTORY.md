# Development History

## Origin

CollegePath was built by Ahsan Naqvi across roughly 55 commits between July 6 and August 6, 2026, in the original private working repository, using AI-assisted development tooling (Claude Code). That original commit-by-commit history isn't replayed here — this repo starts as a single snapshot of the finished source code, copied over on August 6, 2026, with internal deployment/infrastructure docs left out since they only made sense in the original environment.

For anyone curious what real development on a project like this looks like day to day, the short version: it moved in stages (app shell → auth → recommendation engine → real backend data → feature work → bug fixes), and along the way a few real production bugs were found, root-caused from logs, and fixed — a broken cross-service network call, a data-loss bug in profile storage, and a dependency-related crash loop. That's the normal, unglamorous shape of shipping real software.

## This Repo's Own History (starts here)

This section is for tracking what happens *in this repo*, going forward — real, dated entries for real changes, in plain language, the same way you'd want a reviewer to be able to follow the actual work.

### 2026-08-06 — Initial snapshot

Copied the application source (frontend, backend, Docker setup, product docs) from the original private repository into this new public repo. Cleaned up some leftover dead code found during the copy (an unused, never-wired Next.js scaffold sitting alongside the real Vite frontend) and confirmed both the frontend build and the backend test suite (`poetry run pytest`) still pass cleanly in this new location.

### [Date] — _(next real entry goes here)_

_Add a dated entry each time something real changes — a bug fixed, a feature added, something learned by reading the code. Specific and true beats polished and vague._
