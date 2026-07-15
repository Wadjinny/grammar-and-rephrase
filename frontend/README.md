# Grammar & Rephrase

An advanced grammar checker and rephrasing app in the style of Reverso, powered by the Gemini API. Paste your text, get corrections with diff-style highlighting and rich hover explanations, or rephrase it in multiple custom modes.

## Features

- **Grammar checking** with inline diff highlighting and per-correction explanations
- **Rephrasing** with multiple tone/style modes
- **Multi-language support**
- **Model selection** (Gemini Flash / Pro)
- **Saved collection** to bookmark results
- Text-to-speech and one-click copy

## Tech Stack

React 19, TypeScript, Vite, Tailwind CSS 4, Motion, Express server with `@google/genai`.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file (see `.env.example`) and set your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```

## Build & Deploy

```bash
npm run build   # bundles client (Vite) and server (esbuild) into dist/
npm start       # runs the production server
```
