import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { StatCard, Panel, Badge, Row, Grid, TOOLTIP_STYLE, AXIS_TICK, GRID_COLOR } from '../ui'
import { alerts } from '../../data/index'
import { fetchUploads, fetchConsistency } from '../../api'

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

export default function Overview({ refreshKey }) {
  const [uploads, setUploads] = useState(null)
  const [fleet, setFleet] = useState(null)

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Grid cols={4} gap={8}>
        <StatCard label="Active Strains"   value="12"     sub="3 added this month" />
        <StatCard label="COAs on File"     value={uploads ? uploads.length : '—'} sub="All labs verified" />
        <StatCard label="Avg Consistency"  value={<>91<span style={{ fontSize: 12, color: 'var(--text-2)' }}>/100</span></>} sub="Fleet-wide score" />
        <StatCard label="Flagged Batches"  value="2"      sub="Drift detected" subVariant="warn" />
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
          {alerts.map((a, i) => (
            <Row key={a.label} last={i === alerts.length - 1}>
              <span style={{ color: 'var(--text-2)' }}>{a.label}</span>
              <Badge variant="warn">{a.detail}</Badge>
            </Row>
          ))}
          <div style={{ fontSize: 11, color: 'var(--text-3)', paddingTop: 10 }}>
            All other strains within tolerance
          </div>
        </Panel>
      </Grid>
    </div>
  )
}
