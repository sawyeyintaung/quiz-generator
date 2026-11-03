# quiz-generator — v1 Spec

## Goal

A web app where **self-learners** turn whatever they're studying into a quiz in seconds,
then play it through a polished, animated quiz UI. No login: open the site, add your AI key,
generate, play.

## Target user

Self-learners quizzing themselves (students, people learning a new skill).
Not in v1: teachers, classrooms, sharing, leaderboards.

## Architecture: fully client-side (no backend)

The app is a static site. Everything runs in the user's browser:

| Concern       | How                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| AI generation | Browser calls the AI provider directly with the user's own key                                       |
| File parsing  | In the browser (pdf.js for PDF, mammoth for DOCX, plain read for TXT/MD)                             |
| URL source    | Asked of the AI provider's own URL-fetch feature where supported; otherwise "paste the text instead" |
| Quiz history  | IndexedDB in the browser                                                                             |
| Hosting       | Any static host (Vercel / Netlify / GitHub Pages)                                                    |

Why: the API key never touches a server of ours, there is no server for anyone to abuse
(no SSRF, no rate limiting needed), and hosting is free and simple.

## AI providers & API keys (bring your own key)

- **Providers (v1):** Anthropic (Claude), OpenAI, Google (Gemini), behind one provider
  interface so more can be added later.
- **Settings panel:** pick provider, paste key, pick model (fast/low-cost default per provider),
  "Test key" button.
- **Key storage:** browser only. Default is session-only (sessionStorage); opt-in
  "Remember on this device" uses localStorage. "Forget key" clears it.
- **Key transport:** sent only from the browser to the chosen provider over HTTPS.
  Never sent anywhere else, never put into a prompt, never logged.
- **First run:** short "Add your API key" step with links to each provider's key page;
  a built-in **demo quiz** is playable without a key.
- **Errors:** invalid key, quota exhausted, rate-limited, model unavailable and CORS/network
  errors are mapped to clear, friendly messages.

## Copy & paste mode (use your own subscription)

For learners who want to use their Claude, ChatGPT or Gemini subscription instead of
paying for API credit. Subscription logins cannot be used by third-party apps, so the learner
runs the AI step themselves:

1. Settings → "Copy & paste with my subscription" (or the button on the Create page).
2. Create page → "Get instructions": the app builds one self-contained prompt (same rules,
   difficulty rubric and source-as-data framing as API mode) asking for a single JSON code block.
3. The learner copies it into Claude (the default), ChatGPT or Gemini.
4. They paste the reply back. The app extracts the JSON (fenced block, bare object/array or
   JSON Lines), validates every question, shuffles options, drops duplicates/extras and tells
   the learner what was skipped, then starts the quiz.

Nothing is sent anywhere by the app in this mode.

## Inputs

| Source              | How it works                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| Topic prompt        | Free text, e.g. "Photosynthesis, high-school level"                                                         |
| Pasted text / notes | Textarea, capped (e.g. ~30k characters)                                                                     |
| File upload         | PDF, DOCX, TXT/MD parsed in the browser; size-capped (e.g. 10 MB)                                           |
| URL                 | Provider-side fetch (Anthropic, Google) where available; otherwise a clear "paste the text instead" message |

Extracted text is trimmed to a token budget before being sent to the model, which also
protects the user's spend.

## Narrowing the quiz scope

- **"Focus on" field** (optional, ~150 chars, available for every source type), e.g.
  "only the light reactions" or "chapter 3". The model picks key concepts only within that
  focus; it is treated as subject matter, not as instructions.
- **PDF page range:** after upload, show the page count and a from/to picker; only the selected
  pages are extracted and sent (saves the user's tokens).
- If the focus is missing or thin in the source, generate fewer questions and say why
  ("Only 3 questions found about 'light reactions' in this document").
- **Focus suggestions** (helps when the scope is big):
  - Shown **automatically** for both small and large sources once the source is ready
    (topic typed with a short pause, text pasted, file parsed, URL loaded), if a key is set.
  - **Skipped when the scope is too small** to split meaningfully (e.g. under ~300 words,
    or the topic is already narrow); the AI may also return no suggestions, in which case
    nothing is shown. This is expected, not an error.
  - Cost control (it uses the user's tokens): fast/cheap model, condensed input, results cached
    per source so the same source never triggers a second call, and a Settings toggle
    "Auto-suggest focus areas" (on by default) to turn it off. A "Suggest focus" button
    stays available when it is off.
  - Shows 4–8 options, each with a title, page range (PDF), and estimated number of unique
    questions, plus a "Whole source (overview)" option. Multi-select allowed.
  - Selecting fills the Focus field and page range; the user can still edit them.
  - For topic sources, suggestions are subtopics (e.g. World War II → Causes, Pacific War, ...).
  - **Free first:** use the PDF outline/bookmarks or document/page headings when present (no AI call).
    Otherwise send a condensed view (headings + section openings / samples) to the fast model.
  - Output uses a small Zod-validated schema:
    `{ suggestions: { title: string; description: string; pageRange?: [number, number]; estimatedQuestions: number }[] }`

## Quiz settings

- Number of questions: 5 / 10 / 15 / 20
- Difficulty: Easy / Medium / Hard
- Question types: Multiple choice, True/False (choose one or both)

## Prompting: the app owns the instructions

Users provide only the **source** and the **settings**; they never write prompts.

- All instructions (difficulty rubric, plan-then-write steps, duplicate rules, output schema)
  live in versioned prompt templates in the app, tunable per provider.
- Source content is placed in a clearly delimited "source material" block and the model is told
  to treat it as data, never as instructions (prompt-injection defence; schema validation backs it up).
- The topic field may include a natural focus ("…focus on the light reactions"); it is still
  treated as the subject, not as instructions about format or rules.
- Prompts ship in the client bundle, so they are not secret; they contain no keys.

## Question quality: avoiding duplicates

Duplicates usually happen when the requested count is larger than the number of distinct
facts in the source. Three layers prevent it:

1. **Count guidance (before generating):** estimate how many questions the source supports
   (~1 per 60–80 words of source text). If the user picks more, show a warning such as
   "This text is short; we recommend up to 5 questions." They may continue anyway.
2. **Plan, then write (during generation):**
   - Step 1: the model lists up to N _distinct_ key concepts from the source, and must not
     pad or repeat concepts to reach N.
   - Step 2: one question per concept.
   - If fewer concepts exist than requested, generate fewer and tell the user
     ("Your source supports 6 unique questions"). Never more than N (extras are trimmed).
   - Prompt rules: no rephrased repeats; a true/false question must not restate a
     multiple-choice question's answer; each question tests a different fact.
3. **Duplicate check in code (after each question arrives):** compare normalized question
   text and correct-answer text against earlier questions with a local similarity measure
   (word/trigram overlap, no extra AI cost). Too-similar questions are dropped and a
   replacement is requested with the existing questions passed as an "avoid" list.
   "Regenerate question" uses the same avoid list.

## Question format (validated with Zod)

```ts
type Question =
  | {
      id: string
      type: 'multiple_choice'
      prompt: string
      options: string[] // exactly 4
      correctIndex: number // 0–3
      explanation: string
    }
  | { id: string; type: 'true_false'; prompt: string; answer: boolean; explanation: string }

type Quiz = {
  id: string
  title: string
  source: { kind: 'topic' | 'text' | 'file' | 'url'; label: string } // label only, not the content
  settings: {
    count: number
    focus?: string
    pageRange?: [number, number]
    difficulty: 'easy' | 'medium' | 'hard'
    types: Question['type'][]
  }
  provider: string
  model: string
  questions: Question[]
  createdAt: string
}

type Attempt = {
  id: string
  quizId: string
  answers: { questionId: string; correct: boolean }[]
  score: number
  startedAt: string
  finishedAt: string
}
```

The AI is asked for structured JSON matching this schema. Any question that fails validation
is regenerated or dropped, never rendered.

## Quiz history (browser storage)

- **IndexedDB via Dexie** with `quizzes` and `attempts` tables. localStorage holds only small settings.
- Call `navigator.storage.persist()` to reduce the chance the browser evicts data.
- Store the quiz and a short source label only, **not** the original files or pasted text.
- **History screen:** list of past quizzes with best and last score; replay, retry missed, delete.
- **Export / Import** all history as a JSON file (backup and moving between devices).
- Known limits, shown in a short note on the History screen: data is per browser/device,
  is removed if site data is cleared, and Safari may clear it after 7 days without a visit.

## Sharing quizzes (no AI needed to replay)

A generated quiz can be shared and played by anyone, without an API key and without
calling the AI again.

- **Quiz file:** "Download quiz" saves `<title>.quiz.json`; "Import quiz" (button or
  drag-and-drop) opens one. Works for any size.
- **Share link:** the quiz is compressed with `lz-string` into the URL fragment
  (`/#/play?q=...`). The fragment is never sent to any server. If the link would be too long
  (over ~8 KB), the app suggests the file instead.
- **Shared format** (versioned, separate from the internal storage format):
  ```json
  {
    "format": "quiz-generator",
    "version": 1,
    "title": "...",
    "source": { "kind": "topic", "label": "..." },
    "settings": { "count": 10, "difficulty": "medium", "types": ["multiple_choice"] },
    "questions": [
      {
        "type": "multiple_choice",
        "prompt": "...",
        "options": ["..."],
        "correctIndex": 2,
        "explanation": "..."
      }
    ],
    "createdAt": "..."
  }
  ```
  Never includes the API key, provider/model, or original source text.
  `format` + `version` allow future changes while still opening old files.
- **Imports are untrusted:** validated with Zod, size-capped (e.g. 1 MB, max 100 questions),
  rendered as plain text only; invalid files show a friendly error.
- Imported quizzes are saved to History like generated ones (marked "Imported").
- Trade-off: answers are readable inside the file/link. Fine for self-learners; hiding
  answers would need a server (future teacher mode).

## User flow

1. **Create**: choose a source tab (Topic / Paste / Upload / URL), pick settings, press Generate.
2. **Generating**: questions stream in; the first question can be played as soon as it arrives.
3. **Play**: one question at a time with animated feedback (see below).
4. **Results**: score, accuracy ring, list of missed questions with explanations, and
   "Retry missed", "Retry all" and "New quiz" buttons.
5. **History**: past quizzes and attempts (see above).

## Animation / UI (polished quiz UI)

- Question cards slide or flip in; answer options stagger in
- Correct: green pulse, checkmark, small confetti burst; streak counter ticks up
- Wrong: gentle shake, the correct answer is highlighted, explanation slides down
- Animated progress bar and score counter
- Big confetti and a count-up score on the results screen
- Respects `prefers-reduced-motion`; full keyboard support (1–4 / T, F, Enter)
- Mobile-first layout

## Security (client-side)

- Strict Content Security Policy: scripts only from our origin; `connect-src` limited to the
  supported provider API domains
- All quiz text rendered as plain text (no `dangerouslySetInnerHTML`, no Markdown-to-HTML in v1)
- Few, well-known dependencies, versions pinned with a lockfile
- Prompt injection from source text can only produce a bad quiz: the model has no tools
  except provider URL fetch, the key is never in the prompt, and output is schema-validated

## Tech stack

| Layer             | Choice                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Build / framework | Vite + React + TypeScript                                                                                                                        |
| Routing           | React Router                                                                                                                                     |
| Styling           | Tailwind CSS                                                                                                                                     |
| Animation         | Framer Motion + canvas-confetti                                                                                                                  |
| AI                | Official SDKs (`@anthropic-ai/sdk`, `openai`, `@google/genai`) behind one small app interface, lazy-loaded per provider, called from the browser |
| Validation        | Zod                                                                                                                                              |
| Parsing           | pdf.js (`pdfjs-dist`), `mammoth`                                                                                                                 |
| Storage           | Dexie (IndexedDB) for history; local/sessionStorage for settings and key                                                                         |
| Testing           | Vitest + React Testing Library; Playwright for a few end-to-end flows                                                                            |
| Hosting           | Static host (Vercel / Netlify / GitHub Pages)                                                                                                    |

## Implementation notes (Milestone 5)

- Files are read only in the browser: PDF via pdf.js (text per page + bookmarks), DOCX via
  mammoth (headings kept as `# ` lines), TXT/Markdown directly. Scanned PDFs without text,
  password-protected PDFs and files over 10 MB get a clear message. At most ~100k characters
  are sent; longer selections show a visible warning suggesting a page range or focus.
- Links: API mode asks the provider to fetch the page once (Claude: server-side `web_fetch`
  tool limited to the page's own domain, with `pause_turn` resumed; Gemini: URL context tool),
  then quizzes on the returned text. OpenAI's chat API cannot read pages, so the app says so
  and suggests Claude/Gemini or pasting the text. Paste mode asks the learner's AI app to
  fetch the page.
- Focus suggestions come from the document's own bookmarks/headings when it has them (free,
  with page ranges for PDFs); otherwise from one cached AI call on a condensed view of the
  source (API mode only). Links get no suggestions before the page is fetched.

## Implementation notes (Milestone 6)

- Content Security Policy injected into the production build (`security.config.ts`):
  scripts from self only; `connect-src` limited to self + the three AI providers; no inline
  styles or eval (Zod runs in `jitless` mode; question cards cross-slide in a shared grid cell
  instead of Framer Motion's style-injecting `popLayout`). Host header files are emitted too.
- Secondary pages (Results, History, Settings, Copy & paste) and the history database load on
  demand; provider SDKs and file parsers were already lazy. First download ~173 KB gzipped.
- Accessibility: axe-core reports no violations on any screen in light or dark mode (including
  the share dialog); brand, correct and wrong colours meet 4.5:1; source pickers are toggle
  buttons; the dialog traps and restores focus; every page sets its own title; consistent
  `:focus-visible` outline; quizzes are fully playable by keyboard, even at speed.
- Error states: storage blocked (private windows) on History, "new version available" with
  Reload when an old tab can't load new code, plus the earlier provider/quota/link messages.

## Out of scope for v1

Accounts, cloud sync, server-hosted share links, teacher mode / hidden answers, other question types (fill-in, ordering,
matching), AI-generated visuals, multiplayer, any backend server.

## Milestones

1. Scaffold Vite + React + TS + Tailwind + lint/format + tests; app shell with routes; static deploy
2. Play + Results screens with full animations, using the built-in demo quiz
3. API-key settings + generation from topic and pasted text (streaming, validated)
4. History in IndexedDB + Export/Import + quiz sharing (file and link)
5. File upload (PDF/DOCX/TXT) + URL via provider fetch
6. Error states, CSP, accessibility and polish pass
