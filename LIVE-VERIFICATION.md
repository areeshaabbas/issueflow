# IssueFlow — live verification

Verified on 16 October 2026 against https://issueflow-five.vercel.app/.

**Result: 14 live API checks passed, plus browser verification of the hosted workflow.**

| Area | Result |
|---|---|
| Account registration and sessions | Owner, member, and outsider accounts registered successfully |
| Login/logout | Fresh login restored saved data; logout revoked the captured session token |
| Cookies | Secure, HttpOnly, SameSite=Lax confirmed |
| Projects and membership | Project persisted; added member could access it |
| Issues and assignment | Issue persisted; assigned member resolved correctly |
| Comments | Stored and returned with author and timestamp |
| Search and filtering | Text, status, priority, and assigned-to-me filters returned expected results |
| Validation | Invalid issue input rejected |
| Authorization | Outsider access/updates rejected; member could not edit owner-only project settings |
| Dashboard | Totals reflected issue completion |
| Browser workflow | Registration, project creation, issue creation, comment submission, and completion rendered correctly |
| Reload | Session, project, issue, comment count, and completed dashboard totals survived reload |

Only dedicated synthetic QA accounts and records were created. No real user data was changed or deleted, and no emails were sent. Test records were retained in their own workspaces.

The test source is kept separately from the application source. No private production secrets are included in this report.
