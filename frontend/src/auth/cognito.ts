import { Amplify } from 'aws-amplify'
import {
  signIn,
  signUp,
  confirmSignUp,
  signOut,
  fetchAuthSession,
  getCurrentUser,
} from 'aws-amplify/auth'

export function configureAmplify() {
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID as string | undefined
  const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined

  // 認証バイパス（見た目確認）時は Cognito 設定なしでも起動できるようスキップ
  if (!userPoolId || !userPoolClientId) return

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
      },
    },
  })
}

export async function amplifySignUp(params: {
  email: string
  password: string
  name: string
}) {
  return signUp({
    username: params.email,
    password: params.password,
    options: {
      userAttributes: {
        email: params.email,
        name: params.name,
      },
    },
  })
}

export async function amplifyConfirmSignUp(params: {
  email: string
  confirmationCode: string
}) {
  return confirmSignUp({
    username: params.email,
    confirmationCode: params.confirmationCode,
  })
}

export async function amplifySignIn(params: { email: string; password: string }) {
  return signIn({ username: params.email, password: params.password })
}

export async function amplifySignOut() {
  return signOut()
}

export async function getAccessToken(): Promise<string> {
  const session = await fetchAuthSession()
  const token = session.tokens?.accessToken?.toString()
  if (!token) throw new Error('No access token')
  return token
}

export async function getCurrentCognitoUser() {
  try {
    return await getCurrentUser()
  } catch {
    return null
  }
}
