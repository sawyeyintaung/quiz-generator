import { useSyncExternalStore } from 'react'
import { createAiClient } from '../ai/createClient.ts'
import { toAiError, type AiErrorKind } from '../ai/errors.ts'
import type { AiClient, ProviderId } from '../ai/types.ts'
import type { Question, Quiz } from '../quiz/schema.ts'
import { newId } from '../../lib/id.ts'
import { generateQuiz } from './generateQuiz.ts'
import { PROMPT_VERSION } from './prompts.ts'
import { requestLabel } from './source.ts'
import type { GenerationRequest } from './types.ts'

export type JobStatus = 'planning' | 'writing' | 'done' | 'error' | 'cancelled'

export type GenerationJob = {
  id: string
  request: GenerationRequest
  provider: ProviderId
  model: string
  status: JobStatus
  title?: string
  plannedCount?: number
  questions: Question[]
  /** The planned idea each question covers (same order as `questions`). */
  concepts: string[]
  /** The AI's estimate of distinct ideas in the whole source. */
  totalIdeas?: number
  note?: string
  error?: { kind: AiErrorKind; message: string; detail?: string }
  createdAt: string
}

export type Credentials = { provider: ProviderId; apiKey: string; model: string }

const jobs = new Map<string, GenerationJob>()
const controllers = new Map<string, AbortController>()
const listeners = new Set<() => void>()

const defaultFactory = (c: Credentials): Promise<AiClient> =>
  createAiClient(c.provider, c.apiKey, c.model)
let clientFactory = defaultFactory

/** Tests can swap in a fake client; pass nothing to restore the real one. */
export function setClientFactoryForTests(factory?: typeof defaultFactory) {
  clientFactory = factory ?? defaultFactory
}

function update(id: string, patch: Partial<GenerationJob>) {
  const job = jobs.get(id)
  if (!job) return
  jobs.set(id, { ...job, ...patch })
  listeners.forEach((l) => l())
}

export function startGeneration(input: GenerationRequest, credentials: Credentials): string {
  const id = newId()
  // Every quiz belongs to a saved source, so later batches can continue without repeats.
  const request: GenerationRequest = { ...input, sourceId: input.sourceId ?? newId() }
  const controller = new AbortController()
  jobs.set(id, {
    id,
    request,
    provider: credentials.provider,
    model: credentials.model,
    status: 'planning',
    questions: [],
    concepts: [],
    createdAt: new Date().toISOString(),
  })
  controllers.set(id, controller)
  listeners.forEach((l) => l())
  void run(id, request, credentials, controller.signal)
  return id
}

async function run(
  id: string,
  request: GenerationRequest,
  credentials: Credentials,
  signal: AbortSignal,
) {
  try {
    const client = await clientFactory(credentials)
    for await (const event of generateQuiz(client, request, { signal })) {
      if (signal.aborted) return
      const job = jobs.get(id)
      if (!job) return
      if (event.type === 'planned') {
        update(id, {
          status: 'writing',
          title: event.title,
          plannedCount: event.plannedCount,
          totalIdeas: event.totalIdeas,
        })
      } else if (event.type === 'question') {
        update(id, {
          questions: [...job.questions, event.question],
          concepts: [...job.concepts, event.concept],
        })
      } else {
        update(id, { status: 'done', note: event.note })
        // Save as soon as it is complete, so it survives a reload even if never finished.
        persist(id)
      }
    }
  } catch (error) {
    if (signal.aborted) return
    const aiError = toAiError(error)
    update(id, {
      status: 'error',
      error: { kind: aiError.kind, message: aiError.message, detail: aiError.detail },
    })
    // Nothing new left: remember that, so the source shows as fully covered.
    if (aiError.kind === 'source_exhausted') persist(id, { exhausted: true })
  } finally {
    controllers.delete(id)
  }
}

/** Saves the quiz and what it covered (database code loads on demand: not in the first download). */
function persist(id: string, { exhausted = false } = {}) {
  const job = jobs.get(id)
  if (!job) return
  void import('../history/db.ts')
    .then(async ({ saveQuiz, recordCoverage }) => {
      if (job.questions.length > 0) await saveQuiz(jobToQuiz(job))
      await recordCoverage(job.request, requestLabel(job.request.source), {
        concepts: job.concepts,
        prompts: job.questions.map((q) => q.prompt),
        totalIdeas: job.totalIdeas,
        exhausted,
      })
    })
    .catch(() => undefined)
}

export function cancelGeneration(id: string) {
  controllers.get(id)?.abort()
  controllers.delete(id)
  const job = jobs.get(id)
  if (job && (job.status === 'planning' || job.status === 'writing')) {
    update(id, { status: 'cancelled' })
  }
}

/** Starts a new job with the same request and credentials as an earlier one. */
export function retryGeneration(id: string, apiKey: string): string | undefined {
  const job = jobs.get(id)
  if (!job) return undefined
  return startGeneration(job.request, { provider: job.provider, model: job.model, apiKey })
}

export function isFinished(job: GenerationJob): boolean {
  return job.status === 'done' || job.status === 'error' || job.status === 'cancelled'
}

/** The quiz as it stands (all questions so far), in the shared Quiz format. */
export function jobToQuiz(job: GenerationJob): Quiz {
  const { request } = job
  return {
    id: job.id,
    title: job.title ?? 'My quiz',
    source: { kind: request.source.kind, label: requestLabel(request.source) },
    settings: {
      count: request.count,
      focus: request.focus?.trim() || undefined,
      difficulty: request.difficulty,
      types: request.types,
    },
    provider: job.provider,
    model: job.model,
    promptVersion: PROMPT_VERSION,
    sourceId: request.sourceId,
    questions: job.questions,
    createdAt: job.createdAt,
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getJob(id: string | null | undefined): GenerationJob | undefined {
  return id ? jobs.get(id) : undefined
}

export function useJob(id: string | null | undefined): GenerationJob | undefined {
  return useSyncExternalStore(
    subscribe,
    () => getJob(id),
    () => getJob(id),
  )
}
