import { createHashRouter } from 'react-router'
import { routes } from './routes.tsx'

// Hash routing: works on any static host without rewrite rules, and keeps
// share-link data (/#/play?q=...) out of server requests.
export const router = createHashRouter(routes)
