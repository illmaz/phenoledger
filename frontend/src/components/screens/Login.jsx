import { useState } from 'react'

const DEMO_EMAIL    = 'demo@phenoledger.com'
const DEMO_PASSWORD = 'Phenoledger123!'

export default function Login({ onLogin }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    setTimeout(() => {
      if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
        onLogin('demo-session-' + Date.now())
      } else {
        setError('Invalid credentials')
        setLoading(false)
      }
    }, 350)
  }

  const inputStyle = (hasError) => ({
    width: '100%', padding: '8px 10px', fontSize: 12, boxSizing: 'border-box',
    border: `0.5px solid ${hasError ? '#f87171' : 'var(--border)'}`,
    borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', outline: 'none',
    transition: 'border-color 0.15s',
  })

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{
        width: 380, background: 'var(--card)',
        border: '0.5px solid var(--border)', borderRadius: 12,
        padding: '40px 36px 36px',
        boxShadow: '0 0 0 1px rgba(74,222,128,0.06), 0 24px 48px rgba(0,0,0,0.4)',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontSize: 20, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--text)',
          }}>
            Pheno<span style={{ color: '#4ade80' }}>Ledger</span>
          </div>
          <div style={{
            fontSize: 11, color: 'var(--text-3)', marginTop: 7,
            letterSpacing: '0.04em',
          }}>
            Cannabis COA Intelligence Platform
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-2)', display: 'block', marginBottom: 5, letterSpacing: '0.03em' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              placeholder="you@example.com"
              autoComplete="email"
              required
              style={inputStyle(!!error)}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-2)', display: 'block', marginBottom: 5, letterSpacing: '0.03em' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              style={inputStyle(!!error)}
            />
          </div>

          {error && (
            <div style={{ fontSize: 12, color: '#f87171', marginTop: -4 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4, padding: '9px', fontSize: 12, fontWeight: 600,
              border: 'none', borderRadius: 6,
              background: loading ? '#2d6e4a' : '#4ade80',
              color: '#0a0a0a', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.8 : 1, transition: 'background 0.15s, opacity 0.15s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
