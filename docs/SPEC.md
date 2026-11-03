# quiz-generator — v1 Spec

## Goal
A web app where **self-learners** turn whatever they're studying into a quiz in seconds,
then play it through a polished, animated quiz UI. No login: open the site, generate, play.

## Target user
Self-learners quizzing themselves (students, people learning a new skill).
Not in v1: teachers, classrooms, sharing, leaderboards.

## Inputs (all four sources)
| Source | How it works |
|---|---|
| Topic prompt | Free text, e.g. "Photosynthesis, high-school level" |
| Pasted text / notes | Textarea, capped (e.g. ~30k characters) |
| File upload | PDF, DOCX, TXT/MD; text extracted server-side, size-capped (e.g. 10 MB) |
| URL | Server fetches the page and extracts the readable article text |

Text extracted from a file or URL is trimmed to a token budget before it is sent to the model.
The URL fetcher must block private/internal addresses (SSRF), follow a limited number of
redirects, enforce a timeout and accept only HTML/text responses.

## Quiz settings
- Number of questions: 5 / 10 / 15 / 20
- Difficulty: Easy / Medium / Hard
- Question types: Multiple choice, True/False (choose one or both)

## Question format (validated with Zod)
```ts
type Question =
  | { id: string; type: "multiple_choice"; prompt: string;
      options: string[];        // exactly 4
      correctIndex: number;     // 0–3
      explanation: string }
  | { id: string; type: "true_false"; prompt: string;
      answer: boolean;
      explanation: string };

type Quiz = { id: string; title: string; source: SourceMeta; questions: Question[]; createdAt: string };
```
The AI is asked for structured JSON matching this schema. Any question that fails validation
is regenerated or dropped, never rendered.

## AI providers & API keys (bring your own key)
Users supply **their own API key**; the app has no key of its own and pays for no generation.

- **Providers (v1):** Anthropic (Claude), OpenAI, Google (Gemini). The list is built so
  more can be added (e.g. OpenRouter, Mistral) without UI changes.
- **Settings panel:** pick provider, paste key, pick model (sensible default per provider,
  cheap/fast model preselected), "Test key" button.
- **Key storage:** kept in the browser only. Default is session-only (sessionStorage);
  an opt-in "Remember on this device" uses localStorage. A "Forget key" button clears it.
- **Key transport:** sent over HTTPS in a request header to our generate route, which calls
  the provider and discards the key. Never stored, logged, or included in error reports/analytics
  on the server.
- **First run:** if no key is set, the Create screen shows a short "Add your API key" step
  with links to each provider's key page; a built-in **demo quiz** can be played without a key.
- **Errors:** invalid key, quota exhausted, rate-limited and model-unavailable errors from
  any provider are mapped to clear, friendly messages.

## User flow
1. **Create**: choose a source tab (Topic / Paste / Upload / URL), pick settings, press Generate.
2. **Generating**: questions stream in; the first question can be played as soon as it arrives.
3. **Play**: one question at a time with animated feedback (see below).
4. **Results**: score, accuracy ring, list of missed questions with explanations, and
   "Retry missed", "Retry all" and "New quiz" buttons.
5. **History**: past quizzes and scores saved in the browser (localStorage) so they can be replayed.

## Animation / UI (option a: polished quiz UI)
- Question cards slide or flip in; answer options stagger in
- Correct: green pulse, checkmark, small confetti burst; streak counter ticks up
- Wrong: gentle shake, the correct answer is highlighted, explanation slides down
- Animated progress bar and score counter
- Big confetti and a count-up score on the results screen
- Respects `prefers-reduced-motion`; full keyboard support (1–4 / T, F, Enter)
- Mobile-first layout

## Tech stack
| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Animation | Framer Motion + canvas-confetti |
| AI | Vercel AI SDK (one interface for Anthropic, OpenAI, Google) with structured JSON output; user's own key |
| Validation | Zod |
| Parsing | `unpdf` (PDF), `mammoth` (DOCX), `@mozilla/readability` + `jsdom` (URL) |
| Storage | None on the server in v1; browser localStorage for history |
| Deploy | Vercel |

## Cost & abuse controls
- Generation is paid by the user's own key, so the app has no per-quiz AI cost
- Default model per provider is a fast, low-cost one; show a rough "tokens per quiz" hint
- Light per-IP rate limit on file-upload and URL-fetch routes (these use our server resources)
- Caps on input size, question count and output tokens (protects the user's key spend too)

## Out of scope for v1
Accounts, sharing/links, teacher mode, other question types (fill-in, ordering, matching),
AI-generated visuals, multiplayer, a server database.

## Milestones
1. Scaffold Next.js + Tailwind + lint/format; deploy a hello-world
2. API-key settings (provider/key/model) + generation API: topic + pasted text → validated quiz (streaming)
3. Play screen + results with full animations
4. File upload + URL sources
5. History (localStorage), rate limiting, error states, polish & accessibility pass
