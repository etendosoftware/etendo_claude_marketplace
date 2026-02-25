import { useState } from 'react'
import { C, s, Spinner } from '../styles'

interface Props {
  onLogin: (token: string, tenantId: string) => void
}

export default function Login({ onLogin }: Props) {
  const tenantId = 'demo'
  const [username, setUsername]    = useState('admin')
  const [password, setPassword]    = useState('')
  const [loading, setLoading]      = useState(false)
  const [error, setError]          = useState<string | null>(null)
  const [focusedField, setFocused] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/lite/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      onLogin(data.token, tenantId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function inputStyle(field: string): React.CSSProperties {
    return {
      ...s.input,
      borderColor: focusedField === field ? C.primary : C.inputBorder,
      boxShadow:   focusedField === field ? C.primaryRing : 'none',
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    }}>
      <div style={{
        ...s.card,
        width: 400,
        padding: '40px 36px',
        animation: 'scaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <h1 style={{
            fontSize: 22,
            fontWeight: 700,
            color: C.textDark,
            letterSpacing: '-0.3px',
            margin: '0 0 4px',
          }}>
            Etendo Lite
          </h1>
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
            Iniciá sesión para continuar
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: C.dangerBg,
            border: `1px solid ${C.dangerBorder}`,
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 20,
            fontSize: 13,
            color: C.danger,
            fontWeight: 500,
            animation: 'dropIn 0.15s ease',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={s.label}>Usuario</label>
            <input
              style={inputStyle('username')}
              value={username}
              onChange={e => setUsername(e.target.value)}
              onFocus={() => setFocused('username')}
              onBlur={() => setFocused(null)}
              placeholder="admin"
              autoComplete="username"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={s.label}>Contraseña</label>
            <input
              type="password"
              style={inputStyle('password')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...s.btnPrimary,
              width: '100%',
              height: 44,
              fontSize: 15,
              justifyContent: 'center',
              opacity: loading ? 0.75 : 1,
              cursor: loading ? 'wait' : 'pointer',
            }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#4338ca' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.primary }}
          >
            {loading ? <Spinner size={16} color="rgba(255,255,255,0.8)" /> : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
