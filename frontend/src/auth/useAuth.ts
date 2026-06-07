import { amplifySignIn, amplifySignOut, amplifySignUp, amplifyConfirmSignUp } from './cognito'
import { useAuthContext } from './AuthProvider'
import { useQueryClient } from '@tanstack/react-query'

export function useAuth() {
  const { isAuthenticated, isLoading, setAuthenticated } = useAuthContext()
  const queryClient = useQueryClient()

  async function login(email: string, password: string) {
    await amplifySignIn({ email, password })
    setAuthenticated(true)
  }

  async function logout() {
    await amplifySignOut()
    setAuthenticated(false)
    queryClient.clear()
  }

  async function signup(email: string, password: string, name: string) {
    return amplifySignUp({ email, password, name })
  }

  async function confirmSignup(email: string, confirmationCode: string) {
    return amplifyConfirmSignUp({ email, confirmationCode })
  }

  return { isAuthenticated, isLoading, login, logout, signup, confirmSignup }
}
