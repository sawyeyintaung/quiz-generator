import { describe, expect, it } from 'vitest'
import { mc, tf } from '../../test/fakeClient.ts'
import { parsePastedReply } from './pasteImport.ts'
import { pastePrompt } from './prompts.ts'
import type { GenerationRequest } from './types.ts'

const req: GenerationRequest = {
  source: { kind: 'topic', text: 'Volcanoes' },
  count: 3,
  difficulty: 'medium',
  types: ['multiple_choice', 'true_false'],
}

const q1 = mc(1, 'What is magma called at the surface?', 'Lava', ['Ash', 'Basalt', 'Pumice'])
const q2 = tf(2, 'Most active volcanoes lie on the Pacific Ring of Fire.', true)
const q3 = mc(3, 'What shape are shield volcanoes?', 'Broad and gentle', ['Tall', 'Flat', 'Hollow'])
const wrap = (...qs: string[]) => `{"title": "Volcano Quiz", "questions": [${qs.join(',')}]}`

describe('parsePastedReply', () => {
  it('reads a fenced JSON block surrounded by commentary (chat app style)', () => {
    const reply = `Here is your quiz:\n\n\`\`\`json\n${wrap(q1, q2, q3)}\n\`\`\`\n\nGood luck!`
    const r = parsePastedReply(reply, req)
    expect(r.title).toBe('Volcano Quiz')
    expect(r.questions.map((q) => q.id)).toEqual(['q1', 'q2', 'q3'])
    expect(r.skipped).toEqual({ invalid: 0, duplicates: 0, extra: 0 })
  })

  it('reads a bare array and JSON Lines', () => {
    expect(parsePastedReply(`[${q1},${q2}]`, req).questions).toHaveLength(2)
    expect(parsePastedReply(`${q1}\n${q2}\n${q3}`, req).questions).toHaveLength(3)
  })

  it('counts duplicates, invalid and extra questions', () => {
    const dup = mc(4, 'What is magma called once at the surface?', 'Lava', ['Ash', 'Tuff', 'Glass'])
    const bad = '{"type": "multiple_choice", "prompt": "x", "options": ["a"]}'
    const extra = tf(5, 'Volcanoes only exist on Earth.', false)
    const r = parsePastedReply(wrap(q1, dup, bad, q2, q3, extra), req)
    expect(r.questions).toHaveLength(3)
    expect(r.skipped).toEqual({ invalid: 1, duplicates: 1, extra: 1 })
  })

  it('returns nothing for text without questions', () => {
    expect(parsePastedReply('Sorry, I cannot help with that.', req).questions).toEqual([])
  })
})

describe('pastePrompt', () => {
  it('is self-contained and asks for a single JSON code block', () => {
    const prompt = pastePrompt({ ...req, focus: 'eruptions' })
    expect(prompt).toContain('<source type="topic">\nVolcanoes\n</source>')
    expect(prompt).toContain('<focus>eruptions</focus>')
    expect(prompt).toContain('up to 3 questions at medium difficulty')
    expect(prompt).toContain('```json\n{"title"')
    expect(prompt).toContain('Do not create or edit files')
    expect(prompt).toContain('"type": "true_false"')
  })
})

describe('pastePrompt for a web page', () => {
  it('lets the AI app fetch only that page', () => {
    const prompt = pastePrompt({ ...req, source: { kind: 'url', url: 'https://example.com/a' } })
    expect(prompt).toContain('<source type="web page">\nhttps://example.com/a\n</source>')
    expect(prompt).toContain('The only tool you may use is fetching that one web page.')
    expect(prompt).not.toContain('do not run any tools')
  })
})

describe('pasted replies across batches', () => {
  it('reads the total and each question’s concept label', () => {
    const withConcept = (q: string, concept: string) =>
      JSON.stringify({ ...JSON.parse(q), concept })
    const reply = `{"title": "Volcanoes", "totalIdeas": 30, "questions": [${withConcept(q1, 'Lava')}, ${withConcept(q2, 'Ring of Fire')}]}`
    const r = parsePastedReply(reply, req)
    expect(r.totalIdeas).toBe(30)
    expect(r.concepts).toEqual(['Lava', 'Ring of Fire'])
  })

  it('falls back to the question when no concept label is given', () => {
    expect(parsePastedReply(`[${q1}]`, req).concepts).toEqual([
      'What is magma called at the surface?',
    ])
  })

  it('lists covered ideas in the next batch instructions', () => {
    const prompt = pastePrompt({
      ...req,
      avoid: { concepts: ['Lava', 'Ring of Fire'], prompts: [] },
    })
    expect(prompt).toContain('already covered these ideas')
    expect(prompt).toContain('- Ring of Fire')
    expect(prompt).toContain('"totalIdeas"')
  })
})
