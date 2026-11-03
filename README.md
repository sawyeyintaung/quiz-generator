# quiz-generator

Turn anything you're studying into an animated quiz with AI. Runs entirely in the browser:
bring your own API key (Anthropic, OpenAI or Google), no account, no backend.

See [docs/SPEC.md](docs/SPEC.md) for the full v1 spec.

## Development

Requires Node.js 22+.

```bash
npm install
```

```bash
npm run dev
```

| Script            | What it does                                        |
| ----------------- | --------------------------------------------------- |
| `npm run dev`     | Start the dev server                                |
| `npm run build`   | Type-check and build the static site into `dist/`   |
| `npm run preview` | Serve the production build locally                  |
| `npm run check`   | Formatting, lint, type-check and tests (same as CI) |
| `npm test`        | Run unit tests (Vitest)                             |
| `npm run format`  | Format all files with Prettier                      |

## Stack

Vite · React · TypeScript · Tailwind CSS · Framer Motion · React Router (hash routing) ·
Vitest + Testing Library · oxlint · Prettier

## Deploying

`npm run build` produces a fully static `dist/` folder. It uses relative paths and hash
routing, so it works on any static host (Vercel, Netlify, GitHub Pages) with no rewrite rules.
