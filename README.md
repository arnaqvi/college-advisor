# CollegePath (College Advisor)

A full-stack college admissions planning tool — turns a student's real academic profile (GPA, test scores, coursework, preferences) into a data-driven college list, scholarship matches, an essay tracker, and an application timeline.

**Live version:** https://college-advisor.labs.evolveml.io

## Where This Project Comes From

This project was originally built by Ahsan Naqvi as a personal side project, developed with AI-assisted tooling (Claude Code) over about a month at his company, EvolveML. It's shared in this repo, under Abbas's account, as a project he's exploring, learning from, and contributing to.

_(This paragraph is a starting point — replace it with Abbas's own words about what his actual involvement has been, specifically and honestly.)_

## The Problem It Solves

Most students building a college list are working off scattered spreadsheets, guesswork about admit chances, and generic "reach/target/safety" advice that doesn't account for their actual GPA, test scores, and preferences. CollegePath centralizes that: a real academic profile drives a data-driven college list, scholarship matches, and a timeline, updating automatically as the profile changes.

## What It Does

- **Student Profile** — GPA (weighted/unweighted), test scores, coursework, extracurriculars, and college preferences drive every other page.
- **College Directory** — a real, growing database of colleges and programs (seeded from the U.S. Department of Education's College Scorecard API plus hand-curated GPA/SAT bands).
- **Fit Classification** — every program is scored Reach / Target / Safety against the student's own academic profile.
- **Hidden Gems** — surfaces strong-fit programs a student might otherwise overlook.
- **Scholarships** — national scholarship matching based on academic and background eligibility.
- **Essay Tracker** — per-college essay prompts, word counts, drafts, and status.
- **Timeline & Strategy** — a month-by-month application timeline and admissions strategy view.
- **Counselor Bias Check** — compares a counselor-suggested list against the student's own data-driven list.
- **Role-based accounts** — separate student, parent, and counselor views.

## Tech Stack

**Frontend:** React 18, Vite, Tailwind CSS, React Router, Lucide icons.

**Backend:** FastAPI (Python 3.11), SQLAlchemy 2.0 (async), Pydantic v2, Poetry.

**Database:** PostgreSQL (async via `asyncpg`).

**Infrastructure:** Docker (multi-stage build), deployed on Kubernetes.

## What I've Actually Done With It

_(This section is for me to keep honest and specific — replace this paragraph with what I actually explore, break, fix, or add, as I do it. "I read through X and learned Y," "I fixed a small bug in Z," "I added a new feature to W" — real, specific, and true.)_

## Running Locally

Run both halves in separate terminals.

**Backend:**
```bash
cd backend
poetry install
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api/*` requests to `http://localhost:8000` (see `frontend/vite.config.js`).

## Project Structure

```
college-advisor/
  frontend/     React + Vite app — see frontend/src/ for structure
  backend/      FastAPI app (Poetry-managed)
  docker/       Container entrypoint (runs nginx + uvicorn together)
  Dockerfile    Multi-stage build: frontend build + backend deps + runtime image
  docs/         Product design docs (onboarding flow, user stories)
```

## Note on This Copy

This repo is a snapshot of the source code as of August 2026, copied out of the original private working repository. It intentionally leaves out internal deployment tooling and infrastructure-specific docs that only made sense inside that original environment — this copy is meant to be read and run standalone.
