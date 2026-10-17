# IssueFlow live deployment

Public application: https://issueflow-five.vercel.app/

API health: https://issueflow-five.vercel.app/api/health

API documentation: https://issueflow-five.vercel.app/api/docs

- Vercel project: `areesha-abbas-projects/issueflow`, on Hobby.
- Application: React frontend and FastAPI backend, served from the same origin.
- Database: Neon project `issueflow` (`young-glade-97592948`), PostgreSQL 17, on Free.
- Production build: `dpl_77aZadZBT4wKNSvvdp2aGPAt6U1w`.
- Secrets: `DATABASE_URL` and `JWT_SECRET` are stored as private production variables in Vercel. They are excluded from source and the source archive.
- No paid plan or paid domain was enabled.

The public domain is `issueflow-five.vercel.app`. Vercel's team and per-deployment URLs can require Vercel sign-in; use the public domain for recruiter links.

This deployment was uploaded directly using Vercel CLI. It is not connected to GitHub auto-deployment. Local changes do not go live until a new deployment is uploaded and promoted.

Free plans have quotas and may cold-start after inactivity. Review usage in the providers' dashboards if traffic increases.
