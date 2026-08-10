# Yeshivish Translator Frontend

The frontend is a React and TypeScript application built with Vite.

## Development

```bash
npm ci
npm run dev
```

Set `VITE_API_BASE_URL` in `.env.local` when the Django API is not available at
`http://127.0.0.1:8000`.

## Validation

```bash
npm run typecheck
npm test
npm run test:coverage
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit coverage is written to `../coverage/frontend` and enforces 90% thresholds
for statements, functions, and lines plus 85% for branches. Playwright exercises
both translation directions, explicit theme persistence, and Axe accessibility
checks with a mocked backend API.
