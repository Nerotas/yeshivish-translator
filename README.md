# Yeshivish Translator

## About the app (English)

Jewish communities share a rich heritage, but the words and expressions used in
everyday conversation can vary widely. Yeshivish—with its distinctive blend of
English, Yiddish, Hebrew, and Aramaic—can feel warm and familiar to some people
while being difficult for others to understand.

Yeshivish Translator helps bridge that gap. Its purpose is to make communication
easier among Jews from all walks of life, whether someone grew up speaking
Yeshivish, encounters it only occasionally, or simply wants to better understand
the language and culture surrounding it.

The app translates Yeshivish into clear English for greater understanding and
turns English into expressive Yeshivish for learning, connection, and enjoyment.
It is designed as a welcoming communication aid—one that helps people understand
one another without requiring prior knowledge of specialized vocabulary.

## About the app (Yeshivish)

Di yiddishe kehilas, they have such a rich and beautiful heritage, but the way we schmooze and express ourselves can vary like night and day. Yeshivish—oy, the simcha of it!—with its special blend of English, Yiddish, Hebrew, and even a splash of Aramaic—it's like a warm hug for some, while for others, it can be mamash shver to grasp.

Enter the Yeshivish Translator, a true lifesaver! Its whole tachlis is to help make the conversation flow smooth like a well-aged mashke among Jews from all corners of the globe. Whether you grew up steeped in Yeshivish, bump into it once in a blue moon, or just want to dive deeper into the beauty of our language and culture—it’s got your back.

This app is a treasure! It takes Yeshivish and transforms it into plain, clear English for better comprehension, while also turning English into vibrant, expressive Yeshivish for learning, chaverus, and pure enjoyment. It’s crafted to be a heimish communication tool—creating connections and understanding without needing to be an expert on all those fancy words.

## API authentication

`POST /api/translate/` requires a short-lived bearer token minted by
`POST /api/auth/session/`; it is not a public, permanently embedded secret and
is never compiled into the frontend bundle or persisted in browser storage.
See [docs/authentication.md](docs/authentication.md) for the full threat
model, token lifecycle (issuance, refresh, revocation, key rotation), and the
migration note for existing integrations.

## What it does

Yeshivish Translator supports two directions:

- Yeshivish to plain English
- Plain English to expressive, entertainment-oriented Yeshivish

The application combines a React and TypeScript frontend with a Django REST API.
The API uses the OpenAI Responses API and supplements each request with only the
glossary entries relevant to the submitted text. This keeps prompts focused and
avoids sending the entire glossary with every translation.

## Features

- Two translation directions with a backward-compatible API default
- Context-sensitive glossary matching in both directions
- Deliberately rich, idiomatic English-to-Yeshivish creative rewriting
- Preservation of names, quotations, paragraph breaks, and formatting
- Explicit, persistent light and dark themes
- Input validation and anonymous API throttling
- Automated backend, frontend, API-client, and accessibility-oriented UI tests

## Technology

| Area                      | Technology                            |
| ------------------------- | ------------------------------------- |
| Frontend                  | React, TypeScript, Vite               |
| Frontend testing          | Vitest, Testing Library, jsdom        |
| Frontend linting          | Oxlint                                |
| Backend                   | Python, Django, Django REST Framework |
| AI integration            | OpenAI Python SDK, Responses API      |
| Local database            | SQLite                                |
| Production backend server | Gunicorn                              |

## Repository structure

```text
.
├── backend/
│   ├── config/                 # Django settings, URLs, ASGI, and WSGI
│   ├── translator/             # API views, prompts, glossary logic, and tests
│   │   ├── glossary.json       # Runtime translation glossary
│   │   ├── glossary.py         # Relevant-entry matching and prompt formatting
│   │   ├── prompt.py           # Direction-specific OpenAI instructions
│   │   ├── eval_cases.json      # Representative translation-quality cases
│   │   ├── evals.py             # Deterministic output-contract evaluator
│   │   ├── tests.py            # Backend unit and endpoint tests
│   │   └── views.py            # Translation and health endpoints
│   ├── .env.example
│   ├── manage.py
│   ├── requirements-dev.txt     # Test, coverage, lint, typing, and audit tools
│   └── requirements.txt
├── frontend/
│   ├── e2e/                    # Playwright browser and accessibility tests
│   ├── src/                    # React application, API client, styles, and tests
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
├── .github/workflows/quality.yml
├── Makefile                    # Consolidated local quality commands
├── pyproject.toml              # Ruff and mypy configuration
└── README.md
```

## Prerequisites

- Python 3.10 or newer
- Node.js 20.19 or newer
- npm
- An OpenAI API key
- Bash or a compatible shell for the commands below

## Local setup

### 1. Clone the repository

```bash
git clone https://github.com/Nerotas/yeshivish-translator.git
cd yeshivish-translator
```

### 2. Install the backend

Create the virtual environment at the repository root. The paths in the rest of
this guide assume that location.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements-dev.txt
```

Create the backend environment file:

```bash
cp backend/.env.example backend/.env
```

Generate a Django secret key with Django's own key generator:

```bash
.venv/bin/python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

Copy the output into `backend/.env` as `DJANGO_SECRET_KEY`. Then add your OpenAI
project key as `OPENAI_API_KEY`.

Example development configuration:

```dotenv
OPENAI_API_KEY=replace-with-a-project-key
OPENAI_MODEL=gpt-4o-mini
DJANGO_SECRET_KEY=replace-with-the-generated-secret
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

Initialize the database and start Django:

```bash
.venv/bin/python backend/manage.py migrate
.venv/bin/python backend/manage.py runserver 127.0.0.1:8000
```

The API is now available at `http://127.0.0.1:8000`.

### 3. Install the frontend

In a second terminal:

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:5173` in a browser. The example frontend environment file
points to the default local Django address.

## Environment variables

### Backend

The backend reads `backend/.env` through `python-dotenv`.

| Variable                                | Required | Default                 | Purpose                                                                                           |
| --------------------------------------- | -------- | ----------------------- | ------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`                        | Yes      | None                    | Authenticates OpenAI API requests.                                                                |
| `OPENAI_MODEL`                          | No       | `gpt-4o-mini`           | Selects the model used by the Responses API.                                                      |
| `DJANGO_SECRET_KEY`                     | Yes      | None                    | Signs Django sessions and security-sensitive values.                                              |
| `DJANGO_DEBUG`                          | No       | `false`                 | Enables Django debug mode only when set to `true`.                                                |
| `DJANGO_ALLOWED_HOSTS`                  | No       | `localhost,127.0.0.1`   | Comma-separated hosts Django may serve.                                                           |
| `CORS_ALLOWED_ORIGINS`                  | No       | `http://localhost:5173` | Comma-separated frontend origins allowed to call the API.                                         |
| `DJANGO_SECURE_SSL_REDIRECT`            | No       | `false`                 | Redirects HTTP requests to HTTPS. Enable after HTTPS is configured.                               |
| `DJANGO_SESSION_COOKIE_SECURE`          | No       | `false`                 | Restricts session cookies to HTTPS.                                                               |
| `DJANGO_CSRF_COOKIE_SECURE`             | No       | `false`                 | Restricts CSRF cookies to HTTPS.                                                                  |
| `DJANGO_SECURE_HSTS_SECONDS`            | No       | `0`                     | Enables HTTP Strict Transport Security for the specified lifetime.                                |
| `DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS` | No       | `false`                 | Extends HSTS to subdomains.                                                                       |
| `DJANGO_SECURE_HSTS_PRELOAD`            | No       | `false`                 | Adds the HSTS preload directive.                                                                  |
| `DJANGO_TRUST_X_FORWARDED_PROTO`        | No       | `false`                 | Trusts `X-Forwarded-Proto` from a controlled reverse proxy.                                       |
| `JWT_SIGNING_KEY`                       | No       | `DJANGO_SECRET_KEY`     | Signs short-lived translate session tokens. See [docs/authentication.md](docs/authentication.md). |
| `JWT_PREVIOUS_SIGNING_KEYS`             | No       | (empty)                 | Comma-separated prior signing keys still accepted during key rotation.                            |
| `JWT_ACCESS_TOKEN_TTL_SECONDS`          | No       | `300`                   | Lifetime, in seconds, of a translate session token.                                               |
| `JWT_ISSUER`                            | No       | `yeshivish-translator`  | Issuer claim checked on every session token.                                                      |

### Frontend

| Variable            | Required | Default                 | Purpose                         |
| ------------------- | -------- | ----------------------- | ------------------------------- |
| `VITE_API_BASE_URL` | No       | `http://127.0.0.1:8000` | Base URL used for API requests. |

Vite embeds `VITE_*` values into the frontend bundle at build time. Set the
production API URL before running `npm run build`.

## Generating secrets and hashes from Bash

Secrets and hashes serve different purposes. A secret must be random and kept
private. A hash is a one-way digest used to verify content; it is not a substitute
for a secret key.

### Generate a Django-compatible secret

After installing the backend dependencies:

```bash
.venv/bin/python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

### Generate a general-purpose 256-bit secret

Hexadecimal form:

```bash
openssl rand -hex 32
```

URL-safe form using Python's standard library:

```bash
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
```

### Generate SHA-256 hashes

Hash a file:

```bash
sha256sum path/to/file
```

Hash an exact string without adding a newline:

```bash
printf '%s' 'text-to-hash' | sha256sum
```

Do not commit generated secrets, API keys, `backend/.env`, or
`frontend/.env.local`. The repository's ignore rules exclude those environment
files, but secrets should still be handled through the deployment platform's
secret manager in production.

## API reference

### Health check

```http
GET /api/health/
```

Example:

```bash
curl --fail --silent http://127.0.0.1:8000/api/health/
```

Response:

```json
{
  "status": "ok"
}
```

### Translate text

```http
POST /api/translate/
Content-Type: application/json
```

The request accepts up to 3,000 characters.

#### Yeshivish to English

```bash
curl --fail-with-body \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{"text":"That was mamesh a geshmake shiur.","direction":"yeshivish_to_english","pronunciation_preference":"shabbos"}' \
  http://127.0.0.1:8000/api/translate/
```

#### English to Yeshivish

```bash
curl --fail-with-body \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{"text":"That was a very enjoyable lesson.","direction":"english_to_yeshivish","pronunciation_preference":"shabbat"}' \
  http://127.0.0.1:8000/api/translate/
```

Successful response:

```json
{
  "translation": "That was a very geshmake shiur."
}
```

Supported `direction` values are:

- `yeshivish_to_english`
- `english_to_yeshivish`

For backward compatibility, omitting `direction` defaults to
`yeshivish_to_english`:

```bash
curl --fail-with-body \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{"text":"Mamesh, that was geshmak."}' \
  http://127.0.0.1:8000/api/translate/
```

Supported `pronunciation_preference` values are `shabbos` and `shabbat`.
Omitting the field defaults to `shabbos`. The preference controls generated
transliterated terminology without changing Hebrew script, names, proper nouns,
or quoted source wording.

### API status behavior

| Status | Meaning                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------------- |
| `200`  | Translation completed successfully.                                                                  |
| `400`  | Invalid, empty, oversized, or unsupported request data.                                              |
| `401`  | Missing, malformed, expired, or revoked session token. See `docs/authentication.md`.                 |
| `429`  | A per-IP, per-session, or global request-rate limit was exceeded. See `docs/operations.md`.          |
| `502`  | OpenAI was unavailable or returned an empty translation.                                             |
| `503`  | The global daily cost/usage guardrail was exceeded; OpenAI was not called. See `docs/operations.md`. |

`/api/translate/` requires a short-lived bearer session token (minted via
`POST /api/auth/session/`); CORS controls which browser origins may call it,
but CORS is not itself an authentication mechanism. See
`docs/authentication.md` for the session-token design and
`docs/operations.md` for rate limiting, upstream timeouts/retries, and cost
guardrails.

## How translation works

1. Django validates the input text, translation direction, and pronunciation
   preference.
2. The glossary matcher normalizes the submitted text and finds relevant terms.
3. Overlapping matches prefer the longer phrase, duplicate entries are removed,
   and at most eight glossary entries are selected.
4. The prompt builder resolves dialect-aware glossary terms and combines the
   selected guidance with trusted direction, pronunciation, and task-boundary
   instructions.
5. Django sends those trusted instructions and a separate user-role source-text
   message to the OpenAI Responses API.
6. Structured Outputs require exactly one string field, `translation`; Django
   rejects missing, malformed, extra-field, or empty output.
7. The API returns only the translated text to the frontend.

For Yeshivish-to-English requests, the matcher searches glossary terms and their
variants. For English-to-Yeshivish requests, it searches the English meanings in
each glossary entry. That direction is intentionally entertainment-oriented: the
model is asked to use a high density of authentic Yeshivish language and may
recast the sentence or add brief idiomatic flourishes. It must keep the core
situation and named people recognizable, but it is not constrained to a literal
translation.

### Translation security boundary

The translation endpoint treats submitted text as untrusted content, including
questions, code requests, fake role labels, prompt-extraction requests, and
instructions to change tasks. The trusted prompt tells the model to translate
that content rather than answer or execute it. Source text is never concatenated
into the trusted instructions; it is sent as a separate user-role message.

The endpoint is deliberately non-agentic: it sends no conversation history or
`previous_response_id`, provides an empty tool list, disables response storage,
and caps output at 500 tokens. The default `gpt-4o-mini` model supports
Structured Outputs, and the Python SDK parses its response into a strict
single-field schema. The frontend renders the resulting string through normal
React text interpolation, with no Markdown parser or unsafe HTML rendering.

Prompt injection is not handled with a keyword blacklist. Legitimate source
text such as “ignore previous instructions” remains valid input and is sent to
the model for translation. Regression tests cover both translation directions,
questions, code requests, prompt extraction, fake system messages, quoted
instructions, and maximum-length adversarial input.

## Glossary maintenance

The runtime glossary is `backend/translator/glossary.json`. Every entry must
contain these fields:

```json
{
  "term": "gishmak",
  "variants": ["geshmak", "geshmake"],
  "meanings": ["enjoyable", "delightful"],
  "context_note": "Guidance explaining when the term is natural."
}
```

Additional metadata is allowed. Before committing glossary changes, run the
backend tests. They verify the glossary structure, non-empty meanings, unique
aliases, matching behavior, and the absence of citation/source artifacts in
context notes.

Entries affected by the Shabbos/Shabbat convention include a
`dialect_pattern`, while `term` remains the canonical Shabbos-mode value:

```json
{
  "term": "shacharis",
  "dialect_pattern": "shachari[s|t]",
  "variants": ["shacharit", "shachris"],
  "meanings": ["the morning prayer service"],
  "context_note": "Both forms refer to the same daily morning service."
}
```

Each bracket contains `[shabbos-mode|shabbat-mode]` text. Multiple brackets are
supported, malformed brackets remain literal, and entries without this optional
field are unaffected. Matching continues to use the canonical term and all
variants regardless of the selected output preference.

The current glossary audit marks these canonical entries: `b'ezras Hashem`,
`chosson`, `bris`, `bas mitzvah`, `gut Shabbos`, `Shabbos`, `erev Shabbos`,
`motzaei Shabbos`, `shacharis`, `chavrusa`, `beis midrash`, `shomer Shabbos`,
and `hashgacha pratis`. Entries without an explicit two-form relationship were
left unchanged; the implementation never performs a blanket `s`-to-`t`
conversion.

The glossary loader is cached per backend process. Restart long-running backend
workers after changing `glossary.json`.

## Testing and quality checks

Install the backend development dependencies and frontend dependencies before
running the complete local pipeline:

```bash
python -m pip install -r backend/requirements-dev.txt
npm --prefix frontend ci
npm --prefix frontend exec playwright install chromium
make check
make audit
```

`make check` runs backend linting and formatting checks, strict Python type
checking, frontend type checking and linting, production frontend compilation,
unit tests with enforced coverage thresholds, deterministic translation-quality
evals, and Playwright browser tests. It does not call OpenAI and therefore does
not spend API credits.

Useful focused commands are:

```bash
make test             # Backend and frontend unit tests
make coverage         # Both unit suites with coverage reports and thresholds
make backend-check    # Ruff and strict mypy
make frontend-check   # TypeScript, Oxlint, and production build
make eval             # Committed translation-output contract examples
make e2e              # Chromium UI and accessibility tests
make audit            # Python and npm dependency vulnerability audits
```

Backend branch measurement is enabled, and aggregate measured coverage must
remain at or above 90%.
Frontend thresholds are 90% for statements, functions, and lines, and 85% for
branches. Reports are written to `coverage/backend-html/`,
`coverage/backend.xml`, and `coverage/frontend/`; generated reports are ignored
by Git.

The backend suite mocks OpenAI while verifying the complete request contract,
direction-specific prompts, glossary filtering, validation, throttling, and
error handling. The eval cases check representative translations for required
and forbidden vocabulary, paragraph and quotation preservation, and citation
artifacts. These deterministic evals protect the output contract, but model
quality can still vary; periodically review real translations when changing the
model, prompts, or glossary.

The frontend suite covers both directions, theme persistence, request failures,
empty submissions, and pending requests. Playwright verifies the integrated UI
flow with a mocked API and runs Axe accessibility scans in light and dark modes.

GitHub Actions runs the same checks for every pull request and for pushes to
`main`. Coverage artifacts are attached to each workflow run. The workflow is
defined in `.github/workflows/quality.yml`.

## Production operation

This repository does not include a container image, reverse-proxy configuration,
or infrastructure definition. A production deployment needs to operate the
backend and frontend separately.

### Backend

Set production environment values outside source control, including:

```dotenv
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=api.example.com
CORS_ALLOWED_ORIGINS=https://translator.example.com
OPENAI_API_KEY=replace-through-your-secret-manager
DJANGO_SECRET_KEY=replace-through-your-secret-manager
DJANGO_SECURE_SSL_REDIRECT=true
DJANGO_SESSION_COOKIE_SECURE=true
DJANGO_CSRF_COOKIE_SECURE=true
DJANGO_SECURE_HSTS_SECONDS=31536000
DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=true
DJANGO_SECURE_HSTS_PRELOAD=true
DJANGO_TRUST_X_FORWARDED_PROTO=true
```

Apply migrations and start Gunicorn from the repository root:

```bash
.venv/bin/python backend/manage.py migrate
.venv/bin/gunicorn \
  --chdir backend \
  --bind 127.0.0.1:8000 \
  --workers 2 \
  config.wsgi:application
```

Run Gunicorn behind an HTTPS reverse proxy or managed application platform.
Choose the worker count for the available memory and expected concurrency rather
than treating the example value as universal.

Only enable `DJANGO_TRUST_X_FORWARDED_PROTO` when the application receives
traffic exclusively through a trusted proxy that overwrites the header. Roll
out HSTS carefully: browsers remember it, `includeSubDomains` affects every
subdomain, and preload enrollment has additional external requirements. Validate
the final environment before deployment:

```bash
DJANGO_DEBUG=false .venv/bin/python backend/manage.py check --deploy
```

The included SQLite database is suitable for local development and small,
single-instance deployments. Evaluate a production database before running
multiple application instances. Set `REDIS_URL` before running more than one
worker/instance so rate limits, session-token revocation, and cost guardrails
are enforced consistently across all of them - see `docs/operations.md`.

### Frontend

Set the public API address before building:

```bash
cd frontend
npm ci
VITE_API_BASE_URL=https://api.example.com npm run build
```

Serve `frontend/dist/` from a static host or web server. The Vite preview server
is for local verification, not production hosting.

### Operational checks

- Monitor `GET /api/health/` for backend availability.
- Confirm the production frontend origin exactly matches an entry in
  `CORS_ALLOWED_ORIGINS`, including its scheme and port.
- Treat `502` responses as upstream/model failures and inspect backend logs.
- Treat `429` responses as expected throttling before increasing limits.
- Treat `503` responses as the global cost/usage guardrail tripping; see
  `docs/operations.md` for tuning and incident response.
- Rotate exposed OpenAI or Django secrets immediately and restart backend workers.
- Never enable `DJANGO_DEBUG` in production.

## Troubleshooting

### Django reports that `DJANGO_SECRET_KEY` is missing

Confirm `backend/.env` exists and contains a non-empty value. Django loads this
file relative to the backend directory, regardless of the shell's current
directory.

### The frontend cannot reach Django

Check all three locations:

1. Django is listening at the URL in `VITE_API_BASE_URL`.
2. The frontend's exact origin is listed in `CORS_ALLOWED_ORIGINS`.
3. `DJANGO_ALLOWED_HOSTS` contains the hostname used to reach Django.

Restart Vite after changing `.env.local`. Rebuild the frontend after changing a
production `VITE_*` variable.

### The API returns `502`

Verify `OPENAI_API_KEY`, the configured `OPENAI_MODEL`, outbound network access,
and OpenAI account/project availability. The backend logs the underlying
exception while returning a generic message to the client.

### The selected theme does not follow the operating system

This is intentional. Light and dark modes are explicit user choices. The browser
stores the selection under `yeshivish-translator-theme` in local storage.

## Security notes

- Submitted translation text is sent to OpenAI. Do not submit sensitive content
  unless that processing is appropriate for your use case and policies.
- Keep `.env` files and credentials out of version control.
- Use distinct secrets for development, staging, and production.
- Restrict allowed hosts and CORS origins to the deployed domains.
- Terminate TLS before requests reach the application.
- Review rate limits, authentication, logging, retention, and abuse controls
  before opening the service to untrusted public traffic.

## License

No license file is currently included. Unless a license is added, repository
access does not itself grant permission to copy, modify, or redistribute the
software.
