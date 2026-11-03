import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section className="py-16 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-muted mt-2 text-sm">That page doesn&apos;t exist.</p>
      <Link to="/" className="text-brand mt-6 inline-block font-medium underline">
        Create a quiz
      </Link>
    </section>
  )
}
