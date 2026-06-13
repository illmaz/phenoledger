import { useState, useEffect } from 'react'
import { StatCard, Panel, Badge, Row, Grid } from '../ui'
import { fetchOverview } from '../../api'

function statusVariant(s) {
  if (s === 'confirmed') return 'ok'
  if (s === 'failed') return 'warn'
  return 'gray'
}

function statusLabel(s) {
  if (s === 'confirmed') return 'Processed'
  if (s === 'failed') return 'Failed'
  if (s === 'needs_review') return 'Review'
  return s
}

function alertVariant(status) {
  return status === 'drift' ? 'danger' : 'warn'
}

function stabilityColor(v) {
  if (v == null) return 'var(--text-3)'
  if (v >= 90) return '#4ade80'
  if (v >= 75) return '#fbbf24'
  return '#f87171'
}

export default function Overview({ refreshKey }) {
  const [overview, setOverview] = useState(null)

  useEffect(() => {
    setOverview(null)
    fetchOverview()
      .then(setOverview)
      .catch(() => setOverview({}))
  }, [refreshKey])

  const d = overview
  const avgStability  = d?.avg_stability ?? 0
  const flaggedCount  = d?.flagged_count ?? 0
  const consistency   = d?.consistency    ?? []
  const recentUploads = d?.recent_uploads ?? []
  const alerts        = d?.alerts         ?? []
  const nextActions   = d?.next_actions   ?? []

  const ranked = [...consistency].sort((a, b) => (a.stability ?? 101) - (b.stability ?? 101))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Grid cols={4} gap={8}>
        <StatCard
          label="Active Strains"
          value={d ? d.strain_count : '—'}
          sub={d ? `${d.strain_count} tracked` : 'Loading…'}
        />
        <StatCard
          label="COAs on File"
          value={d ? d.coa_count : '—'}
          sub="All labs"
        />
        <StatCard
          label="Avg Consistency"
          value={d ? `${avgStability}/100` : '—'}
          sub={d ? (avgStability >= 90 ? 'Excellent' : avgStability >= 80 ? 'Good' : 'Needs attention') : 'Loading…'}
          subVariant={d && avgStability < 80 ? 'warn' : undefined}
        />
        <StatCard
          label="Flagged Batches"
          value={d ? flaggedCount : '—'}
          sub={d ? (flaggedCount ? `${flaggedCount} strain${flaggedCount !== 1 ? 's' : ''} flagged` : 'All within tolerance') : 'Loading…'}
          subVariant={flaggedCount > 0 ? 'warn' : undefined}
        />
      </Grid>

      <Grid cols={2} gap={10}>
        <Panel title="Fleet THC Consistency – all strains" titleRight={d ? `${consistency.length} strains` : ''} fullWidth>
          {d === null ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>Loading…</div>
          ) : consistency.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>No data yet — upload a COA to see results</div>
          ) : (
            ranked.map((s, i) => (
              <Row key={s.strain} last={i === ranked.length - 1}>
                <span style={{ flex: 1, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  {s.strain}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: stabilityColor(s.stability), flexShrink: 0, width: 36, textAlign: 'right' }}>
                  {s.stability != null ? s.stability.toFixed(1) : '—'}
                </span>
                <span style={{ fontSize: 11, color: s.thca != null && s.thca < 1 ? '#f87171' : 'var(--text-3)', flexShrink: 0, width: 56, textAlign: 'right' }}>
                  {s.thca != null ? s.thca.toFixed(2) + '%' : '—'}
                </span>
              </Row>
            ))
          )}
        </Panel>

        <Panel title="Recent Uploads">
          {d === null ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>Loading…</div>
          ) : recentUploads.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>No uploads yet</div>
          ) : (
            recentUploads.map((u, i) => (
              <Row key={u.id} last={i === recentUploads.length - 1}>
                <span style={{ color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                  {u.name}
                  {u.lab && <span style={{ color: 'var(--text-3)' }}> · {u.lab}</span>}
                </span>
                <Badge variant={statusVariant(u.status)}>{statusLabel(u.status)}</Badge>
              </Row>
            ))
          )}
        </Panel>

        {nextActions.length > 0 && (
          <Panel title="Next Actions">
            {nextActions.map((a, i) => (
              <Row key={i} last={i === nextActions.length - 1}>
                <span style={{ color: '#fbbf24', flexShrink: 0, marginRight: 8, fontSize: 13, lineHeight: 1 }}>⚠</span>
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  {a.message}
                </span>
              </Row>
            ))}
          </Panel>
        )}

        <Panel title="Consistency Alerts">
          {d === null ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>Loading…</div>
          ) : alerts.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>
              All strains within tolerance.
            </div>
          ) : (
            alerts.map((a, i) => (
              <Row key={`${a.strain}-${a.compound}`} last={i === alerts.length - 1}>
                <span style={{ flex: 1, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  {a.strain}
                  <span style={{ color: 'var(--text-3)' }}> · {a.compound}</span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0, marginRight: 6 }}>
                  {a.cv_pct.toFixed(1)}% variation
                </span>
                <Badge variant={alertVariant(a.status)}>{a.status}</Badge>
              </Row>
            ))
          )}
        </Panel>
      </Grid>
    </div>
  )
}
