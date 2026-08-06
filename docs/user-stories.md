# User Stories

One entry per UI component, per the Phase 1 spec in the implementation plan. Each story
drives both the schema (Phase 2 — every listed action must be traceable to an `events` row)
and the tier-gating logic (Phase 3/4).

---

## 1. Login Page

**Component**: `LoginPage` (`GoogleTab`, `MicrosoftTab`, `PasswordTab`)
**Persona**: Any prospective user (Free, Paid, or Admin) — this is the pre-authentication entry point; tier is resolved after login, not before.

**Story**: As a prospective user, I want to log in with my Google account, my Microsoft account, or an email + password, so that I can access the app using whichever credential I already have without being forced onto a single provider.

**UI**: Three tabs on the login page:
1. **Continue with Google** — single-click OAuth button, no password field.
2. **Continue with Microsoft** — single-click OAuth button (personal or work/school account), no password field.
3. **Email + Password** — email field, password field, "Log in" button, plus a "Sign up" toggle for new accounts on this tab only.

**Acceptance criteria**:
- The password field appears **only** on the Email + Password tab — it never appears on the Google or Microsoft tabs.
- Google/Microsoft tabs redirect to the provider's consent screen and return a verified email plus a stable provider subject id (`google_sub` / `microsoft_sub`).
- On a user's first successful login via any method, a new `users` row is created with `tier = Free` by default.
- Returning users are recognized by provider subject id (OAuth tabs) or email (password tab) and see their existing tier — login does not reset it.
- A failed login shows a generic inline error ("invalid email or password") — it must not reveal whether the email exists, to avoid user enumeration.
- Every login attempt, success or failure, produces one row in the `events` table: `component = "login_page"`, `event_type = "login_success" | "login_failure"`, `metadata.provider = "google" | "microsoft" | "password"`.

**Schema implications for Phase 2**:
- `users.password_hash` — nullable; set only for accounts created via the Email + Password tab (hashed with bcrypt/argon2, never stored in plaintext, never returned by any API response).
- `users.google_sub`, `users.microsoft_sub` — nullable, unique when set; a single email could in principle link more than one provider, but that merge flow is out of scope for this story.
- `users.tier` — defaults to `Free` on first-ever login regardless of provider.

---

## 2. Homepage (public landing page)

**Component**: `Homepage` (hero, feature grid, tier comparison, footer)
**Persona**: Anonymous visitor — nobody is logged in yet; this is what `/` shows before authentication.

**Story**: As an anonymous visitor, I want to see what College Advisor does and what the Free vs. Paid tiers offer before I commit to signing up, so that I can decide whether to create an account.

**UI**:
- **Hero** — product name, one-line pitch ("Your Personalized Roadmap to College Admission"), two CTAs: "Get Started Free" and "Log In" (both link to `/login`, which is a placeholder until the Login Page story is built).
- **Feature grid** — one card per core capability, mirroring the app's real sections: College List, Programs, Hidden Gems, Scholarships, Timeline, Strategy.
- **Tier comparison** — Free vs. Paid feature differences (pricing shown as "coming soon" — not yet defined). Admin is an internal role, not a purchasable tier, and is intentionally not shown here.
- **Footer** — minimal, product name + login link.

**Acceptance criteria**:
- `/` is public — no authentication required to view it.
- Every CTA click is tracked: `component = "homepage_cta"`, `event_type = "click"`, `metadata.cta = "get_started" | "login"`.
- The previous authenticated home content (stats overview) moves from `/` to `/dashboard` — it is unaffected otherwise.
- Tier comparison content must not overstate unbuilt features; anything not yet implemented (e.g., exact pricing) is marked "coming soon" rather than invented.

**Open item**: exact Paid-tier pricing and the full Free-tier usage cap (e.g., "# of flows") are not yet defined — placeholders are used until Phase 1's tier list is locked.

---

## 3. Role Selection (Student / Parent / Counsellor)

**Component**: `RoleSelect` (rendered at `/login`, the first page of the login flow — one step before the `LoginPage` auth-method tabs from story 1)
**Persona**: Any prospective user, before authenticating — every visitor identifies which of three account types they are: **Student**, **Parent**, or **Counsellor**.

**Story**: As a prospective user arriving to log in, I want to first say whether I'm a Student, a Parent, or a Counsellor, so that the app can tailor my dashboard, features, and permissions to my role once I'm signed in.

**UI**:
- Homepage's "Log In" CTA (story 2) now lands on a **"Login to your account"** page — the first page of the login flow — showing three role options: **Student**, **Parent**, **Counsellor**.
- Selecting a role advances to the existing auth-method Login Page (story 1: Google / Microsoft / Password tabs) at `/login/:role`, carrying the chosen role forward.
- A "Back" link returns to role selection without losing the in-progress auth tab.

**Acceptance criteria**:
- `/login` always shows the three role options before any auth method — a user cannot reach the Google/Microsoft/Password tabs without picking a role first.
- The selected role travels with the auth flow (route param) so it reaches account creation on first login.
- Every role selection is tracked: `component = "role_select"`, `event_type = "click"`, `metadata.role = "student" | "parent" | "counsellor"`.
- On a user's first successful login (per story 1), the new `users` row stores the selected role in addition to the default `tier = Free` — role is independent of tier (e.g., a Parent can be Free or Paid; a Counsellor account is not the same thing as `tier = Admin`).
- Role is fixed at signup — returning users are not re-prompted to change role on every login; changing role on an existing account is out of scope for this story.

**Schema implications for Phase 2**:
- `users.role` — enum (`student`, `parent`, `counsellor`), NOT NULL after signup, set once from the value chosen on this page.
- `users.role` and `users.tier` are orthogonal columns — one describes who the person is, the other what they've paid for.

**Open item**: role-specific dashboard/permission differences (e.g., what a Counsellor sees that a Parent doesn't) are not yet defined — this story only covers capturing the role at login, not gating features by it.
