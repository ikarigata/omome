import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getCurrentCognitoUser } from './cognito'
import { DEV_BYPASS_AUTH } from '@/lib/devFlags'

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  setAuthenticated: (v: boolean) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setAuthenticated] = useState(DEV_BYPASS_AUTH)
  const [isLoading, setIsLoading] = useState(!DEV_BYPASS_AUTH)

  useEffect(() => {
    // 開発時の認証バイパス: Cognito を呼ばずに認証済み扱いにする
    if (DEV_BYPASS_AUTH) return
    getCurrentCognitoUser()
      .then((user) => setAuthenticated(user !== null))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, setAuthenticated }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}
