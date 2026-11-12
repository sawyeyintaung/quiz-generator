import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

export function RouteErrorPage() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error'

  // After a new deploy, an open tab may ask for code files that no longer exist.
  const outdated = /dynamically imported module|module script failed|Loading chunk/i.test(message)

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">
        {outdated ? 'A new version is available' : 'Something went wrong'}
      </h1>
      <p className="text-muted mt-2 text-sm">
        {outdated ? 'Reload the page to get the latest version of Quiz Generator.' : message}
      </p>
      <div className="mt-6 flex justify-center gap-4">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="bg-accent hover:bg-accent-strong rounded-xl px-5 py-2.5 font-semibold text-white"
        >
          Reload
        </button>
        <Link to="/" className="text-brand self-center font-medium underline">
          Back to start
        </Link>
      </div>
    </div>
  )
}
