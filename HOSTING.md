# Live hosting: Vercel + Neon Free

The root folder is configured as **one Vercel FastAPI project**. React is built at deployment time and served through Vercel's static file support. Requests to `/api/*` reach the existing Python backend. Cookies stay on the same origin; no separate backend domain or cross-site cookie workaround is needed.

## Deployment settings

- Project root: this directory, containing `app.py` and `vercel.json` (not `frontend/`).
- Framework: FastAPI.
- Build: the checked-in build command installs frontend dependencies and creates the production bundle.
- Python: 3.13.
- Database: a **new dedicated Neon Free PostgreSQL project**, using its pooled connection URL with `sslmode=require`.
- Vercel account: Hobby, within its personal/non-commercial usage rules and resource limits.
- No paid plan, paid domain, or credit-card upgrade is required for this intended setup. Limits and plan rules still apply.

Set these as private Vercel environment variables before the first deployment:

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon pooled PostgreSQL URL; never put this in the frontend |
| `JWT_SECRET` | Random secret of at least 32 characters, stable across deployments |
| `COOKIE_SECURE` | `true` (also enforced automatically on Vercel) |
| `CORS_ORIGINS` | Exact production URL, including `https://`; built-in Vercel production and deployment URLs are also trusted from Vercel environment metadata |

Keep the database region close to the Vercel function region. Free database/serverless compute may need a cold start after inactivity; performance is not guaranteed to match an always-running paid server.

The app creates its tables on startup. Use a dedicated database; this is not a migration tool for an existing database. Local SQLite data is not uploaded.

## Before recruiter handoff

1. Confirm the production deployment can be opened without signing into Vercel.
2. Check `/api/health` and `/api/docs`.
3. Register a test account, create a project and issue, change status, comment, reload, and log out.
4. Confirm the data survives a new deployment and that one account cannot access another account's projects.
5. Add a small demonstration workspace or demo access before putting the URL on the CV.

Account connection and hosted verification are required before this can be called a live deployment. The repository configuration alone does not publish the project.

Sources checked on 15 October 2026:

- [Vercel FastAPI support](https://vercel.com/docs/frameworks/backend/fastapi)
- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)
- [Neon Free pricing](https://neon.com/pricing)
