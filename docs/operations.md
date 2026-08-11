# Operations: Abuse Controls, Cost Guardrails, and Monitoring

This document covers the production-hardening measures protecting the
OpenAI-backed `/api/translate/` and `/api/auth/session/` endpoints: shared
rate limiting, upstream request resilience, privacy-conscious logging, and
global cost/usage guardrails. See [`docs/authentication.md`](authentication.md)
for the session-token design these controls sit alongside.

## Shared, cache-backed rate limiting

All throttle counters live in Django's cache framework
(`django.core.cache.cache`), not in process memory. Configure `REDIS_URL` in
production so every worker/instance shares the same counters:

```
REDIS_URL=redis://:password@host:6379/0
```

- When `REDIS_URL` is set, `CACHES["default"]` uses Django's built-in
  `RedisCache` backend.
- When it is unset, the app falls back to in-process `LocMemCache` so local
  development and CI (which has no Redis service) keep working without extra
  setup. If `DJANGO_DEBUG=false` and `REDIS_URL` is unset, a `RuntimeWarning`
  is emitted at startup - treat that warning as a production misconfiguration
  to fix, since limits and revocations will only be enforced per-process.

### Throttle scopes

Three independent "kinds" of limit are applied to the billable/handshake
endpoints, each with its own env-configurable rate:

| Scope                 | Endpoint             | Keyed by                       | Env var                             | Default     |
| --------------------- | -------------------- | ------------------------------ | ----------------------------------- | ----------- |
| `translate`           | `/api/translate/`    | client IP                      | `THROTTLE_RATE_TRANSLATE_IP`        | `60/hour`   |
| `translate_session`   | `/api/translate/`    | session token (`jti`)          | `THROTTLE_RATE_TRANSLATE_SESSION`   | `120/hour`  |
| `translate_global`    | `/api/translate/`    | nothing (single shared bucket) | `THROTTLE_RATE_TRANSLATE_GLOBAL`    | `2000/hour` |
| `auth_session`        | `/api/auth/session/` | client IP                      | `THROTTLE_RATE_AUTH_SESSION_IP`     | `30/hour`   |
| `auth_session_global` | `/api/auth/session/` | nothing (single shared bucket) | `THROTTLE_RATE_AUTH_SESSION_GLOBAL` | `600/hour`  |
| `anon`                | any other DRF view   | client IP                      | `THROTTLE_RATE_ANON`                | `60/hour`   |

A request is rejected with `429` if it exceeds _any_ applicable scope. The
per-IP scopes bound damage from a single abusive client; the global scopes
bound aggregate OpenAI spend regardless of how the traffic is distributed
across IPs or sessions (e.g. a botnet). There is no long-lived user account in
this app (see `docs/authentication.md`), so the session-token `jti` is the
closest available "authenticated-user" identity; requests with no valid
session are not throttled on that dimension; the IP-keyed throttle still
applies as a fallback.

### Trusted proxy configuration and client IP derivation

Client IP-based throttling reads `REMOTE_ADDR` unless the app is told to trust
one or more reverse proxies in front of it:

```
TRUSTED_PROXY_COUNT=1
```

This feeds Django REST Framework's built-in `NUM_PROXIES` setting. With
`TRUSTED_PROXY_COUNT=0` (the default), `X-Forwarded-For` is ignored entirely
and only `REMOTE_ADDR` (the direct TCP peer) is trusted - safe by default, but
incorrect if requests pass through a load balancer or CDN, in which case every
request will appear to come from the proxy's own IP.

Set `TRUSTED_PROXY_COUNT` to the exact number of reverse proxy hops between
the internet and this app (e.g. `1` behind a single load balancer). DRF then
reads the client's real IP as the entry `TRUSTED_PROXY_COUNT` positions from
the _right_ end of `X-Forwarded-For` - the entry added by the outermost
trusted proxy - rather than the leftmost, client-supplied (and therefore
spoofable) claim. Setting this value too high trusts attacker-supplied
`X-Forwarded-For` entries as if they were real client IPs; setting it too low
(e.g. leaving it at `0` in front of a real proxy) throttles all traffic as a
single client.

## OpenAI request resilience

The OpenAI client is constructed with explicit connect/read timeouts and a
small, bounded retry count - never silent or indefinite retries of a billable
request:

```
OPENAI_CONNECT_TIMEOUT_SECONDS=5
OPENAI_READ_TIMEOUT_SECONDS=20
OPENAI_MAX_RETRIES=1
```

`OPENAI_MAX_RETRIES` is passed straight through to the OpenAI SDK's own
`max_retries`, which only retries a small set of transient failure classes
(connection errors, timeouts, and 5xx/429 responses) with backoff, and never
retries indefinitely. The Django view itself does not add a second retry loop
on top of this - a failure results in exactly one call to the OpenAI client
per incoming request (verified in
`backend/translator/test_translate_resilience.py`).

Failures are classified for logging/alerting purposes (`timeout`,
`connection_error`, `rate_limited`, or generic `error`), but the HTTP response
returned to the caller is always the same generic
`{"error": "Translation is temporarily unavailable."}` with status `502` -
upstream error details, provider messages, and stack traces are never exposed
through the API.

## Structured logging (privacy-conscious)

`translator.views` logs one structured line per `/api/translate/` call with
the caller-visible outcome and cost-relevant metadata:

- `model`, `direction`, `latency_ms`, `status` (`success`, `timeout`,
  `connection_error`, `rate_limited`, or `error`), and on success
  `input_tokens`/`output_tokens`.
- The submitted text and the translated output are **never** included in any
  log line, in either the success or failure path. This is enforced by
  `test_never_logs_the_submitted_text_or_translation` and
  `test_failure_logs_do_not_include_the_submitted_text` in
  `backend/translator/test_translate_resilience.py`.

## Global cost/usage guardrails

Independent of the per-caller throttles above, `backend/translator/guardrails.py`
tracks cumulative OpenAI usage in a rolling 24-hour window (via the same
shared cache) and blocks _all_ further OpenAI calls once either budget is hit

- protecting against aggregate cost blowouts that no single-caller throttle
  would catch (e.g. many distinct IPs/sessions each staying under their own
  limit):

```
OPENAI_INPUT_COST_PER_MILLION_TOKENS=0.15
OPENAI_OUTPUT_COST_PER_MILLION_TOKENS=0.60
DAILY_COST_BUDGET_USD=20
DAILY_REQUEST_BUDGET=5000
```

When a budget is exceeded, `/api/translate/` returns `503` **without calling
OpenAI at all**, and an `ERROR`-level log line is emitted:

```
OPENAI_COST_GUARDRAIL_TRIPPED reason=request_budget requests=<n> budget=<n>
OPENAI_COST_GUARDRAIL_TRIPPED reason=cost_budget estimated_cost_usd=<x> budget_usd=<x>
```

Configure log-based alerting (e.g. a Railway/log-provider alert rule) to match
`OPENAI_COST_GUARDRAIL_TRIPPED` so a tripped guardrail is actionable rather
than silent. Adjust `OPENAI_*_COST_PER_MILLION_TOKENS` if `OPENAI_MODEL`
changes to a differently priced model.

## Incident response

1. **Elevated 429s or a tripped cost guardrail**: check logs for
   `OPENAI_COST_GUARDRAIL_TRIPPED` and for spikes in `status=success` request
   volume from `translate_request` log lines. Identify whether traffic is
   concentrated (a few IPs/sessions - the per-IP/session throttles should
   already be containing this) or distributed (many distinct callers - the
   global throttles and cost guardrail are the relevant defenses).
2. **Suspected key/token abuse**: revoke the specific session token via
   `POST /api/auth/session/revoke/` if it is known, or rotate
   `OPENAI_API_KEY` (and redeploy) if the upstream credential itself may be
   compromised. Session tokens are short-lived (`JWT_ACCESS_TOKEN_TTL_SECONDS`,
   default 300s) and self-expire.
3. **Tuning budgets/rates**: adjust the relevant `THROTTLE_RATE_*`,
   `DAILY_COST_BUDGET_USD`, or `DAILY_REQUEST_BUDGET` env var and redeploy.
   Prefer raising the narrowest applicable scope (e.g. a single IP's rate)
   over the global scopes when the issue is one abusive caller, to avoid
   loosening protection for everyone else.
4. **Redis unavailable**: throttling, revocation, and guardrail checks all
   depend on the shared cache backend. If Redis is unreachable, requests to
   `/api/translate/` and `/api/auth/session/` may start failing outright
   rather than silently skipping enforcement - check Redis connectivity/health
   first, since this also affects session-token revocation
   (`docs/authentication.md`).
