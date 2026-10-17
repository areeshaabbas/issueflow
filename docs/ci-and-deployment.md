# Checks and deployment

The `IssueFlow checks` GitHub Actions workflow runs on pushes and pull requests:

- Backend: isolated SQLite API tests plus a disposable PostgreSQL 17 smoke test.
- Frontend: install from the lockfile, check TypeScript, and build production assets.
- Docker: build both images, start PostgreSQL/API/nginx, then check the web page and `/api/health` through the proxy. Containers and test volumes are removed afterward.

Jobs have timeouts, read-only repository permissions, and cancel superseded runs. No production credentials are needed by these jobs.

## Vercel releases

The existing Vercel project is `issueflow`; its root directory must be this repository's root, not `frontend/`. Keep `DATABASE_URL` and `JWT_SECRET` in Vercel project settings. Do not copy them into GitHub or commit environment files.

Connect this repository to the existing Vercel project to enable Git deployments. Set `main` as the production branch. Vercel can build pull-request previews and deploy production pushes independently of GitHub Actions. A passing Actions run is not automatically a deployment gate; review the checks before merging. Do not point untrusted previews at the production database; configure a separate preview database and session secret before enabling functional preview testing.

Until the Git connection is configured, deployments remain manual through Vercel CLI. This repository does not contain a second deployment workflow or Vercel account token.

## Docker locally

Docker Compose provides PostgreSQL, the Python API, and an nginx server for the frontend. Copy `.env.example` to `.env`, replace both placeholder secrets, and run `docker compose up --build -d`. Open http://localhost:8080. Stop with `docker compose down`; the named database volume preserves local data. Docker is not needed to visit or operate the hosted app.
