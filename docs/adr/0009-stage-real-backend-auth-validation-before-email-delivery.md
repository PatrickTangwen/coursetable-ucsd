# Stage Real Backend Auth Validation Before Email Delivery

Beta-1 auth rollout will first validate the UCSD email auth path against a real backend stack: Postgres schema, Redis-backed sessions, API routes, frontend login, and Saved Search ownership by internal app user ID. Production-like email delivery is a separate follow-up decision and should not be bundled into that validation pass, because it adds distinct abuse, deliverability, secret-management, privacy, and rate-limiting risks that need their own acceptance criteria.

The next validation issue should prove the real database/session path while using a dev or test verification-code seam. A later Email Delivery beta or PRD can then choose a provider, harden rate limits and verification-code storage, configure sender-domain credentials, and define user-facing failure/retry behavior.
