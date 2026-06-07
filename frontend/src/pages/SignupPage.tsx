import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { ErrorMessage } from '@/components/ErrorMessage'

type Step = 'form' | 'confirm'

export function SignupPage() {
  const { signup, confirmSignup, login } = useAuth()
  const [step, setStep] = useState<Step>('form')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signup(email, password, name)
      setStep('confirm')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'サインアップに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await confirmSignup(email, code)
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : '確認に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-3xl font-bold text-center text-content-accent">omome</h1>

        {step === 'form' ? (
          <form onSubmit={(e) => void handleSignup(e)} className="space-y-4">
            <Input
              label="名前"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="山田 太郎"
              required
              autoComplete="name"
            />
            <Input
              label="メールアドレス"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            <Input
              label="パスワード（8文字以上・英大小文字・数字を含む）"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              minLength={8}
            />

            <ErrorMessage message={error} />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登録中…' : 'アカウント作成'}
            </Button>
          </form>
        ) : (
          <form onSubmit={(e) => void handleConfirm(e)} className="space-y-4">
            <p className="text-sm text-content-secondary text-center">
              {email} に確認コードを送信しました。
            </p>
            <Input
              label="確認コード"
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              required
              autoComplete="one-time-code"
            />

            <ErrorMessage message={error} />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '確認中…' : '確認'}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-content-secondary">
          すでにアカウントをお持ちの方は{' '}
          <Link to="/login" className="text-content-accent underline">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  )
}
