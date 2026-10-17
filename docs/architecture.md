# Architecture and tradeoffs

## Request path

React calls `/api` on the same origin. Vite proxies that prefix during local development; the root FastAPI application mounts the backend there on Vercel. The shared origin keeps session cookies straightforward without storing tokens in browser local storage.

Each request opens a SQLAlchemy session through a FastAPI dependency. Route handlers validate project membership before reading or changing project resources. Issues reference their project, creator, and optional assignee. Comments reference an issue and an author. Foreign-key cascades delete project issues and their comments together.

## Authentication

Passwords are hashed with Argon2. JWTs expire after 12 hours and carry a stored session ID. Checking that ID on each authenticated request makes logout immediate, at the cost of a database lookup. Production cookies are Secure, HttpOnly, and SameSite=Lax. Cookie-authenticated writes require a trusted Origin. Bearer tokens are accepted for API clients.

Password whitespace is preserved. Names and other text inputs are trimmed, but applying that normalization to passwords would silently change credentials.

## List queries

Issue lists paginate before serializing rows. Related assignees, projects, and comment counts are fetched in batches for the page, so adding rows does not add one database query per issue. A regression test checks that query growth stays bounded.

The project summaries still use simple per-project aggregation queries. This is acceptable for the current small workspace, but would need batching if accounts had many projects.

## Serverless deployment

Neon's pooled PostgreSQL endpoint is used with SQLAlchemy's NullPool on Vercel. The application does not keep an extra pool in every function instance. A PostgreSQL advisory lock serializes startup schema creation across simultaneous cold starts.

Startup schema creation keeps the initial deployment small, but it is not a migration strategy. A populated deployment should move to versioned migrations before changing the schema.

## Frontend boundaries

`App.tsx` owns navigation and workspace data. Forms and dialogs live in separate components; API requests and formatting are shared helpers. The interface keeps status changes explicit rather than relying on drag-and-drop as the only way to move an issue.

Dialogs keep keyboard handling stable while parent data refreshes. Comment requests discard late responses after switching issues, so one issue's discussion cannot appear in another issue's detail panel.

## Scope

This is a small application with one backend and a relational database. There is no background worker or distributed cache because the implemented workflow does not need either. Account recovery, migrations, and login rate limiting are more useful next steps than adding infrastructure.
