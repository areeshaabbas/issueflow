# IssueFlow

A team issue tracker built with React, TypeScript, FastAPI, and PostgreSQL.

[![Checks](https://github.com/areeshaabbas/issueflow/actions/workflows/ci.yml/badge.svg)](https://github.com/areeshaabbas/issueflow/actions/workflows/ci.yml)

[Live application](https://issueflow-five.vercel.app/) · [API reference](https://issueflow-five.vercel.app/api/docs)

Create a project, add another registered user as a member, and track issues through Todo, In Progress, and Done. Issues support assignment, four priority levels, comments, search, and filtering. The dashboard summarizes issues across projects you belong to.

## Run locally

Requirements: Python 3.13 and Node.js 22 or later.

On Windows, `./start.ps1` installs missing dependencies and starts the API and frontend. Open http://127.0.0.1:5173. Run `./stop.ps1` when finished.

For manual setup, from `backend/`:

```sh
python -m venv .venv
# Activate .venv using the command for your shell.
python -m pip install -r requirements.txt
# Copy .env.example to .env and set a random JWT_SECRET.
python -m uvicorn app.main:app --reload --port 8000
```

In a second terminal, from `frontend/`:

```sh
npm ci
npm run dev
```

Local development defaults to SQLite. To use PostgreSQL, set `DATABASE_URL` in `backend/.env`. Local data is separate from the hosted database.

## Permissions

Project members can create, assign, edit, and delete issues and add comments. Only the owner can edit or delete the project and add members. An assignee must belong to the project. Resource lookups, listings, and dashboard totals all check membership.

## Code layout

```text
frontend/src/
  App.tsx            Workspace navigation, data loading, and page layout
  components/        Auth, project/issue forms, issue detail, members, shared UI
  lib/               API client and display helpers
  types.ts           API response types
backend/app/
  main.py            Routes, authentication, and access checks
  schemas.py         Request validation and allowed statuses/priorities
  database.py        Settings, SQLAlchemy models, and sessions
backend/tests/       API and regression tests
app.py               Vercel entrypoint; mounts API at /api
```

## Checks

From `backend/`, run `python -m pytest -q`. From `frontend/`, run `npm run build` for TypeScript checks and the production build. GitHub Actions runs the backend tests, a PostgreSQL smoke test, the frontend build, and a Docker Compose check through nginx on pushes and pull requests. Test database credentials are disposable fixtures; CI does not use the production database.

The tests cover permissions as well as successful requests: outsider access, member versus owner operations, assignee validation, revoked sessions, password handling, and query growth when an issue page gets larger.

## Hosting and Docker

The live app uses one Vercel project for the React frontend and Python API, with PostgreSQL on Neon. Authentication uses an HttpOnly cookie on the same origin. Production secrets are configured in Vercel and excluded from source.

For Docker, copy the root `.env.example` to `.env`, replace both secrets, start Docker, then run `docker compose up --build -d`. Open http://localhost:8080. `docker compose down` preserves the database volume.

Docker is an alternative local environment, while the hosted app uses Vercel Functions. See [CI and deployment](docs/ci-and-deployment.md) for how checks and releases fit together.

See [architecture and tradeoffs](docs/architecture.md), [hosting setup](HOSTING.md), and [deployment details](DEPLOYMENT.md).

## Current limits

Members are added by their existing account email; email invitations and member removal are not implemented. There is no password recovery, email verification, or audit trail. Schema creation currently runs on startup rather than through migrations. Free hosting can cold-start after inactivity.

Before using this for a real team's private work, the next priorities are migrations, account recovery, and durable login rate limiting.
