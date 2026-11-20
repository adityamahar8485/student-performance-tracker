import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Notice from '../components/Notice.jsx'
import Field from '../components/Field.jsx'

export default function Login() {
  const { user, login, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  if (user) return <Navigate to={`/${user.role}`} replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const u = await login(email, password)
      navigate(`/${u.role}`)
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed - is the API running?')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Notice pin="gold" tilt={-0.6}>
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[0.04em]">
            Student Performance Tracker
          </h1>
          <p className="mt-1 mb-6 text-sm text-ink-soft">Sign in to your notice board</p>

          {error && (
            <div role="alert" className="mb-4 rounded-sm bg-pin-red/10 px-3 py-2 text-sm font-medium text-pin-red-text">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
            <Field label="Email" id="email">
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field"
                placeholder="you@school.dev"
              />
            </Field>
            <Field label="Password" id="password">
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
                placeholder="••••••••"
              />
            </Field>
            <button type="submit" disabled={loading} className="btn w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </Notice>
      </div>
    </div>
  )
}
