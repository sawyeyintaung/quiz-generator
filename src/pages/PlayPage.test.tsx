import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from '../app/routes.tsx'
import { demoQuiz } from '../features/quiz/demoQuiz.ts'
import { correctAnswerText } from '../features/quiz/schema.ts'

function renderDemo() {
  const router = createMemoryRouter(routes, { initialEntries: ['/play?demo'] })
  render(<RouterProvider router={router} />)
  return router
}

async function nextQuestion(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /next question|see results/i }))
}

describe('playing a quiz', () => {
  it('shows feedback and the explanation after answering', async () => {
    const user = userEvent.setup()
    renderDemo()
    await user.click(await screen.findByRole('button', { name: /Mercury/ }))
    expect(await screen.findByText('Correct!')).toBeInTheDocument()
    expect(screen.getByText(demoQuiz.questions[0].explanation)).toBeInTheDocument()
    // Options are locked once answered.
    expect(screen.getByRole('button', { name: /Venus/ })).toBeDisabled()
  })

  it('shows the correct answer after a wrong answer', async () => {
    const user = userEvent.setup()
    renderDemo()
    await user.click(await screen.findByRole('button', { name: /Venus/ }))
    expect(await screen.findByText('Not quite. The answer is: Mercury')).toBeInTheDocument()
  })

  it('supports keyboard answers', async () => {
    const user = userEvent.setup()
    renderDemo()
    await screen.findByRole('heading', { name: demoQuiz.questions[0].prompt })
    await user.keyboard('2')
    expect(await screen.findByText('Correct!')).toBeInTheDocument()
  })

  it('plays through to results and retries missed questions', async () => {
    const user = userEvent.setup()
    const router = renderDemo()

    // Answer the first question wrong and the rest right.
    for (const [i, question] of demoQuiz.questions.entries()) {
      await screen.findByRole('heading', { name: question.prompt })
      const label = i === 0 ? 'Venus' : correctAnswerText(question)
      await user.click(screen.getByRole('button', { name: new RegExp(`^.?\\s*${label}$`) }))
      await nextQuestion(user)
    }

    expect(router.state.location.pathname).toBe('/results')
    expect(await screen.findByRole('heading', { level: 1, name: 'Results' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /You scored 7 out of 8/ })).toBeInTheDocument()
    expect(screen.getByText('Review what you missed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry missed (1)' }))
    expect(router.state.location.pathname).toBe('/play')
    expect(
      await screen.findByRole('heading', { name: demoQuiz.questions[0].prompt }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Question 1 of 1/)).toBeInTheDocument()
  })
})
