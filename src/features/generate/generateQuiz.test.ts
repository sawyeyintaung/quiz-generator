import { describe, expect, it } from 'vitest'
import { AiError } from '../ai/errors.ts'
import { correctAnswerText, type Question } from '../quiz/schema.ts'
import { fakeClient, mc, tf } from '../../test/fakeClient.ts'
import { generateQuiz, type GenerationEvent } from './generateQuiz.ts'
import type { GenerationRequest } from './types.ts'

const request: GenerationRequest = {
  source: { kind: 'topic', text: 'The solar system' },
  count: 3,
  difficulty: 'easy',
  types: ['multiple_choice', 'true_false'],
}

const plan = {
  title: 'Solar System Basics',
  concepts: ['Closest planet', 'Largest planet', 'Pluto status'],
}

async function collect(gen: AsyncGenerator<GenerationEvent>) {
  const events: GenerationEvent[] = []
  for await (const e of gen) events.push(e)
  const questions = events.flatMap((e) => (e.type === 'question' ? [e.question] : []))
  const done = events.find((e) => e.type === 'done')
  return { events, questions, note: done?.type === 'done' ? done.note : undefined }
}

const q1 = mc(1, 'Which planet is closest to the Sun?', 'Mercury', ['Venus', 'Mars', 'Earth'])
const q2 = mc(2, 'Which planet is the largest?', 'Jupiter', ['Saturn', 'Neptune', 'Uranus'])
const q3 = tf(3, 'Pluto is one of the eight planets.', false)

describe('generateQuiz', () => {
  it('plans, then streams validated questions split across chunk boundaries', async () => {
    const text = `${q1}\n${q2}\n${q3}`
    const chunks = text.match(/.{1,17}/gs) ?? []
    const { client, calls } = fakeClient({ plan, streams: [chunks] })
    const { events, questions, note } = await collect(generateQuiz(client, request))

    expect(events[0]).toEqual({ type: 'planned', title: 'Solar System Basics', plannedCount: 3 })
    expect(questions.map((q) => q.prompt)).toEqual([
      'Which planet is closest to the Sun?',
      'Which planet is the largest?',
      'Pluto is one of the eight planets.',
    ])
    expect(questions.map((q) => q.id)).toEqual(['q1', 'q2', 'q3'])
    expect(note).toBeUndefined()
    // Source is wrapped as data, and the prompts carry the settings.
    expect(calls.json[0].prompt).toContain('<source type="topic">')
    expect(calls.stream[0].prompt).toContain('1. Closest planet')
  })

  it('shuffles multiple-choice options but keeps the right answer', async () => {
    const { client } = fakeClient({ plan, streams: [[`${q1}\n${q2}\n${q3}`]] })
    const random = () => 0 // deterministic shuffle: moves the first option to the end
    const { questions } = await collect(generateQuiz(client, request, { random }))
    const answers = questions.map((q: Question) => correctAnswerText(q))
    expect(answers).toEqual(['Mercury', 'Jupiter', 'False'])
    expect(questions[0].type === 'multiple_choice' && questions[0].correctIndex).toBe(3)
  })

  it('drops duplicates, invalid lines and disallowed types, then tops up missing ones', async () => {
    const dup = mc(2, 'What planet orbits closest to the Sun?', 'Mercury', [
      'Venus',
      'Mars',
      'Earth',
    ])
    const bad = JSON.stringify({ concept: 3, type: 'multiple_choice', prompt: 'x', options: ['a'] })
    const first = ['```json\n', `${q1}\n${dup}\nnot json\n${bad}\n`, '```']
    const { client, calls } = fakeClient({ plan, streams: [first, [`${q2}\n${q3}`]] })
    const { questions, note } = await collect(generateQuiz(client, request))

    expect(questions).toHaveLength(3)
    expect(calls.stream).toHaveLength(2)
    // The top-up only asks for the missing concepts and lists what to avoid.
    expect(calls.stream[1].prompt).toContain('2. Largest planet')
    expect(calls.stream[1].prompt).not.toContain('1. Closest planet')
    expect(calls.stream[1].prompt).toContain('- Which planet is closest to the Sun?')
    expect(note).toBeUndefined()
  })

  it('makes fewer questions and explains why when the source supports fewer', async () => {
    const shortPlan = { title: 'Tiny', concepts: ['Closest planet', 'Largest planet'] }
    const { client } = fakeClient({ plan: shortPlan, streams: [[`${q1}\n${q2}`]] })
    const { questions, note } = await collect(generateQuiz(client, { ...request, count: 5 }))
    expect(questions).toHaveLength(2)
    expect(note).toMatch(/supports 2 unique questions, so we made 2 instead of 5/)
  })

  it('ignores question types the user did not pick', async () => {
    const { client } = fakeClient({ plan, streams: [[`${q1}\n${q3}`], []] })
    const { questions } = await collect(
      generateQuiz(client, { ...request, types: ['multiple_choice'] }),
    )
    expect(questions.every((q) => q.type === 'multiple_choice')).toBe(true)
  })

  it('fails clearly when there is nothing to quiz on', async () => {
    const { client } = fakeClient({ plan: { title: 'x', concepts: [] }, streams: [] })
    await expect(collect(generateQuiz(client, request))).rejects.toMatchObject({
      kind: 'empty_source',
    })
  })

  it('keeps questions already written if the stream fails part-way', async () => {
    const { client } = fakeClient({
      plan,
      streams: [{ chunks: [`${q1}\n`], error: Object.assign(new Error('busy'), { status: 529 }) }],
    })
    const { questions, note } = await collect(generateQuiz(client, request))
    expect(questions).toHaveLength(1)
    expect(note).toMatch(/Generation stopped early/)
  })

  it('surfaces errors before any question as AiError', async () => {
    const { client } = fakeClient({
      plan: Object.assign(new Error('bad key'), { status: 401 }),
      streams: [],
    })
    const error = await collect(generateQuiz(client, request)).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AiError)
    expect(error).toMatchObject({ kind: 'auth' })
  })
})

describe('generateQuiz with a web page', () => {
  const urlReq: GenerationRequest = {
    ...request,
    source: { kind: 'url', url: 'https://example.com/volcanoes' },
  }

  it('has the provider read the page, then quizzes on its text', async () => {
    const { client, calls } = fakeClient({
      plan,
      streams: [[`${q1}\n${q2}\n${q3}`]],
      page: '# Volcanoes\nMagma and lava.',
    })
    const { questions } = await collect(generateQuiz(client, urlReq))
    expect(calls.urls).toEqual(['https://example.com/volcanoes'])
    expect(calls.json[0].prompt).toContain('<source type="study material">\n# Volcanoes')
    expect(questions).toHaveLength(3)
  })

  it('explains when the provider cannot read web pages', async () => {
    const { client } = fakeClient({ plan, streams: [] })
    await expect(collect(generateQuiz(client, urlReq))).rejects.toMatchObject({
      kind: 'url_unsupported',
    })
  })
})

describe('generateQuiz across batches', () => {
  it('reports the total and the concept of each question', async () => {
    const { client } = fakeClient({
      plan: { ...plan, totalIdeas: 25 },
      streams: [[`${q1}\n${q2}\n${q3}`]],
    })
    const { events } = await collect(generateQuiz(client, request))
    expect(events[0]).toMatchObject({ type: 'planned', totalIdeas: 25 })
    expect(
      events.filter((e) => e.type === 'question').map((e) => e.type === 'question' && e.concept),
    ).toEqual(['Closest planet', 'Largest planet', 'Pluto status'])
  })

  it('tells the AI what earlier batches covered', async () => {
    const { client, calls } = fakeClient({ plan, streams: [[`${q1}\n${q2}\n${q3}`]] })
    const next = {
      ...request,
      avoid: { concepts: ['Saturn rings'], prompts: ['Which planet has rings?'] },
    }
    await collect(generateQuiz(client, next))
    expect(calls.json[0].prompt).toContain('already covered these ideas')
    expect(calls.json[0].prompt).toContain('- Saturn rings')
    expect(calls.stream[0].prompt).toContain('- Which planet has rings?')
  })

  it('says the source is fully covered when nothing new is left', async () => {
    const { client } = fakeClient({
      plan: { title: 'x', totalIdeas: 3, concepts: [] },
      streams: [],
    })
    const next = { ...request, avoid: { concepts: ['a', 'b', 'c'], prompts: [] } }
    await expect(collect(generateQuiz(client, next))).rejects.toMatchObject({
      kind: 'source_exhausted',
    })
  })
})
