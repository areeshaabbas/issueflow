# Verification

## 17 October 2026

- Backend: 11 tests passed using isolated SQLite databases. One upstream Starlette/httpx deprecation warning was emitted.
- Frontend: TypeScript checks and Vite production build passed.
- Hosted browser checks: sign-in, saved issues, project navigation after reload, and board-column issue status defaults passed.
- Public frontend and `/api/health` responded successfully after the latest release.
- Docker Compose configuration validates. Docker Desktop was not running locally; the GitHub workflow builds and starts the full stack in a disposable runner.
- GitHub workflow results are available from the checks badge in README once this repository is published. Local results do not imply a GitHub run has passed.

See LIVE-VERIFICATION.md for the earlier end-to-end hosted API checks. No production database credentials or QA passwords are published.
