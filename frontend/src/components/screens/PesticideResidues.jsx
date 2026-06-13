import { useState, useEffect } from 'react'
import { Panel, Grid, StatCard, Badge } from '../ui'
import { fetchPesticideResults } from '../../api'

const RESULT_VARIANT = {
  pass:         'ok',
  fail:         'danger',
  detected:     'warn',
  not_detected: 'gray',
  nd:           'gray',
}

const RESULT_LABEL = {
  pass:         'Pass',
  fail:         'Fail',
  detected:     'Detected',
  not_detected: 'Not Detected',
  nd:           'ND',
}

const FILTER_OPTIONS = [
  { value: 'all',          label: 'All'           },
  { value: 'detected',     label: 'Detected'      },
  { value: 'not_detected', label: 'Not Detected'  },
  { value: 'fail',         label: 'Fail'          },
]

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtNum(v) {
  if (v == null) return '—'
  return typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 4 }) : v
}

// ── ResultRow ─────────────────────────────────────────────────────────────────

function ResultRow({ record, last }) {
  const resultKey = (record.result ?? '').toLowerCase().replace(' ', '_')
  const variant   = RESULT_VARIANT[resultKey] ?? 'gray'
  const label     = RESULT_LABEL[resultKey]   ?? record.result ?? '—'

  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'center',
      padding: '8px 0',
      borderBottom: last ? 'none' : '0.5px solid var(--border)',
    }}>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {record.strain_name ?? record.strain_id ?? '—'}
      </span>
      <span style={{ width: 110, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.lab ?? '—'}
      </span>
      <span style={{ width: 96, fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {fmtDate(record.report_date)}
      </span>
      <span style={{ width: 150, fontSize: 12, color: 'var(--text)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={record.compound_name ?? undefined}>
        {record.compound_name ?? '—'}
      </span>
      <span style={{ width: 80, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, textAlign: 'right' }}>
        {fmtNum(record.value_ppb)}
      </span>
      <span style={{ width: 80, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, textAlign: 'right' }}>
        {fmtNum(record.loq_ppb)}
      </span>
      <span style={{ width: 100, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, textAlign: 'right' }}>
        {fmtNum(record.action_limit_ppb)}
      </span>
      <span style={{ width: 90, flexShrink: 0 }}>
        <Badge variant={variant}>{label}</Badge>
      </span>
    </div>
  )
}

// ── PesticideResidues ─────────────────────────────────────────────────────────

export default function PesticideResidues() {
  const [records,     setRecords]     = useState(null)
  const [filter,      setFilter]      = useState('all')

  async function loadRecords() {
    try {
      const data = await fetchPesticideResults()
      setRecords(data)
    } catch {
      setRecords([])
    }
  }

  useEffect(() => { loadRecords() }, [])

  const hdr = { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }

  const data = records ?? []

  const detected     = data.filter(r => ['detected', 'fail'].includes((r.result ?? '').toLowerCase()))
  const notDetected  = data.filter(r => ['not_detected', 'nd'].includes((r.result ?? '').toLowerCase()))
  const passCount    = data.filter(r => (r.result ?? '').toLowerCase() === 'pass').length
  const passRate     = data.length > 0 ? Math.round((passCount / data.length) * 100) : 0

  const filtered = filter === 'all'
    ? data
    : filter === 'detected'
      ? data.filter(r => ['detected'].includes((r.result ?? '').toLowerCase()))
      : filter === 'not_detected'
        ? data.filter(r => ['not_detected', 'nd'].includes((r.result ?? '').toLowerCase()))
        : data.filter(r => (r.result ?? '').toLowerCase() === filter)

  const inp = {
    padding: '6px 9px', fontSize: 12,
    border: '0.5px solid var(--border)', borderRadius: 6,
    background: 'var(--bg)', color: 'var(--text)', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {records !== null && data.length > 0 && (
        <Grid cols={4} gap={8}>
          <StatCard label="Total Tests"   value={data.length} />
          <StatCard label="Detected / Fail" value={detected.length} subVariant={detected.length > 0 ? 'warn' : undefined} />
          <StatCard label="Not Detected"  value={notDetected.length} />
          <StatCard label="Pass Rate"     value={`${passRate}%`} />
        </Grid>
      )}

      {records === null ? (
        <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '32px', textAlign: 'center' }}>Loading…</div>
      ) : data.length === 0 ? (
        <Panel>
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            No pesticide residue data yet. Upload COA reports to populate this screen.
          </div>
        </Panel>
      ) : (
        <Panel fullWidth titleRight={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Filter:</span>
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{ ...inp, padding: '4px 8px' }}
            >
              {FILTER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        }>
          {/* Header */}
          <div style={{ display: 'flex', gap: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--border)', marginBottom: 2 }}>
            <span style={{ ...hdr, flex: 1 }}>Strain</span>
            <span style={{ ...hdr, width: 110 }}>Lab</span>
            <span style={{ ...hdr, width: 96 }}>Report Date</span>
            <span style={{ ...hdr, width: 150 }}>Compound</span>
            <span style={{ ...hdr, width: 80, textAlign: 'right' }}>Value (ppb)</span>
            <span style={{ ...hdr, width: 80, textAlign: 'right' }}>LOQ (ppb)</span>
            <span style={{ ...hdr, width: 100, textAlign: 'right' }}>Limit (ppb)</span>
            <span style={{ ...hdr, width: 90 }}>Result</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
              No records match this filter.
            </div>
          ) : (
            filtered.map((r, i) => (
              <ResultRow
                key={r.id ?? i}
                record={r}
                last={i === filtered.length - 1}
              />
            ))
          )}
        </Panel>
      )}
    </div>
  )
}
