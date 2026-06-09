import { useState, useEffect } from 'react'
import { ArrowLeft, Search, LayoutGrid, List, Info } from 'lucide-react'
import { StatCard, Panel, Badge, HBar, Grid } from '../ui'
import { fetchStrains, fetchStrainCannabinoids, fetchStrainTerpenes, fetchStrainBatches } from '../../api'

// ── constants ────────────────────────────────────────────────────────────────

const LAB_OPTIONS = [
  { key: 'all',              label: 'All Labs'        },
  { key: 'SC Labs',          label: 'SC Labs'         },
  { key: 'Confident LIMS',   label: 'Confident LIMS'  },
  { key: 'FESA Labs',        label: 'FESA Labs'       },
  { key: 'New Bloom Labs',   label: 'New Bloom'       },
  { key: 'Marin Analytics',  label: 'Marin Analytics' },
]

const CONSISTENCY_FILTERS = [
  { key: 'all',    label: 'All'    },
  { key: 'stable', label: 'Stable' },
  { key: 'watch',  label: 'Watch'  },
  { key: 'drift',  label: 'Drift'  },
]

const SAMPLE_TYPE_FILTERS = [
  { key: 'all',         label: 'All'      },
  { key: 'flower',      label: 'Flower'   },
  { key: 'concentrate', label: 'Conc.'    },
  { key: 'extract',     label: 'Extract'  },
]

const SORT_OPTIONS = [
  { key: 'recent',        label: 'Most Recent'      },
  { key: 'thca_high',     label: 'Highest THCA'     },
  { key: 'stability_low', label: 'Lowest Stability' },
  { key: 'az',            label: 'A – Z'            },
]

const STATUS_BADGE   = { excellent: 'ok', good: 'info', watch: 'warn', drift: 'danger' }
const STATUS_LABEL   = { excellent: 'Excellent', good: 'Good', watch: 'Watch', drift: 'Drift' }
const STATUS_DOT     = { excellent: '#4ade80', good: '#60a5fa', watch: '#fbbf24', drift: '#f87171' }
const STATUS_TOOLTIP = {
  excellent: 'Less than 5% variation across batches',
  good:      '5-10% variation, within normal range',
  watch:     '10-15% variation, monitor closely',
  drift:     'Over 15% variation, investigate',
}

const COMPOUND_COLOR = {
  THCA: '#4ade80', THC: '#4ade80', 'D9-THC': '#4ade80',
  CBD: '#60a5fa', CBDA: '#60a5fa',
  CBG: '#fbbf24', CBGA: '#fbbf24',
  CBN: '#a78bfa', CBC: '#f87171',
}

const TERPENE_COLOR = {
  'LIMONENE':           '#FCD34D',
  'LINALOOL':           '#A78BFA',
  'BETA-CARYOPHYLLENE': '#F59E0B',
  'BETA-MYRCENE':       '#6B8F47',
  'ALPHA-PINENE':       '#22C55E',
  'BETA-PINENE':        '#22C55E',
  'ALPHA-HUMULENE':     '#92400E',
  'TERPINOLENE':        '#14B8A6',
  'OCIMENE':            '#86EFAC',
  'ALPHA-BISABOLOL':    '#FB7185',
  'GUAIOL':             '#84CC16',
  'TRANS-B-FARNESENE':  '#A3A3A3',
  'GERANIOL':           '#FDBA74',
  'EUCALYPTOL':         '#BAE6FD',
  'CAMPHENE':           '#D1D5DB',
}

function colorFor(compound) {
  if (['THCA', 'THC', 'D9-THC', 'THCV'].includes(compound)) return '#4ade80'
  if (['CBGA', 'CBG'].includes(compound)) return '#fbbf24'
  return '#888888'
}

function terpeneColor(compound) {
  const key = compound.toUpperCase().replace(/[\s_]+/g, '-')
  return TERPENE_COLOR[key] ?? '#A855F7'
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusVariant(s) {
  if (s === 'confirmed') return 'ok'
  if (s === 'failed') return 'danger'
  return 'gray'
}

function statusLabel(s) {
  if (s === 'confirmed') return 'Processed'
  if (s === 'failed') return 'Failed'
  if (s === 'needs_review') return 'Review'
  return s ?? 'Pending'
}

function StatusBadgeWithTooltip({ status }) {
  const [showTip, setShowTip] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Badge variant={STATUS_BADGE[status] ?? 'gray'}>
        {STATUS_LABEL[status] ?? status}
      </Badge>
      <span
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        style={{ color: 'var(--text-3)', cursor: 'default', display: 'inline-flex', alignItems: 'center' }}
      >
        <Info size={10} />
      </span>
      {showTip && STATUS_TOOLTIP[status] && (
        <span style={{
          position: 'absolute', bottom: 'calc(100% + 4px)', right: 0,
          background: '#2a2a2a', border: '0.5px solid #3a3a3a', borderRadius: 5,
          padding: '5px 8px', fontSize: 11, color: 'var(--text-2)',
          whiteSpace: 'nowrap', zIndex: 100, pointerEvents: 'none',
        }}>
          {STATUS_TOOLTIP[status]}
        </span>
      )}
    </span>
  )
}

// ── StrainCard (grid view) ───────────────────────────────────────────────────

function StrainCard({ strain, thca, status, stability, onClick }) {
  const [hovered, setHovered] = useState(false)
  const barWidth = thca != null ? Math.min((thca / 35) * 100, 100) : 0

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#272727' : 'var(--card)',
        border: `0.5px solid ${hovered ? '#444' : 'var(--border)'}`,
        borderRadius: 8, padding: '14px 16px', cursor: 'pointer',
        transition: 'background 0.1s, border-color 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', flex: 1, paddingRight: 6 }}>{strain}</div>
        {status && (
          <div style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 2,
            background: STATUS_DOT[status] ?? '#888',
          }} />
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
        <span style={{ fontSize: 22, fontWeight: 500, color: '#4ade80' }}>
          {thca != null ? thca.toFixed(2) : '—'}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-2)' }}>% THCA</span>
      </div>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
        <div style={{ height: '100%', width: `${barWidth}%`, background: '#4ade80', borderRadius: 3 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10 }}>
        <span style={{ color: 'var(--text-3)' }}>Batch Stability</span>
        <span style={{ color: STATUS_DOT[status] ?? 'var(--text-2)', fontWeight: 500 }}>
          {stability != null ? `${stability}/100` : '—'}
        </span>
      </div>
    </div>
  )
}

// ── StrainRow (list view) ────────────────────────────────────────────────────

function StrainRow({ strain, thca, upload_count, status, stability, last, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 4px', cursor: 'pointer',
        borderBottom: last ? 'none' : '0.5px solid var(--border)',
        background: hovered ? 'rgba(255,255,255,0.02)' : 'transparent',
        borderRadius: 4, margin: '0 -4px',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {strain}
      </span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#4ade80', width: 64, textAlign: 'right', flexShrink: 0 }}>
        {thca != null ? `${thca.toFixed(2)}%` : '—'}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-3)', width: 68, textAlign: 'right', flexShrink: 0 }}>
        {upload_count ?? '—'} {upload_count === 1 ? 'batch' : 'batches'}
      </span>
      <span style={{ fontSize: 11, color: STATUS_DOT[status] ?? 'var(--text-3)', width: 52, textAlign: 'right', flexShrink: 0, fontWeight: 500 }}>
        {stability != null ? `${stability}/100` : '—'}
      </span>
      <div style={{ width: 110, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
        <StatusBadgeWithTooltip status={status} />
      </div>
    </div>
  )
}

// ── StrainList ───────────────────────────────────────────────────────────────

function StrainList({ strains, onSelect }) {
  const [query, setQuery]         = useState('')
  const [view, setView]           = useState('grid')
  const [labFilter, setLabFilter] = useState('all')
  const [thcaFilter, setThcaFilter] = useState('all')

  if (strains === null) {
    return (
      <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '24px 0', textAlign: 'center' }}>
        Loading…
      </div>
    )
  }

  const availableLabs = [...new Set(strains.map(s => s.lab).filter(Boolean))].sort()

  const filtered = strains
    .filter(s => !query || s.strain.toLowerCase().includes(query.toLowerCase()))
    .filter(s => labFilter === 'all' || s.lab === labFilter)
    .filter(s => {
      const t = s.thca ?? 0
      if (thcaFilter === 'low')    return t < 15
      if (thcaFilter === 'medium') return t >= 15 && t <= 25
      if (thcaFilter === 'high')   return t > 25
      return true
    })

  const isFiltering = labFilter !== 'all' || thcaFilter !== 'all' || Boolean(query)
  const anyFiltered = filtered.length > 0
  const avg = anyFiltered ? filtered.reduce((s, x) => s + (x.thca ?? 0), 0) / filtered.length : 0
  const hi  = anyFiltered ? Math.max(...filtered.map(x => x.thca ?? 0)) : 0
  const lo  = anyFiltered ? Math.min(...filtered.map(x => x.thca ?? Infinity)) : 0

  const btnBase = {
    fontSize: 11, padding: '4px 10px', border: 'none',
    background: 'transparent', cursor: 'pointer',
  }
  const toggleBase = {
    padding: '4px 7px', border: 'none',
    background: 'transparent', cursor: 'pointer',
    display: 'flex', alignItems: 'center',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Row 1: Search bar (full width) */}
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{
          position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-3)', pointerEvents: 'none',
        }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search strains…"
          style={{
            width: '100%', padding: '6px 10px 6px 28px', fontSize: 12,
            border: '0.5px solid var(--border)', borderRadius: 6,
            background: 'var(--card)', color: 'var(--text)', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Row 2: Lab dropdown | THCA range | View toggle */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>

        {/* Lab filter */}
        <select
          value={labFilter}
          onChange={e => setLabFilter(e.target.value)}
          style={{
            fontSize: 11, padding: '4px 8px', border: '0.5px solid var(--border)', borderRadius: 6,
            background: 'var(--card)', color: labFilter === 'all' ? 'var(--text-2)' : 'var(--text)',
            cursor: 'pointer', outline: 'none', flexShrink: 0,
          }}
        >
          <option value="all">All labs</option>
          {availableLabs.map(lab => (
            <option key={lab} value={lab}>{lab}</option>
          ))}
        </select>

        {/* THCA range buttons */}
        <div style={{ display: 'flex', border: '0.5px solid var(--border)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
          {THCA_FILTERS.map((f, i) => (
            <button
              key={f.key}
              onClick={() => setThcaFilter(f.key)}
              title={f.key === 'low' ? '< 15%' : f.key === 'medium' ? '15 – 25%' : f.key === 'high' ? '> 25%' : undefined}
              style={{
                ...btnBase,
                borderLeft: i > 0 ? '0.5px solid var(--border)' : 'none',
                background: thcaFilter === f.key ? 'rgba(255,255,255,0.07)' : 'transparent',
                color: thcaFilter === f.key ? 'var(--text)' : 'var(--text-2)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* View toggle */}
        <div style={{ display: 'flex', border: '0.5px solid var(--border)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
          <button
            onClick={() => setView('grid')}
            style={{
              ...toggleBase,
              borderRight: '0.5px solid var(--border)',
              background: view === 'grid' ? 'rgba(255,255,255,0.07)' : 'transparent',
              color: view === 'grid' ? 'var(--text)' : 'var(--text-2)',
            }}
          >
            <LayoutGrid size={13} />
          </button>
          <button
            onClick={() => setView('list')}
            style={{
              ...toggleBase,
              background: view === 'list' ? 'rgba(255,255,255,0.07)' : 'transparent',
              color: view === 'list' ? 'var(--text)' : 'var(--text-2)',
            }}
          >
            <List size={13} />
          </button>
        </div>
      </div>

      {/* Stat cards — only when there's data to show */}
      {strains.length > 0 && (
        <Grid cols={4} gap={8}>
          <StatCard
            label="Strains"
            value={isFiltering ? `${filtered.length} / ${strains.length}` : strains.length}
          />
          <StatCard label="Avg THCA" value={anyFiltered ? `${avg.toFixed(1)}%` : '—'} />
          <StatCard label="Highest"  value={anyFiltered ? `${hi.toFixed(1)}%`  : '—'} />
          <StatCard label="Lowest"   value={anyFiltered ? `${lo.toFixed(1)}%`  : '—'} />
        </Grid>
      )}

      {/* Content */}
      {strains.length === 0 ? (
        <div style={{
          background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 8,
          padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12,
        }}>
          No strains yet — upload a COA to see strains here.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 8,
          padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12,
        }}>
          No strains match the current filters.
        </div>
      ) : view === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {filtered.map(s => (
            <StrainCard
              key={s.strain}
              strain={s.strain}
              thca={s.thca}
              status={s.status}
              stability={s.stability}
              onClick={() => onSelect(s)}
            />
          ))}
        </div>
      ) : (
        <Panel fullWidth>
          {filtered.map((s, i) => (
            <StrainRow
              key={s.strain}
              strain={s.strain}
              thca={s.thca}
              upload_count={s.upload_count}
              status={s.status}
              stability={s.stability}
              last={i === filtered.length - 1}
              onClick={() => onSelect(s)}
            />
          ))}
        </Panel>
      )}

    </div>
  )
}

// ── BatchTable ───────────────────────────────────────────────────────────────

function batchStabilityInfo(batches) {
  const vals = batches.map(b => b.thca).filter(v => v != null)
  if (vals.length <= 1) return () => ({ score: 100, bStatus: 'excellent' })
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  return (thca) => {
    if (thca == null || mean === 0) return { score: 100, bStatus: 'excellent' }
    const dev = (Math.abs(thca - mean) / mean) * 100
    const score = Math.round(Math.max(0, 100 - dev))
    const bStatus = dev < 5 ? 'excellent' : dev < 10 ? 'good' : dev < 15 ? 'watch' : 'drift'
    return { score, bStatus }
  }
}

function BatchTable({ batches }) {
  if (batches === null) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '24px 0', textAlign: 'center' }}>
        Loading…
      </div>
    )
  }
  if (batches.length === 0) {
    return (
      <div style={{
        background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 8,
        padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12,
      }}>
        No batch data on file.
      </div>
    )
  }

  const hdr  = { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }
  const cell = { fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }
  const getStability = batchStabilityInfo(batches)
  // batches are newest-first; index i+1 is the chronologically prior batch
  const deltas = batches.map((b, i) => {
    const prev = batches[i + 1]
    if (!prev || b.thca == null || prev.thca == null) return null
    return b.thca - prev.thca
  })

  return (
    <Panel fullWidth>
      <div style={{ display: 'flex', gap: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--border)', marginBottom: 2 }}>
        <span style={{ ...hdr, width: 76 }}>Batch</span>
        <span style={{ ...hdr, width: 96 }}>Date</span>
        <span style={{ ...hdr, width: 60, textAlign: 'right' }}>THCA%</span>
        <span style={{ ...hdr, width: 72, textAlign: 'right' }}>vs prev</span>
        <span style={{ ...hdr, width: 52, textAlign: 'right' }}>CBD%</span>
        <span style={{ ...hdr, flex: 1 }}>Top Terpene</span>
        <span style={{ ...hdr, width: 150, textAlign: 'right' }}>Stability</span>
        <span style={{ ...hdr, width: 68, textAlign: 'right' }}>Status</span>
      </div>
      {batches.map((b, i) => {
        const { score, bStatus } = getStability(b.thca)
        const delta = deltas[i]
        const deltaColor = delta == null ? 'var(--text-3)' : delta > 0 ? '#4ade80' : delta < 0 ? '#f87171' : 'var(--text-3)'
        const deltaLabel = delta == null
          ? '—'
          : delta === 0
            ? '0.00%'
            : `${delta > 0 ? '+' : ''}${delta.toFixed(2)}%`
        return (
          <div
            key={b.report_id}
            style={{
              display: 'flex', gap: 12, alignItems: 'center',
              padding: '7px 0',
              borderBottom: i === batches.length - 1 ? 'none' : '0.5px solid var(--border)',
            }}
          >
            <span style={{ width: 76, fontFamily: 'monospace', fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>
              {b.report_id.slice(0, 8).toUpperCase()}
            </span>
            <span style={{ ...cell, width: 96 }}>{fmtDate(b.date)}</span>
            <span style={{ width: 60, textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#4ade80', flexShrink: 0 }}>
              {b.thca != null ? `${b.thca.toFixed(2)}%` : '—'}
            </span>
            <span style={{ width: 72, textAlign: 'right', fontSize: 11, fontWeight: 500, color: deltaColor, flexShrink: 0 }}>
              {deltaLabel}
            </span>
            <span style={{ ...cell, width: 52, textAlign: 'right' }}>
              {b.cbd != null ? `${b.cbd.toFixed(3)}%` : '—'}
            </span>
            <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden' }}>
              {b.top_terpene ? (
                <>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: terpeneColor(b.top_terpene.compound),
                  }} />
                  <span style={{ ...cell, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.top_terpene.compound}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>
                    {b.top_terpene.value_pct.toFixed(3)}%
                  </span>
                </>
              ) : <span style={cell}>—</span>}
            </span>
            <div style={{ width: 150, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: STATUS_DOT[bStatus] ?? 'var(--text-2)' }}>
                {score}/100
              </span>
              <StatusBadgeWithTooltip status={bStatus} />
            </div>
            <div style={{ width: 68, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
              <Badge variant={statusVariant(b.status)}>{statusLabel(b.status)}</Badge>
            </div>
          </div>
        )
      })}
    </Panel>
  )
}

// ── StrainDetail ─────────────────────────────────────────────────────────────

function StrainDetail({ strain, thca, uploadCount, status, stability, onBack }) {
  const [cannabinoids, setCannabinoids] = useState(null)
  const [terpenes, setTerpenes]         = useState(null)
  const [batches, setBatches]           = useState(null)
  const [tab, setTab]                   = useState('profiles')

  useEffect(() => {
    setCannabinoids(null)
    setTerpenes(null)
    setBatches(null)
    setTab('profiles')
    fetchStrainCannabinoids(strain)
      .then(setCannabinoids)
      .catch(() => setCannabinoids([]))
    fetchStrainTerpenes(strain)
      .then(rows => setTerpenes(rows.filter(t => (t.value_pct ?? 0) > 0).slice(0, 10)))
      .catch(() => setTerpenes([]))
    fetchStrainBatches(strain)
      .then(setBatches)
      .catch(() => setBatches([]))
  }, [strain])

  const cannMax = cannabinoids && cannabinoids.length > 0
    ? Math.max(...cannabinoids.map(c => c.value_pct ?? 0))
    : 35
  const terpMax = terpenes && terpenes.length > 0
    ? Math.max(...terpenes.map(t => t.value_pct ?? 0))
    : 1

  const tabBtn = (key, label) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      style={{
        padding: '6px 14px', fontSize: 12, border: 'none', background: 'none', cursor: 'pointer',
        color: tab === key ? 'var(--text)' : 'var(--text-2)',
        borderBottom: tab === key ? '2px solid #4ade80' : '2px solid transparent',
        marginBottom: -1,
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none',
            color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', padding: '4px 0',
          }}
        >
          <ArrowLeft size={13} /> All strains
        </button>
        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>·</span>
        <span style={{ fontSize: 12, color: 'var(--text)' }}>{strain}</span>
        {status && <StatusBadgeWithTooltip status={status} />}
      </div>

      {/* Stat cards */}
      <Grid cols={4} gap={8}>
        <StatCard label="THCA"        value={thca != null ? `${thca.toFixed(2)}%` : '—'} sub="Latest batch" />
        <StatCard label="Total THC"   value={thca != null ? `${(thca * 0.877).toFixed(1)}%` : '—'} sub="Calculated" />
        <StatCard label="Batches"     value={uploadCount ?? '—'} sub="On file" />
        <StatCard label="Batch Stability" value={stability != null ? `${stability}/100` : '—'} sub={uploadCount > 1 ? `${uploadCount} batches` : 'Single batch'} />
      </Grid>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid var(--border)' }}>
        {tabBtn('profiles', 'Cannabinoid Profile')}
        {tabBtn('batches', 'Batches')}
      </div>

      {/* Cannabinoid Profile tab */}
      {tab === 'profiles' && (
        <Grid cols={2} gap={10}>
          <Panel title="Cannabinoid Profile">
            {cannabinoids === null ? (
              <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>Loading…</div>
            ) : cannabinoids.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>No cannabinoid data on file.</div>
            ) : cannabinoids.map(c => (
              <HBar key={c.compound} label={c.compound} value={c.value_pct ?? 0} max={cannMax} color={colorFor(c.compound)} showPct />
            ))}
          </Panel>

          <Panel title="Terpene Profile" titleRight={terpenes ? `top ${terpenes.length}` : ''}>
            {terpenes === null ? (
              <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>Loading…</div>
            ) : terpenes.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>No terpene data on file.</div>
            ) : terpenes.map(t => (
              <HBar key={t.compound} label={t.compound} value={t.value_pct ?? 0} max={terpMax} color={terpeneColor(t.compound)} showPct />
            ))}
          </Panel>
        </Grid>
      )}

      {/* Batches tab */}
      {tab === 'batches' && <BatchTable batches={batches} />}
    </div>
  )
}

// ── root ─────────────────────────────────────────────────────────────────────

export default function Strains({ refreshKey }) {
  const [strains, setStrains]   = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    setStrains(null)
    fetchStrains()
      .then(setStrains)
      .catch(() => setStrains([]))
  }, [refreshKey])

  if (selected) {
    return (
      <StrainDetail
        strain={selected.strain}
        thca={selected.thca}
        uploadCount={selected.upload_count}
        status={selected.status}
        stability={selected.stability}
        onBack={() => setSelected(null)}
      />
    )
  }

  return <StrainList strains={strains} onSelect={setSelected} />
}
