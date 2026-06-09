import { useState, useEffect } from 'react'
import { ArrowLeft, Search, LayoutGrid, List } from 'lucide-react'
import { StatCard, Panel, Badge, HBar, Grid } from '../ui'
import { fetchStrains, fetchStrainCannabinoids } from '../../api'

// ── constants ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { key: 'all',    label: 'All'    },
  { key: 'stable', label: 'Stable' },
  { key: 'watch',  label: 'Watch'  },
  { key: 'drift',  label: 'Drift'  },
]

const STATUS_BADGE  = { stable: 'ok', watch: 'warn', drift: 'danger' }
const STATUS_LABEL  = { stable: 'Stable', watch: 'Watch', drift: 'Drift' }
const STATUS_DOT    = { stable: '#4ade80', watch: '#fbbf24', drift: '#f87171' }

const COMPOUND_COLOR = {
  THCA: '#4ade80', THC: '#4ade80', 'D9-THC': '#4ade80',
  CBD: '#60a5fa', CBDA: '#60a5fa',
  CBG: '#fbbf24', CBGA: '#fbbf24',
  CBN: '#a78bfa', CBC: '#f87171',
}

function colorFor(compound) {
  return COMPOUND_COLOR[compound] ?? '#888888'
}

// ── StrainCard (grid view) ───────────────────────────────────────────────────

function StrainCard({ strain, thca, status, onClick }) {
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
    </div>
  )
}

// ── StrainRow (list view) ────────────────────────────────────────────────────

function StrainRow({ strain, thca, upload_count, status, last, onClick }) {
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
      <div style={{ width: 52, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
        <Badge variant={STATUS_BADGE[status] ?? 'gray'}>
          {STATUS_LABEL[status] ?? status ?? '—'}
        </Badge>
      </div>
    </div>
  )
}

// ── StrainList ───────────────────────────────────────────────────────────────

function StrainList({ strains, onSelect }) {
  const [query, setQuery]   = useState('')
  const [view, setView]     = useState('grid')
  const [filter, setFilter] = useState('all')

  if (strains === null) {
    return (
      <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '24px 0', textAlign: 'center' }}>
        Loading…
      </div>
    )
  }

  const filtered = strains
    .filter(s => !query || s.strain.toLowerCase().includes(query.toLowerCase()))
    .filter(s => filter === 'all' || s.status === filter)

  const isFiltering = filter !== 'all' || Boolean(query)
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

      {/* Controls bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1 }}>
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

        {/* Status filter pills */}
        <div style={{ display: 'flex', border: '0.5px solid var(--border)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
          {STATUS_FILTERS.map((f, i) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                ...btnBase,
                borderLeft: i > 0 ? '0.5px solid var(--border)' : 'none',
                background: filter === f.key ? 'rgba(255,255,255,0.07)' : 'transparent',
                color: filter === f.key ? 'var(--text)' : 'var(--text-2)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

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
          {query ? `No strains match "${query}"` : `No ${filter} strains.`}
        </div>
      ) : view === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {filtered.map(s => (
            <StrainCard
              key={s.strain}
              strain={s.strain}
              thca={s.thca}
              status={s.status}
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
              last={i === filtered.length - 1}
              onClick={() => onSelect(s)}
            />
          ))}
        </Panel>
      )}

    </div>
  )
}

// ── StrainDetail ─────────────────────────────────────────────────────────────

function StrainDetail({ strain, thca, uploadCount, status, onBack }) {
  const [cannabinoids, setCannabinoids] = useState(null)

  useEffect(() => {
    setCannabinoids(null)
    fetchStrainCannabinoids(strain)
      .then(setCannabinoids)
      .catch(() => setCannabinoids([]))
  }, [strain])

  const maxVal = cannabinoids && cannabinoids.length > 0
    ? Math.max(...cannabinoids.map(c => c.value_pct ?? 0))
    : 35

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
        {status && (
          <Badge variant={STATUS_BADGE[status] ?? 'gray'}>{STATUS_LABEL[status] ?? status}</Badge>
        )}
      </div>

      <Grid cols={4} gap={8}>
        <StatCard label="THCA"        value={thca != null ? `${thca.toFixed(2)}%` : '—'} sub="Latest batch" />
        <StatCard label="Total THC"   value={thca != null ? `${(thca * 0.877).toFixed(1)}%` : '—'} sub="Calculated" />
        <StatCard label="Batches"     value={uploadCount ?? '—'} sub="On file" />
        <StatCard label="GACP Status" value="—" sub="Coming in Phase 4" />
      </Grid>

      <Grid cols={2} gap={10}>
        <Panel title={`THC Trend – ${strain}`}>
          <div style={{
            height: 150, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', color: 'var(--text-3)', fontSize: 12, gap: 6,
          }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)' }}>Insufficient data</div>
            <div>Upload more COAs for this strain to see a trend.</div>
          </div>
        </Panel>

        <Panel title="Cannabinoid Profile">
          {cannabinoids === null ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>Loading…</div>
          ) : cannabinoids.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>
              No cannabinoid data on file.
            </div>
          ) : (
            cannabinoids.map(c => (
              <HBar
                key={c.compound}
                label={c.compound}
                value={c.value_pct ?? 0}
                max={maxVal}
                color={colorFor(c.compound)}
                showPct
              />
            ))
          )}
        </Panel>
      </Grid>
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
        onBack={() => setSelected(null)}
      />
    )
  }

  return <StrainList strains={strains} onSelect={setSelected} />
}
