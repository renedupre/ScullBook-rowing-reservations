---
name: Embedded preview sessions
description: Browser cookie restrictions can make login succeed while every protected request fails in the embedded preview.
---

Verify session-based authentication in a cross-site iframe, not only through curl or a top-level app tab. Use HTTPS Secure, SameSite=None, partitioned HttpOnly cookies for the embedded context, with matching attributes on renewal and logout.

**Why:** A real user could log in successfully but every following request lacked the cookie. Curl's cookie jar passed the same flow because it does not enforce third-party browser restrictions. The externally observed cookie header already showed SameSite=None despite the original server setting, so inspecting that attribute alone was insufficient.

**How to apply:** Preserve partitioned-cookie support when changing session handling. Do not replace it with a browser-readable token. Verify login, a protected mutation, reload persistence, and logout in an embedded browser context. Clear stale client identity when a protected request returns 401 instead of leaving the user on a retry-only dashboard.
