import { useSyncExternalStore } from 'react'
import { createAiClient } from '../ai/createClient.ts'
import { toAiError, type AiErrorKind } from '../ai/errors.ts'
import type { AiClient, ProviderId } from '../ai/types.ts'
import type { Question, Quiz } from '../quiz/schema.ts'
import { newId } from '../../lib/id.ts'
import { saveQuiz } from '../history/db.ts'
import { generateQuiz } from './generateQuiz.ts'
import { PROMPT_VERSION } from './prompts.ts'
import { sourceLabel } from './source.ts'
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

export function startGeneration(request: GenerationRequest, credentials: Credentials): string {
  const id = newId()
  const controller = new AbortController()
  jobs.set(id, {
    id,
    request,
    provider: credentials.provider,
    model: credentials.model,
    status: 'planning',
    questions: [],
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
        update(id, { status: 'writing', title: event.title, plannedCount: event.plannedCount })
      } else if (event.type === 'question') {
        update(id, { questions: [...job.questions, event.question] })
      } else {
        update(id, { status: 'done', note: event.note })
        const finished = jobs.get(id)
        // Save as soon as it is complete, so it survives a reload even if never finished.
        if (finished) void saveQuiz(jobToQuiz(finished)).catch(() => undefined)
      }
    }
  } catch (error) {
    if (signal.aborted) return
    const aiError = toAiError(error)
    update(id, {
      status: 'error',
      error: { kind: aiError.kind, message: aiError.message, detail: aiError.detail },
    })
  } finally {
    controllers.delete(id)
  }
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
    source: {
      kind: request.source.kind,
      label:
        request.source.kind === 'text' && request.source.label
          ? request.source.label
          : sourceLabel(request.source.text),
    },
    settings: {
      count: request.count,
      focus: request.focus?.trim() || undefined,
      difficulty: request.difficulty,
      types: request.types,
    },
    provider: job.provider,
    model: job.model,
    promptVersion: PROMPT_VERSION,
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
