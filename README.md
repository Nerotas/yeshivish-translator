# Yeshivish Translator

Yeshivish Translator is a two-direction translation application for converting:

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

| Area | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Frontend testing | Vitest, Testing Library, jsdom |
| Frontend linting | Oxlint |
| Backend | Python, Django, Django REST Framework |
| AI integration | OpenAI Python SDK, Responses API |
| Local database | SQLite |
| Production backend server | Gunicorn |

## Repository structure

```text
.
├── backend/
│   ├── config/                 # Django settings, URLs, ASGI, and WSGI
│   ├── translator/             # API views, prompts, glossary logic, and tests
│   │   ├── glossary.json       # Runtime translation glossary
│   │   ├── glossary.py         # Relevant-entry matching and prompt formatting
│   │   ├── prompt.py           # Direction-specific OpenAI instructions
│   │   ├── tests.py            # Backend unit and endpoint tests
│   │   └── views.py            # Translation and health endpoints
│   ├── .env.example
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/                    # React application, API client, styles, and tests
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
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
python -m pip install -r backend/requirements.txt
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

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | Yes | None | Authenticates OpenAI API requests. |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Selects the model used by the Responses API. |
| `DJANGO_SECRET_KEY` | Yes | None | Signs Django sessions and security-sensitive values. |
| `DJANGO_DEBUG` | No | `false` | Enables Django debug mode only when set to `true`. |
| `DJANGO_ALLOWED_HOSTS` | No | `localhost,127.0.0.1` | Comma-separated hosts Django may serve. |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:5173` | Comma-separated frontend origins allowed to call the API. |

### Frontend

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | No | `http://127.0.0.1:8000` | Base URL used for API requests. |

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
  --data '{"text":"That was mamesh a geshmake shiur.","direction":"yeshivish_to_english"}' \
  http://127.0.0.1:8000/api/translate/
```

#### English to Yeshivish

```bash
curl --fail-with-body \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{"text":"That was a very enjoyable lesson.","direction":"english_to_yeshivish"}' \
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

### API status behavior

| Status | Meaning |
| --- | --- |
| `200` | Translation completed successfully. |
| `400` | Invalid, empty, oversized, or unsupported request data. |
| `429` | Anonymous request limit exceeded. The configured limit is 60 requests per hour. |
| `502` | OpenAI was unavailable or returned an empty translation. |

The translation endpoint is intentionally unauthenticated. CORS controls which
browser origins may call it, but CORS is not an authentication mechanism. Add an
authentication layer before exposing the endpoint where anonymous access is not
appropriate.

## How translation works

1. Django validates the input text and translation direction.
2. The glossary matcher normalizes the submitted text and finds relevant terms.
3. Overlapping matches prefer the longer phrase, duplicate entries are removed,
   and at most eight glossary entries are selected.
4. The prompt builder combines the selected glossary guidance with the system
   instructions for the requested direction.
5. Django sends the source text and instructions to the OpenAI Responses API.
6. The API returns only the translated text to the frontend.

For Yeshivish-to-English requests, the matcher searches glossary terms and their
variants. For English-to-Yeshivish requests, it searches the English meanings in
each glossary entry. That direction is intentionally entertainment-oriented: the
model is asked to use a high density of authentic Yeshivish language and may
recast the sentence or add brief idiomatic flourishes. It must keep the core
situation and named people recognizable, but it is not constrained to a literal
translation.

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

The glossary loader is cached per backend process. Restart long-running backend
workers after changing `glossary.json`.

## Testing and quality checks

### Backend

From the repository root:

```bash
.venv/bin/python backend/manage.py test translator
```

The OpenAI client is mocked in the endpoint tests, so the test suite does not
make paid network requests or require a valid OpenAI key after Django settings
have loaded.

### Frontend

```bash
cd frontend
npm run typecheck
npm test
npm run lint
npm run build
```

`npm run build` writes the production assets to `frontend/dist/`.

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

The included SQLite database is suitable for local development and small,
single-instance deployments. Evaluate a production database and shared rate-limit
storage before running multiple application instances.

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
