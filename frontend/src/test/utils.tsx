import { type ReactElement, type ReactNode } from 'react'
import { render } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// テスト用の QueryClient。retry を切ってエラー系を即時に観測できるようにする。
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

function Providers({
  children,
  queryClient,
  initialEntries,
}: {
  children: ReactNode
  queryClient: QueryClient
  initialEntries?: string[]
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={initialEntries ?? ['/']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  )
}

export function renderWithProviders(
  ui: ReactElement,
  opts: { initialEntries?: string[]; queryClient?: QueryClient } = {},
) {
  const queryClient = opts.queryClient ?? createTestQueryClient()
  return {
    queryClient,
    ...render(ui, {
      wrapper: ({ children }) => (
        <Providers queryClient={queryClient} initialEntries={opts.initialEntries}>
          {children}
        </Providers>
      ),
    }),
  }
}

// hooks 用（QueryClientProvider のみで十分なもの）
export function renderHookWithClient<T>(hook: () => T, queryClient = createTestQueryClient()) {
  return {
    queryClient,
    ...renderHook(hook, {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    }),
  }
}
