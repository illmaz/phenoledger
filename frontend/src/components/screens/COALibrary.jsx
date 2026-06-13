import { useState, useEffect } from 'react'
import { Search, FileText, Loader } from 'lucide-react'
import { StatCard, Panel, Badge, Row, Grid } from '../ui'
import { fetchUploads, fetchUploadPdf, fetchUploadsCount } from '../../api'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function shortId(uuid) {
  return uuid?.slice(0, 8).toUpperCase() ?? '—'
}

function thcaColor(v) {
  return v >= 1 ? '#4ade80' : '#fbbf24'
}

function statusVariant(s) {
  if (s === 'confirmed') return 'ok'
  if (s === 'failed') return 'warn'
  return 'gray'
}

function statusLabel(s) {
  if (s === 'confirmed') return 'Processed'
  if (s === 'failed') return 'Failed'
  if (s === 'needs_review') return 'Review'
  return s ?? 'Pending'
}

export default function COALibrary({ refreshKey }) {
  const [uploads, setUploads] = useState(null)
  const [totalCount, setTotalCount] = useState(null)
  const [query, setQuery] = useState('')
  const [loadingPdf, setLoadingPdf] = useState({})
  const [pdfError, setPdfError] = useState({})

  async function openPdf(id) {
    setLoadingPdf(p => ({ ...p, [id]: true }))
    setPdfError(p => ({ ...p, [id]: false }))
    try {
      const url = await fetchUploadPdf(id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setPdfError(p => ({ ...p, [id]: true }))
    } finally {
      setLoadingPdf(p => ({ ...p, [id]: false }))
    }
  }

  useEffect(() => {
    setUploads(null)
    fetchUploads()
      .then(setUploads)
      .catch(() => setUploads([]))
    fetchUploadsCount()
      .then(setTotalCount)
      .catch(() => {})
  }, [refreshKey])

  const data = uploads ?? []

  const filtered = query
    ? data.filter(u =>
        [u.name, u.lab, u.filename].filter(Boolean).some(f =>
          f.toLowerCase().includes(query.toLowerCase())
        )
      )
    : data

  const labCount    = new Set(data.map(u => u.lab).filter(Boolean)).size
  const strainCount = new Set(data.map(u => u.name).filter(Boolean)).size
  const thisMonth = data.filter(u => {
    if (!u.created_at) return false
    const d = new Date(u.created_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search COAs by strain, batch ID, or lab…"
          style={{
            width: '100%', padding: '8px 12px 8px 30px', fontSize: 13,
            border: '0.5px solid var(--border)', borderRadius: 8,
            background: 'var(--card)', color: 'var(--text)', outline: 'none',
          }}
        />
      </div>

      <Grid cols={4} gap={8}>
        <StatCard label="Total COAs"  value={totalCount === null ? '—' : totalCount} />
        <StatCard label="Labs"        value={uploads === null ? '—' : labCount} />
        <StatCard label="Strains"     value={uploads === null ? '—' : strainCount} />
        <StatCard label="This Month"  value={uploads === null ? '—' : thisMonth} />
      </Grid>

      <Panel title="All COA Records" fullWidth>
        {uploads === null ? (
          <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '12px 0' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '12px 0' }}>
            {query ? 'No records match your search.' : 'No uploads yet.'}
          </div>
        ) : (
          filtered.map((u, i) => (
            <Row key={u.id} last={i === filtered.length - 1}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-3)', width: 80, flexShrink: 0 }}>
                {shortId(u.id)}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.name}
              </span>
              <Badge variant={u.lab ? 'gray' : 'gray'}>{u.lab ?? 'Unknown lab'}</Badge>
              <span style={{ width: 56, textAlign: 'right', fontSize: 12, flexShrink: 0, color: u.thca != null ? thcaColor(u.thca) : 'var(--text-3)' }}>
                {u.thca != null ? `${u.thca}%` : '—'}
              </span>
              <Badge variant={statusVariant(u.status)}>{statusLabel(u.status)}</Badge>
              <span style={{ color: 'var(--text-2)', fontSize: 11, width: 90, textAlign: 'right', flexShrink: 0 }}>
                {fmtDate(u.created_at)}
              </span>
              <button
                onClick={() => openPdf(u.id)}
                disabled={loadingPdf[u.id]}
                title={pdfError[u.id] ? 'Failed to load PDF — try again' : undefined}
                style={{
                  background: 'none', border: 'none', fontSize: 11, flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 3, cursor: loadingPdf[u.id] ? 'default' : 'pointer',
                  color: pdfError[u.id] ? '#f87171' : '#60a5fa',
                  opacity: loadingPdf[u.id] ? 0.6 : 1,
                }}
              >
                {loadingPdf[u.id]
                  ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Loading</>
                  : pdfError[u.id]
                    ? <><FileText size={12} /> Retry</>
                    : <><FileText size={12} /> View</>
                }
              </button>
            </Row>
          ))
        )}
      </Panel>
    </div>
  )
}
