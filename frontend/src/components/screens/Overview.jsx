import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { StatCard, Panel, Badge, Row, Grid, TOOLTIP_STYLE, AXIS_TICK, GRID_COLOR } from '../ui'
import { fetchUploads, fetchConsistency, fetchStrains, fetchUploadsCount } from '../../api'

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

function computeDrift(fleet) {
  if (!fleet || fleet.length === 0) return []
  const groups = {}
  for (const r of fleet) {
    if (!groups[r.strain]) groups[r.strain] = []
    groups[r.strain].push(r.thca)
  }
  const drifts = []
  for (const [strain, vals] of Object.entries(groups)) {
    if (vals.length < 2) continue
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    const latest = vals[vals.length - 1]
    const delta = latest - avg
    if (Math.abs(delta) > 2) {
      drifts.push({
        label: `${strain} – THCA`,
        detail: `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(1)}%`,
      })
    }
  }
  return drifts
}

function DriftModal({ drift, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#222', border: '0.5px solid #3a3a3a', borderRadius: 10,
          padding: '1.25rem', width: 360, maxWidth: '90vw',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Drifting Compounds</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 12 }}>
          Batches where the latest value deviates more than ±2% from the strain average.
        </div>
        {drift.map((a, i) => (
          <Row key={a.label} last={i === drift.length - 1}>
            <span style={{ color: 'var(--text-2)' }}>{a.label}</span>
            <Badge variant="warn">{a.detail}</Badge>
          </Row>
        ))}
        {drift.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-3)', paddingTop: 4 }}>No drifting compounds.</div>
        )}
      </div>
    </div>
  )
}

export default function Overview({ refreshKey }) {
  const [uploads, setUploads] = useState(null)
  const [fleet, setFleet] = useState(null)
  const [strains, setStrains] = useState(null)
  const [coaCount, setCoaCount] = useState(null)
  const [driftOpen, setDriftOpen] = useState(false)

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

  const drift = computeDrift(fleet)
  const avgStability = strains && strains.length > 0
    ? Math.round(strains.reduce((s, x) => s + (x.stability ?? 0), 0) / strains.length)
    : 0
  const flaggedCount = strains ? strains.filter(s => s.status === 'watch' || s.status === 'drift').length : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {driftOpen && <DriftModal drift={drift} onClose={() => setDriftOpen(false)} />}

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
        <div onClick={() => setDriftOpen(true)} style={{ cursor: 'pointer' }}>
          <StatCard
            label="Flagged Batches"
            value={strains ? flaggedCount : '—'}
            sub={strains ? (flaggedCount ? 'Click to view drift' : 'All within tolerance') : 'Loading…'}
            subVariant={flaggedCount > 0 ? 'warn' : undefined}
          />
        </div>
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
          {fleet === null ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>Loading…</div>
          ) : drift.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>
              {fleet.length < 2
                ? 'Upload more COAs to detect drift across batches.'
                : 'All strains within tolerance.'}
            </div>
          ) : (
            <>
              {drift.map((a, i) => (
                <Row key={a.label} last={i === drift.length - 1}>
                  <span style={{ color: 'var(--text-2)' }}>{a.label}</span>
                  <Badge variant="warn">{a.detail}</Badge>
                </Row>
              ))}
              <div style={{ fontSize: 11, color: 'var(--text-3)', paddingTop: 10 }}>
                All other strains within tolerance
              </div>
            </>
          )}
        </Panel>
      </Grid>
    </div>
  )
}
