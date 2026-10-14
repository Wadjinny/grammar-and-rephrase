# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Two independent pnpm projects, no workspace root: run commands inside `backend/` or `frontend/`.

**Backend** (`cd backend`, needs `.env` from `.env.example`)
- `pnpm dev`: Express on `PORT` (default 3000), `tsx watch`
- `pnpm test`: unit tests (`node:test` via tsx, `check.test.ts` and `rephrase.test.ts`); no API calls, `fetch` and Gemini are mocked
- Single test: `npx tsx --test --test-name-pattern "rate-limited" check.test.ts`
- `pnpm build`: esbuild bundle to `dist/server.js` (what the Docker image runs)
- Typecheck: there is no tsconfig; use `npx tsc --noEmit --target es2022 --module nodenext --moduleResolution nodenext --skipLibCheck server.ts check.ts llm.ts rephrase.ts`

**Frontend** (`cd frontend`, needs `.env` with `VITE_PB_URL`)
- `pnpm dev`: Vite on 5173, proxies `/api` to `BACKEND_URL` (default `http://localhost:3000`)
- `pnpm build` (runs `tsc -b`), `pnpm lint` (oxlint)

**Evals** (real API calls against a running backend, so they cost quota)
- `pnpm eval:check --target new=http://localhost:3000 --model auto [--only opt-] [--reps 2] [--pace 13]`
- `pnpm eval:rephrase --target "old=URL|gemini-3.1-flash-lite" --target new=URL`
- Cases live in `backend/eval/cases.ts`. Several `--target`s alternate case by case for fair before/after timing. `--pace` keeps under per-minute free-tier limits (13s for Cerebras gpt-oss).
- Every route requires a PocketBase token (`requireAuth` calls `PB_URL/api/collections/users/auth-refresh`). For evals, point `PB_URL` at a local stub that answers any request with `{"record":{}}` and run the server with that env.

## Architecture

**Request flow:** React SPA → `/api/check` or `/api/rephrase` (Express, `backend/server.ts`) → shared model chain (`backend/llm.ts`) → JSON → server-side post-processing → response. The model that answered is in the `X-Model` header and the `[check]` / `[rephrase]` log lines.

**`llm.ts`: the model chain.** `generateJson(getGemini, task, model)` runs a `JsonTask` (system, user, Gemini-dialect schema, `validate`). With `model = "auto"` (what the frontend sends) it walks `MODEL_CHAIN`: Cerebras gpt-oss-120b, Groq gpt-oss-120b, Cerebras qwen-3.8-27b, Gemini 3.1 Flash-Lite. It moves on after any failure: 429, 5xx, timeout, missing API key, `finish_reason: length`, bad JSON, or `validate` throwing. A 429 puts that model in an in-memory cooldown shared by both routes. Cerebras and Groq get the schema converted to strict JSON Schema, so every field must be `required`. Off-list values are normalized server-side instead of constrained in the schema, because Groq rejects whole answers on schema mismatch. Groq's free tier counts the *requested* `max_tokens`, hence `sizedMaxTokens`. The order was chosen from eval results; tests read `MODEL_CHAIN` instead of hard-coding it.

**`check.ts`: the grammar check.** The model returns only `{correctedText, score, edits[{from,to,category,reason}]}`. `buildSegments` computes the diff itself: `Intl.Segmenter` tokens (so CJK works) → `diffArrays` → merge hunks separated only by whitespace → attach reasons to hunks by word similarity, with a character-level fallback for punctuation. The invariants are tested: unmodified+deleted rebuilds the original, unmodified+inserted rebuilds the corrected text, and a deletion is immediately followed by its insertion (`DiffHighlight` pairs them). `CheckOptions` (keep abbreviations, end with full stop, allow mixed languages) become prompt rules. The full-stop option is also enforced in code both ways: added when on, and a model-added final full stop removed when off.

**`rephrase.ts`:** 5 styles defined in the prompt; the server fills `originalText` and `language` itself, so the model only returns `alternatives`.

**Frontend** (`frontend/src`): React Router v8 (`router.tsx`: `/` and `/history`). `routes/root.tsx` gates on PocketBase Google auth (`hooks/useAuth`, `lib/pocketbase`) and nests the providers: `context/language`, `workspace-tab`, `history`, `workspace`. `context/workspace.tsx` owns the input, the API calls, the check options and the results. History (max 20 items, `context/history.tsx`), the selected language and the check options live only in `localStorage`; nothing is stored server-side. `components/DiffHighlight.tsx` renders segments as revertable chips.

## Deploy

Push to `main` runs `.github/workflows/deploy.yml`, which calls shared reusable workflows in `Wadjinny/workflows`:
- The backend image goes to GHCR and is run with `compose.yml` on the Oracle host (`/home/ubuntu/apps/grammar-and-rephrase`, port 3000 bound to 127.0.0.1).
- The frontend is built and copied as static files.
- The `Caddyfile` is installed as the site config (`/api/*` → 127.0.0.1:3000).

Production env comes from the `DOTENV` GitHub secret, written to the server as `.env`. A new backend env var must be added both to `compose.yml`'s `environment:` list and to `DOTENV`, for example `grep -E '^(KEY1|KEY2)=' backend/.env | gh secret set DOTENV`, which replaces the whole value.

## Conventions

- Commit messages: start with a verb, explain why, no Co-Authored-By or tool attribution (from the user's global CLAUDE.md).
