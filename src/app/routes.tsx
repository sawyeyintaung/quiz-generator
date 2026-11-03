import type { RouteObject } from 'react-router'
import { AppLayout } from './AppLayout.tsx'
import { RouteErrorPage } from './RouteErrorPage.tsx'
import { CreatePage } from '../pages/CreatePage.tsx'
import { PlayPage } from '../pages/PlayPage.tsx'
import { ResultsPage } from '../pages/ResultsPage.tsx'
import { HistoryPage } from '../pages/HistoryPage.tsx'
import { SettingsPage } from '../pages/SettingsPage.tsx'
import { NotFoundPage } from '../pages/NotFoundPage.tsx'
import { PastePage } from '../pages/PastePage.tsx'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <CreatePage /> },
      { path: 'play', element: <PlayPage /> },
      { path: 'results', element: <ResultsPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'paste', element: <PastePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
