import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { StatCard, Panel, Badge, Row, Grid, TOOLTIP_STYLE, AXIS_TICK, GRID_COLOR } from '../ui'
import { fetchUploads, fetchConsistency, fetchStrains, fetchUploadsCount, fetchConsistencyAlerts } from '../../api'

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
  const [uploads, setUploads]   = useState(null)
  const [fleet, setFleet]       = useState(null)
  const [strains, setStrains]   = useState(null)
  const [coaCount, setCoaCount] = useState(null)
  const [alerts, setAlerts]     = useState(null)

  useEffect(() => {
    setUploads(null)
    fetchUploads()
      .then(setUploads)
      .catch(() => setUploads([]))
  }, [refreshKey])

  useEffect(() => {
    setFleet(null)
    fetchConsistency()
      .then(setFleet)
      .catch(() => setFleet([]))
  }, [refreshKey])

  useEffect(() => {
    setStrains(null)
    fetchStrains()
      .then(setStrains)
      .catch(() => setStrains([]))
  }, [refreshKey])

  useEffect(() => {
    setCoaCount(null)
    fetchUploadsCount()
      .then(setCoaCount)
      .catch(() => setCoaCount(0))
  }, [refreshKey])

  useEffect(() => {
    setAlerts(null)
    fetchConsistencyAlerts()
      .then(setAlerts)
      .catch(() => setAlerts([]))
  }, [refreshKey])

  const avgStability = strains && strains.length > 0
    ? Math.round(strains.reduce((s, x) => s + (x.stability ?? 0), 0) / strains.length)
    : 0

  const flaggedCount = alerts ? new Set(alerts.map(a => a.strain)).size : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Grid cols={4} gap={8}>
        <StatCard
          label="Active Strains"
          value={strains ? strains.length : '—'}
          sub={strains ? `${strains.length} tracked` : 'Loading…'}
        />
        <StatCard
          label="COAs on File"
          value={coaCount !== null ? coaCount : '—'}
          sub="All labs"
        />
        <StatCard
          label="Avg Consistency"
          value={strains ? `${avgStability}/100` : '—'}
          sub={strains ? (avgStability >= 90 ? 'Excellent' : avgStability >= 80 ? 'Good' : 'Needs attention') : 'Loading…'}
          subVariant={strains && avgStability < 80 ? 'warn' : undefined}
        />
        <StatCard
          label="Flagged Batches"
          value={alerts ? flaggedCount : '—'}
          sub={alerts ? (flaggedCount ? `${flaggedCount} strain${flaggedCount !== 1 ? 's' : ''} flagged` : 'All within tolerance') : 'Loading…'}
          subVariant={flaggedCount > 0 ? 'warn' : undefined}
        />
      </Grid>

      <Grid cols={2} gap={10}>
        <Panel title="Fleet THC Consistency – all strains" titleRight={fleet ? `${fleet.length} uploads` : ''} fullWidth>
          {fleet === null ? (
            <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 12 }}>
              Loading…
            </div>
          ) : fleet.length === 0 ? (
            <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 12 }}>
              No data yet — upload a COA to see results
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={fleet} barCategoryGap="30%">
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
          {uploads === null ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>Loading…</div>
          ) : uploads.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>No uploads yet</div>
          ) : (
            uploads.map((u, i) => (
              <Row key={u.id} last={i === uploads.length - 1}>
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
          {alerts === null ? (
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
