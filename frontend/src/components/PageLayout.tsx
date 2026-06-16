import { type ReactNode } from 'react'
import { BottomNav } from './BottomNav'

interface PageLayoutProps {
  title?: string
  headerRight?: ReactNode
  children: ReactNode
  hideNav?: boolean
}

export function PageLayout({ title, headerRight, children, hideNav }: PageLayoutProps) {
  return (
    <div className="flex flex-col min-h-dvh max-w-md mx-auto">
      {title !== undefined && (
        <header className="sticky top-0 z-10 bg-surface-primary border-b border-border-default px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between">
          <h1 className="text-lg font-bold">{title}</h1>
          {headerRight}
        </header>
      )}
      <main
        className={`flex-1 ${
          hideNav
            ? 'pb-[env(safe-area-inset-bottom)]'
            : 'pb-[calc(5rem+env(safe-area-inset-bottom))]'
        }`}
      >
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  )
}
