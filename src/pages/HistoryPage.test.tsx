import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { routes } from '../app/routes.tsx'
import { db } from '../features/history/db.ts'
import { demoQuiz } from '../features/quiz/demoQuiz.ts'
import { correctAnswerText, type Quiz } from '../features/quiz/schema.ts'
import { encodeQuizForLink, toSharedQuiz } from '../features/share/shareFormat.ts'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

const quiz: Quiz = {
  ...demoQuiz,
  title: 'Planets 101',
  source: { kind: 'topic', label: 'Planets' },
  questions: demoQuiz.questions.slice(0, 2),
}

beforeEach(async () => {
  await db.quizzes.clear()
  await db.attempts.clear()
})

describe('history and sharing', () => {
  it('imports a quiz file, shows it in History, and deletes it after confirming', async () => {
    const user = userEvent.setup()
    renderAt('/history')
    expect(await screen.findByText('No quizzes yet')).toBeInTheDocument()

    const file = new File([JSON.stringify(toSharedQuiz(quiz))], 'planets.quiz.json', {
      type: 'application/json',
    })
    await user.upload(screen.getByLabelText('Import a quiz or history file'), file)
    expect(await screen.findByText('Imported “Planets 101”.')).toBeInTheDocument()
    const card = (await screen.findByRole('heading', { name: /Planets 101/ })).closest('li')!
    expect(within(card).getByText('Imported')).toBeInTheDocument()
    expect(within(card).getByText('Not played yet')).toBeInTheDocument()

    await user.click(within(card).getByRole('button', { name: 'Delete' }))
    await user.click(within(card).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('No quizzes yet')).toBeInTheDocument()
  })

  it('rejects a file that is not a quiz', async () => {
    const user = userEvent.setup()
    renderAt('/history')
    const file = new File(['{"hello": "world"}'], 'other.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('Import a quiz or history file'), file)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "doesn't look like a Quiz Generator quiz",
    )
  })

  it('plays a shared link, saves the score to History, and offers sharing', async () => {
    const user = userEvent.setup()
    const router = renderAt(`/play?q=${encodeQuizForLink(quiz)}`)
    expect(await screen.findByText(/Shared quiz/)).toBeInTheDocument()

    for (const [i, question] of quiz.questions.entries()) {
      await screen.findByRole('heading', { name: question.prompt })
      const label = i === 0 ? 'Venus' : correctAnswerText(question)
      await user.click(screen.getByRole('button', { name: new RegExp(`^.?\\s*${label}$`) }))
      await user.click(await screen.findByRole('button', { name: /next question|see results/i }))
    }
    expect(router.state.location.pathname).toBe('/results')
    expect(await screen.findByText(/Saved to/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Share' }))
    const dialog = await screen.findByRole('dialog', { name: /Share “Planets 101”/ })
    expect((within(dialog).getByLabelText('Share link') as HTMLInputElement).value).toContain(
      '#/play?q=',
    )
    await user.keyboard('{Escape}')

    await user.click(within(screen.getByText(/Saved to/)).getByRole('link', { name: 'History' }))
    const card = (await screen.findByRole('heading', { name: /Planets 101/ })).closest('li')!
    expect(within(card).getByText('Best 1/2 (50%)')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Retry missed (1)' })).toBeInTheDocument()
  })

  it('explains a broken share link', async () => {
    renderAt('/play?q=broken')
    expect(await screen.findByRole('alert')).toHaveTextContent(/incomplete or damaged/)
  })
})
