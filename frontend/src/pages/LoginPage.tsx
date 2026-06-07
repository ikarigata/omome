import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { ErrorMessage } from '@/components/ErrorMessage'

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-3xl font-bold text-center text-content-accent">omome</h1>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
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
            label="パスワード"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />

          <ErrorMessage message={error} />

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'ログイン中…' : 'ログイン'}
          </Button>
        </form>

        <p className="text-center text-sm text-content-secondary">
          アカウントをお持ちでない方は{' '}
          <Link to="/signup" className="text-content-accent underline">
            サインアップ
          </Link>
        </p>
      </div>
    </div>
  )
}
