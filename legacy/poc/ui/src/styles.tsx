// ── Design tokens ─────────────────────────────────────────────────────────────

export const C = {
  primary:         '#4f46e5',
  primaryLight:    'rgba(79,70,229,0.1)',
  primaryRing:     '0 0 0 3px rgba(79,70,229,0.15)',
  bg:              '#f7f8fc',
  card:            '#ffffff',
  border:          '#e2e8f0',
  inputBorder:     '#cbd5e1',
  textDark:        '#0f172a',
  textBody:        '#374151',
  textMuted:       '#64748b',
  textPlaceholder: '#94a3b8',
  success:         '#10b981',
  successBg:       '#f0fdf4',
  successBorder:   '#a7f3d0',
  danger:          '#ef4444',
  dangerBg:        '#fef2f2',
  dangerBorder:    '#fecaca',
  warning:         '#f59e0b',
  warningBg:       '#fffbeb',
  warningBorder:   '#fde68a',
  stripedRow:      '#f8fafc',
  sidebar:         '#1b1f2e',
}

// ── Shared style objects ──────────────────────────────────────────────────────

export const s = {
  card: {
    background: C.card,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
  } as React.CSSProperties,

  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: C.textMuted,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  } as React.CSSProperties,

  input: {
    width: '100%',
    height: 40,
    padding: '0 12px',
    border: `1px solid ${C.inputBorder}`,
    borderRadius: 8,
    fontSize: 14,
    color: C.textBody,
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    fontFamily: 'inherit',
  } as React.CSSProperties,

  dropdown: {
    position: 'absolute' as const,
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    background: '#fff',
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,.1), 0 2px 8px rgba(0,0,0,.06)',
    zIndex: 200,
    maxHeight: 240,
    overflowY: 'auto' as const,
    animation: 'dropIn 0.14s ease',
  } as React.CSSProperties,

  th: {
    textAlign: 'left' as const,
    fontSize: 11,
    fontWeight: 600,
    color: C.textMuted,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    padding: '10px 16px',
    borderBottom: `1px solid ${C.border}`,
    background: C.bg,
  } as React.CSSProperties,

  td: {
    padding: '12px 16px',
    verticalAlign: 'middle' as const,
    borderBottom: `1px solid ${C.border}`,
    fontSize: 14,
    color: C.textBody,
  } as React.CSSProperties,

  btnPrimary: {
    background: C.primary,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '0 20px',
    height: 40,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'inherit',
    transition: 'background 0.15s ease, transform 0.1s ease',
    letterSpacing: '-0.01em',
  } as React.CSSProperties,

  btnSecondary: {
    background: '#fff',
    color: C.textBody,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '0 20px',
    height: 40,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'inherit',
    transition: 'background 0.15s ease, border-color 0.15s ease',
  } as React.CSSProperties,

  btnGhost: {
    background: 'transparent',
    color: C.primary,
    border: `1.5px dashed ${C.primary}`,
    borderRadius: 8,
    padding: '0 16px',
    height: 36,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'inherit',
    transition: 'background 0.15s ease',
    opacity: 0.8,
  } as React.CSSProperties,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function b64(u: string, p: string) {
  return 'Basic ' + btoa(`${u}:${p}`)
}

export function today() {
  return new Date().toISOString().split('T')[0]
}

export function formatCurrency(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n)
}

// ── Auth props shared by all pages ────────────────────────────────────────────

export interface AuthProps {
  apiBase: string
  tenantId: string
  token?: string      // JWT Bearer — usado cuando se hace login
  username?: string   // legacy / fallback
  password?: string
}

/** Devuelve el header Authorization correcto según lo disponible */
export function authHeader(auth: AuthProps): string {
  if (auth.token)    return `Bearer ${auth.token}`
  if (auth.username) return 'Basic ' + btoa(`${auth.username}:${auth.password}`)
  return ''
}

/**
 * fetch wrapper que detecta 401 y dispara logout global.
 * Reemplaza fetch() en todas las páginas.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, options)
  if (res.status === 401) {
    localStorage.removeItem('etendo_token')
    localStorage.removeItem('etendo_tenant')
    window.dispatchEvent(new Event('etendo:logout'))
  }
  return res
}

// ── Spinner ───────────────────────────────────────────────────────────────────

import React from 'react'

export function Spinner({ size = 16, color = C.primary }: { size?: number; color?: string }) {
  return (
    <span style={{
      display: 'inline-block',
      width: size,
      height: size,
      border: `2px solid rgba(0,0,0,0.08)`,
      borderTop: `2px solid ${color}`,
      borderRadius: '50%',
      animation: 'spin 0.65s linear infinite',
      flexShrink: 0,
    }} />
  )
}

// ── SkeletonRow ───────────────────────────────────────────────────────────────

export function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ ...s.td }}>
          <div style={{
            height: 14,
            borderRadius: 6,
            background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s infinite',
            width: i === 0 ? '60%' : '40%',
          }} />
        </td>
      ))}
    </tr>
  )
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    CO: { bg: C.successBg,  color: C.success,  label: 'Confirmed' },
    DR: { bg: C.bg,         color: C.textMuted, label: 'Draft'     },
    VO: { bg: C.dangerBg,   color: C.danger,    label: 'Voided'    },
    AP: { bg: C.warningBg,  color: C.warning,   label: 'Approved'  },
  }
  const cfg = map[status] ?? { bg: C.bg, color: C.textMuted, label: status }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 10px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      background: cfg.bg,
      color: cfg.color,
      letterSpacing: '0.02em',
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: cfg.color,
        display: 'inline-block',
        flexShrink: 0,
      }} />
      {cfg.label}
    </span>
  )
}

// ── PageHeader ────────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 28,
    }}>
      <div>
        <h1 style={{
          fontSize: 24,
          fontWeight: 700,
          color: C.textDark,
          letterSpacing: '-0.4px',
          margin: '0 0 4px',
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 14, color: C.textMuted, margin: 0 }}>{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  )
}

// ── ErrorBanner ───────────────────────────────────────────────────────────────

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div style={{
      background: C.dangerBg,
      border: `1px solid ${C.dangerBorder}`,
      borderRadius: 10,
      padding: '12px 16px',
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      animation: 'dropIn 0.15s ease',
    }}>
      <div style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: C.danger,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>
      <span style={{ fontSize: 13, fontWeight: 500, color: C.danger, flex: 1 }}>{message}</span>
      {onDismiss && (
        <button
          type="button"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.danger, padding: 2, display: 'flex', alignItems: 'center' }}
          onClick={onDismiss}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ── Global CSS keyframes (injected once) ──────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

* { box-sizing: border-box; }
body { margin: 0; }

@keyframes spin {
  to { transform: rotate(360deg); }
}
@keyframes dropIn {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.9); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`

let injected = false
export function injectGlobalCSS() {
  if (injected) return
  injected = true
  const el = document.createElement('style')
  el.textContent = CSS
  document.head.appendChild(el)
}
