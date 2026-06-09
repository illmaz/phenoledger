const BADGE = {
  ok:     { bg: 'rgba(74,222,128,0.15)',  color: '#4ade80' },
  warn:   { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24' },
  info:   { bg: 'rgba(96,165,250,0.15)',  color: '#60a5fa' },
  purple: { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
  gray:   { bg: 'rgba(255,255,255,0.07)', color: '#888888' },
}

export function Badge({ variant = 'ok', children }) {
  const v = BADGE[variant] || BADGE.ok
  return (
    <span style={{
      fontSize: 10, padding: '2px 7px', borderRadius: 3, fontWeight: 600,
      background: v.bg, color: v.color, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

export function StatCard({ label, value, sub, subVariant = 'ok' }) {
  const subColor = subVariant === 'warn' ? '#fbbf24' : '#4ade80'
  return (
    <div style={{
      background: 'var(--card)', borderRadius: 8, padding: '12px 14px',
      border: '0.5px solid var(--border)',
    }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: subColor, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export function Panel({ title, titleRight, fullWidth, children, style = {} }) {
  return (
    <div style={{
      background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 8,
      padding: '1rem', gridColumn: fullWidth ? '1 / -1' : undefined, ...style,
    }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{title}</span>
          {titleRight && <span style={{ fontSize: 10, color: 'var(--text-2)' }}>{titleRight}</span>}
        </div>
      )}
      {children}
    </div>
  )
}

export function Row({ children, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 0', borderBottom: last ? 'none' : '0.5px solid var(--border)',
      fontSize: 12, gap: 8,
    }}>
      {children}
    </div>
  )
}

export function HBar({ label, value, max = 100, color = '#4ade80', showPct = false }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: 'var(--text-2)' }}>{label}</span>
        <span style={{ color, fontWeight: 500 }}>{showPct ? `${value}%` : value}</span>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

export function Grid({ cols = 2, gap = 10, children, style = {} }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap, ...style }}>
      {children}
    </div>
  )
}

export const TOOLTIP_STYLE = {
  background: '#2a2a2a', border: '0.5px solid #333', borderRadius: 6,
  fontSize: 11, color: '#f0f0f0',
}

export const AXIS_TICK = { fontSize: 10, fill: '#666' }
export const GRID_COLOR = 'rgba(255,255,255,0.05)'
