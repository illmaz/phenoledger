import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { StatCard, Panel, Badge, Row, Grid, TOOLTIP_STYLE, AXIS_TICK, GRID_COLOR } from '../ui'
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

export default function Overview({ refreshKey }) {
  const [overview, setOverview] = useState(null)

  useEffect(() => {
    setOverview(null)
    fetchOverview()
      .then(setOverview)
      .catch(() => setOverview({}))
  }, [refreshKey])

  const d = overview
  const avgStability = d?.avg_stability ?? 0
  const flaggedCount = d?.flagged_count ?? 0
  const consistency  = d?.consistency    ?? []
  const recentUploads = d?.recent_uploads ?? []
  const alerts       = d?.alerts         ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
            <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 12 }}>
              Loading…
            </div>
          ) : consistency.length === 0 ? (
            <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 12 }}>
              No data yet — upload a COA to see results
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={consistency} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="strain" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={v => v + '%'} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => v.toFixed(2) + '%'} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#666' }} iconType="rect" iconSize={8} />
                <Bar dataKey="thca" name="THCA %" fill="#4ade80" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
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
