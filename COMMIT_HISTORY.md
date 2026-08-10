# Development History

## Origin

CollegePath was built by Ahsan Naqvi across roughly 55 commits between July 6 and August 6, 2026, in the original private working repository, using AI-assisted development tooling (Claude Code). That original commit-by-commit history isn't replayed here — this repo starts as a single snapshot of the finished source code, copied over on August 6, 2026, with internal deployment/infrastructure docs left out since they only made sense in the original environment.

For anyone curious what real development on a project like this looks like day to day, the short version: it moved in stages (app shell → auth → recommendation engine → real backend data → feature work → bug fixes), and along the way a few real production bugs were found, root-caused from logs, and fixed — a broken cross-service network call, a data-loss bug in profile storage, and a dependency-related crash loop. That's the normal, unglamorous shape of shipping real software.

## This Repo's Own History (starts here)

This section is for tracking what happens *in this repo*, going forward — real, dated entries for real changes, in plain language, the same way you'd want a reviewer to be able to follow the actual work.

### 2026-08-06 — Initial snapshot

Copied the application source (frontend, backend, Docker setup, product docs) from the original private repository into this new public repo. Cleaned up some leftover dead code found during the copy (an unused, never-wired Next.js scaffold sitting alongside the real Vite frontend) and confirmed both the frontend build and the backend test suite (`poetry run pytest`) still pass cleanly in this new location.

### 2026-08-10 — Batch sync of four days of real development

The entries below cover real work done in the original private repository between the Aug 6 snapshot and Aug 10, applied here as one batch sync rather than four separate ones. Dated by when each thing actually happened, not by the sync date, since that's more useful for anyone trying to follow the real timeline.

**2026-08-06/07 — Real authentication.** Replaced the dev-only fake-login stand-in with real auth: argon2 password hashing, signed session cookies, a proper `/api/auth/*` router, and free/paid tier gating enforced server-side (closing a hole where a client could self-upgrade its own tier for free). Shortly after, found that accounts created under the old fake-login system had no way to recover access under the new real one — added self-service password reset (`/api/auth/forgot-password`, `/api/auth/reset-password`, single-use tokens, 60-minute expiry). Then found and fixed a follow-up bug in that same feature: the reset-link logging call used a Python logger that was never actually configured to output anywhere, so the "email" a user requested silently went nowhere — a real user hit this dead end before it was caught and fixed.

**2026-08-08 — AI Advisor.** A real chat assistant on the Profile page, using a student's own profile as context. Since the audience is mostly high-school students (minors), built two independent safety layers rather than relying on the system prompt alone: a local keyword guard that rejects an off-topic message before any model call happens, plus explicit scope instructions in the prompt itself. Added a public `/child-safety` page documenting the approach — written to be honest that it's a disclosure page, not a substitute for real legal/compliance review.

**2026-08-09 — Payments.** Real Stripe Checkout integration, verified against an actual completed checkout with a test card (not just mocked tests) — which surfaced a real bug on first live use: the code checked a Stripe response's metadata with `dict`-style access, but a real (non-mocked) Stripe object doesn't support that, so every real payment attempt 500'd until fixed. Separately found and fixed a redirect bug where Stripe's post-checkout redirect, the OAuth callback, and password-reset links were all building URLs from a setting that was never actually set in production, sending users to a dead `localhost` address instead of the real domain.

**2026-08-10 — Admissions bias research, profile completion tracking, and a real CSS bug.** Added a feature that researches a specific college's own admissions process for documented or commonly-discussed bias (distinguishing verified claims backed by a real source from anecdotal ones), using live web search rather than the model's own possibly-stale knowledge. Added a profile-completion percentage (a curated set of the fields that actually drive the matching engine, with a per-field "not applicable to me" opt-out so a student isn't penalized for a field that genuinely doesn't apply to them) surfaced on the dashboard. Also root-caused a genuinely tricky CSS bug: scroll-triggered fade-in animations were snapping instantly instead of animating, and it took several rounds to find the real cause — a CSS `transition` shorthand collision, where one class's transition list was silently overwriting another's instead of merging with it, so the property that was supposed to animate (opacity) wasn't in the browser's actual transition list at all. Confirmed with real `getComputedStyle()` measurements, not just eyeballing it, since three earlier, plausible-looking fixes (scroll-reset, failsafe timing, nested-component structure) turned out to be real bugs worth fixing on their own merits but not the actual cause.

### [Date] — _(next real entry goes here)_

_Add a dated entry each time something real changes — a bug fixed, a feature added, something learned by reading the code. Specific and true beats polished and vague._
