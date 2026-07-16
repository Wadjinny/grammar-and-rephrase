# Grammar & Rephrase

Grammar checker and rephraser powered by Gemini. Paste text for corrections with diff-style highlighting, or rephrase it in several tones. Auth is handled via PocketBase.

**Live:** [grammar-and-rephrase.w-ilyas.site](https://grammar-and-rephrase.w-ilyas.site)

## Features

- Grammar check with inline diffs, explanations, and a quality score
- Rephrase with multiple tone/style alternatives
- Multi-language support
- PocketBase login; local history / saved collection

## Stack

| Layer | Tools |
| ----- | ----- |
| Frontend | pnpm, Vite, React 19, Tailwind CSS 4, Motion, PocketBase client |
| Backend | pnpm, Express + TypeScript, `@google/genai` (port 3000) |

## Run locally

**Backend**

```bash
cd backend
pnpm install
cp .env.example .env   # set GEMINI_API_KEY and PB_URL
pnpm dev
```

**Frontend** (proxies `/api` → `localhost:3000`)

```bash
cd frontend
pnpm install
pnpm dev
```

## Deploy

Push to `main` builds/pushes the backend Docker image, deploys it with Compose, builds the Vite frontend, and updates the Caddy site config.
