import type { RouteObject } from 'react-router'
import { AppLayout } from './AppLayout.tsx'
import { RouteErrorPage } from './RouteErrorPage.tsx'
import { CreatePage } from '../pages/CreatePage.tsx'
import { PlayPage } from '../pages/PlayPage.tsx'
import { NotFoundPage } from '../pages/NotFoundPage.tsx'

// Create and Play load up front (the main path). Other pages load on first visit,
// which keeps the first download small (History and sharing need the database code).
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <CreatePage /> },
      { path: 'play', element: <PlayPage /> },
      {
        path: 'results',
        lazy: async () => ({ Component: (await import('../pages/ResultsPage.tsx')).ResultsPage }),
      },
      {
        path: 'history',
        lazy: async () => ({ Component: (await import('../pages/HistoryPage.tsx')).HistoryPage }),
      },
      {
        path: 'settings',
        lazy: async () => ({
          Component: (await import('../pages/SettingsPage.tsx')).SettingsPage,
        }),
      },
      {
        path: 'paste',
        lazy: async () => ({ Component: (await import('../pages/PastePage.tsx')).PastePage }),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
