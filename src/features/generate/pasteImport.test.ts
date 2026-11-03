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
  it('reads a fenced JSON block surrounded by commentary (Claude Code / chat style)', () => {
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
