# Authentication & Access Control Design

## Threat model

- `POST /api/translate/` proxies to OpenAI's paid Responses API. Any caller who
  can reach the endpoint consumes billable OpenAI usage, whether or not they
  use the real frontend.
- The frontend is a public static SPA (Vite build, e.g. served from GitHub
  Pages) with no server-side component. Anything compiled into the bundle -
  environment variables, constants, "hidden" secrets - is readable by any
  visitor via view-source, the network tab, or by unpacking the built JS.
- There are no user accounts, no login form, and no product requirement to
  force sign-in: per the README, the app's value is frictionless anonymous
  translation for anyone in the community. Historically the only defenses were
  `CORS_ALLOWED_ORIGINS` (a browser-enforced boundary that does nothing
  against direct `curl`/script access) and a per-IP `AnonRateThrottle`
  (60/hour).
- Primary risks: (1) scripts calling `/api/translate/` directly, bypassing
  CORS entirely; (2) scraping/automation driving up OpenAI cost; (3) a
  long-lived credential embedded in a public bundle being extracted once and
  reused indefinitely.

## Decision: short-lived anonymous session tokens (JWT), not user accounts

- Requiring real user accounts (signup/login/password reset/email
  verification) would contradict the product's anonymous-by-design goal and
  add UX scope disproportionate to a stateless translation tool. Anonymous
  access is intentionally kept for the translate flow.
- A JWT is still appropriate here because it represents a **trusted client
  handshake**, not a permanent embedded secret: the frontend calls
  `POST /api/auth/session/` to mint a token immediately before it is needed.
  Nothing is compiled into the Vite bundle, stored in `localStorage`, or
  persisted in any way - the token lives only in memory for the life of the
  tab.
- Because the token does not represent a real identity, it does not replace
  abuse protection - it raises the cost of abuse by requiring every caller
  (including direct API scripts) to pass a separately and more strictly
  throttled handshake, and by making any captured token expire in minutes.
- `POST /api/auth/session/` itself remains anonymous by necessity (there is no
  account to authenticate the handshake against), so it is the endpoint that
  the **separate anonymous API-hardening work** should target: it has its own
  `auth_session` throttle scope (tighter than the general anonymous rate),
  performs no OpenAI or database work, and follows the same CORS/error-shape
  rules as every other endpoint. Coordinating scope names (`auth_session` vs.
  `translate`) lets that hardening work (IP reputation, CAPTCHA, WAF rules,
  etc.) plug in without conflicting with this change.

## Token lifecycle

- **Issuance** - `POST /api/auth/session/` (`AllowAny`, `auth_session`
  throttle scope) returns `{"access_token", "token_type": "Bearer",
"expires_in"}`. No request body or identity is required.
- **Expiry** - default 300 seconds (`JWT_ACCESS_TOKEN_TTL_SECONDS`), enforced
  via the standard `exp` claim.
- **Refresh** - there is no separate, longer-lived refresh token, because the
  access token carries no persistent identity to bind one to. "Refresh" is
  simply calling `/api/auth/session/` again. The frontend does this
  automatically when its cached token is missing or near expiry, and once
  more after any `401` from `/api/translate/`, retrying the translation
  exactly once with the fresh token.
- **Logout / revocation** - `POST /api/auth/session/revoke/` (requires a
  currently-valid bearer token) adds the token's `jti` to a cache-backed
  denylist for the remainder of its natural lifetime, so a token known to be
  compromised (e.g. captured in a proxy log) can be killed immediately instead
  of waiting out its short TTL. The frontend treats "logout" as simply
  dropping its in-memory token; there is no persistent session to end because
  none was created.
- **Key rotation** - signing uses `JWT_SIGNING_KEY` (falls back to
  `DJANGO_SECRET_KEY` when unset). To rotate: set a new `JWT_SIGNING_KEY` and
  move the previous value into `JWT_PREVIOUS_SIGNING_KEYS` (comma-separated).
  Verification tries the active key first, then each previous key in order,
  so tokens minted moments before a rotation keep validating until they
  expire naturally (at most `JWT_ACCESS_TOKEN_TTL_SECONDS`). Remove old keys
  from `JWT_PREVIOUS_SIGNING_KEYS` once that window has passed.

## What is preserved

- CORS, CSRF, cookie, and error-handling behavior are unchanged. These
  endpoints still return generic error bodies (no stack traces, no upstream
  OpenAI error passthrough), browser calls still require an allowed `Origin`,
  and no session cookies are used, so CSRF protection - which DRF only applies
  to `SessionAuthentication` - remains not applicable, exactly as before.
- `/api/translate/`'s success response shape (`{"translation": "..."}`),
  validation status codes, and the `direction` field/default are unchanged.

## Breaking change / migration for existing integrations

- `/api/translate/` now requires `Authorization: Bearer <token>` and returns
  `401` when it is missing, malformed, expired, or revoked.
- Any caller (this repository's frontend, or any external script) must call
  `POST /api/auth/session/` first and attach the returned token to the
  `Authorization` header of the translate request.
- This project has no known external API consumers today - the only client is
  this repository's frontend, which is updated in the same change. If
  external consumers exist in the future, provide a time-boxed transition
  window where missing credentials are logged rather than rejected before
  enforcing `401`s.

## Known limitations

- The revocation denylist uses Django's cache (`CACHES["default"]`), which is
  in-process `LocMemCache` unless `REDIS_URL` is configured. As of the shared
  throttling work described in [`docs/operations.md`](operations.md), setting
  `REDIS_URL` gives both the revocation denylist and all rate-limit counters
  correct cross-worker/cross-instance enforcement automatically - see
  `docs/operations.md` for configuration and monitoring details. Deployments
  that leave `REDIS_URL` unset in production get a `RuntimeWarning` at
  startup and only per-process enforcement, same as before this change.
