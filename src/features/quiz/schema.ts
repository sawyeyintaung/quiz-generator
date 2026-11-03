import { z } from 'zod'

export const multipleChoiceQuestionSchema = z.object({
  id: z.string().min(1),
  type: z.literal('multiple_choice'),
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1),
})

export const trueFalseQuestionSchema = z.object({
  id: z.string().min(1),
  type: z.literal('true_false'),
  prompt: z.string().min(1),
  answer: z.boolean(),
  explanation: z.string().min(1),
})

export const questionSchema = z.discriminatedUnion('type', [
  multipleChoiceQuestionSchema,
  trueFalseQuestionSchema,
])

export const difficultySchema = z.enum(['easy', 'medium', 'hard'])
export const questionTypeSchema = z.enum(['multiple_choice', 'true_false'])

export const quizSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  source: z.object({
    kind: z.enum(['topic', 'text', 'file', 'url', 'demo']),
    label: z.string(),
  }),
  settings: z.object({
    count: z.number().int().positive(),
    focus: z.string().optional(),
    pageRange: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
    difficulty: difficultySchema,
    types: z.array(questionTypeSchema).min(1),
  }),
  provider: z.string().optional(),
  model: z.string().optional(),
  questions: z.array(questionSchema).min(1),
  createdAt: z.string(),
})

export type MultipleChoiceQuestion = z.infer<typeof multipleChoiceQuestionSchema>
export type TrueFalseQuestion = z.infer<typeof trueFalseQuestionSchema>
export type Question = z.infer<typeof questionSchema>
export type Quiz = z.infer<typeof quizSchema>

/** The user's answer: option index for multiple choice, boolean for true/false. */
export type AnswerValue = number | boolean

export function isCorrect(question: Question, answer: AnswerValue): boolean {
  return question.type === 'multiple_choice'
    ? answer === question.correctIndex
    : answer === question.answer
}

/** Human-readable correct answer, used in feedback and on the results screen. */
export function correctAnswerText(question: Question): string {
  return question.type === 'multiple_choice'
    ? question.options[question.correctIndex]
    : question.answer
      ? 'True'
      : 'False'
}

export function answerText(question: Question, answer: AnswerValue): string {
  if (question.type === 'multiple_choice') {
    return typeof answer === 'number' ? (question.options[answer] ?? '') : ''
  }
  return answer === true ? 'True' : 'False'
}
