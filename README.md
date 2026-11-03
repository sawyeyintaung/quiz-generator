<p><img src="public/logo.svg" width="64" height="64" alt="Quiz Generator logo: four answer tiles, one lit amber"></p>

# quiz-generator

Turn anything you're studying into an animated quiz with AI. Runs entirely in the browser:
no account and no backend.

## Features

- **Sources:** a topic, pasted notes, an uploaded file (PDF, Word .docx, text, Markdown)
  or a web link. Files are read only in your browser.
- **Focus suggestions:** pick parts of your material to quiz on, from the document's own
  chapters and headings (free) or suggested by the AI. PDFs also have a page range picker.
- **Two ways to generate:**
  - **API key** (Anthropic, OpenAI or Google): questions stream in and you can start
    answering straight away. The key stays in your browser and is sent only to that provider.
  - **Copy & paste with your subscription:** copy the app's instructions into Claude Code,
    claude.ai or ChatGPT, then paste the reply back. No API key needed.
- **Quality checks:** the AI plans distinct ideas first, every question is validated, options
  are shuffled, near-duplicates are removed, and short sources get fewer questions instead of
  repeats.
- **Animated play:** multiple choice and true/false, instant feedback with explanations,
  streaks, confetti, full keyboard support (1–4 / T / F / Enter), and reduced-motion support.
- **History** in your browser (IndexedDB), with best and last scores, Retry missed,
  Export/Import backup.
- **Light and dark mode:** a switch in the header, plus System / Light / Dark under Settings.
- **Sharing** as a link (the quiz lives after the `#`, so it is never sent to a server) or as
  a `.quiz.json` file. Friends can play without an API key.

See [docs/SPEC.md](docs/SPEC.md) for the full spec and design decisions.

## Development

Requires Node.js 22+.

```bash
npm install
```

```bash
npm run dev
```

| Script            | What it does                                            |
| ----------------- | ------------------------------------------------------- |
| `npm run dev`     | Start the dev server                                    |
| `npm run build`   | Type-check and build the static site into `dist/`       |
| `npm run preview` | Serve the production build locally                      |
| `npm run check`   | Formatting, lint, type-check and tests (same as CI)     |
| `npm test`        | Run unit and component tests (Vitest + Testing Library) |
| `npm run format`  | Format all files with Prettier                          |

## Stack

Vite · React · TypeScript · Tailwind CSS · Framer Motion · React Router (hash routing) ·
Zod · Dexie (IndexedDB) · pdf.js · mammoth · official Anthropic, OpenAI and Google SDKs ·
Vitest + Testing Library · oxlint · Prettier

## Deploying

`npm run build` produces a fully static `dist/` folder. It uses relative paths and hash
routing, so it works on any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages)
with no rewrite rules.

Security is built in:

- The page carries a strict **Content Security Policy** (in a `<meta>` tag). It allows scripts
  only from the site itself, and network requests only to the site and the three AI
  providers (`api.anthropic.com`, `api.openai.com`, `generativelanguage.googleapis.com`).
  If you add a provider, update `security.config.ts`.
- The build also writes `dist/_headers` (Netlify, Cloudflare Pages) and `dist/vercel.json`
  (Vercel) with the same policy as real HTTP headers, plus `frame-ancestors 'none'`,
  `nosniff`, `no-referrer` and a restrictive `Permissions-Policy`. On GitHub Pages, which
  has no custom headers, the `<meta>` policy still applies.
