import { Navigate, Outlet } from 'react-router-dom'
import { useAuthContext } from '@/auth/AuthProvider'

export function PrivateRoute() {
  const { isAuthenticated, isLoading } = useAuthContext()

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="text-content-secondary text-sm">読み込み中…</span>
      </div>
    )
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}

export function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuthContext()

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="text-content-secondary text-sm">読み込み中…</span>
      </div>
    )
  }

  return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />
}
