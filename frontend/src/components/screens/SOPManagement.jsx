import { useState, useEffect } from 'react'
import { Trash2, Plus, CheckSquare } from 'lucide-react'
import { Panel, Grid, StatCard, Badge } from '../ui'
import { fetchSOPs, createSOP, deleteSOP, acknowledgeSOP } from '../../api'

const CATEGORIES = ['cultivation', 'harvesting', 'processing', 'quality_control', 'health_safety', 'environmental', 'other']
const STATUSES   = ['draft', 'active', 'under_review', 'retired']

const STATUS_VARIANT = {
  draft:        'gray',
  active:       'ok',
  under_review: 'warn',
  retired:      'gray',
}
const STATUS_LABEL = {
  draft:        'Draft',
  active:       'Active',
  under_review: 'Under Review',
  retired:      'Retired',
}
const CATEGORY_LABEL = {
  cultivation:     'Cultivation',
  harvesting:      'Harvesting',
  processing:      'Processing',
  quality_control: 'Quality Control',
  health_safety:   'Health & Safety',
  environmental:   'Environmental',
  other:           'Other',
}

const TODAY = new Date().toISOString().split('T')[0]

function isOverdue(reviewDate) {
  return !!reviewDate && reviewDate < TODAY
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── SOPForm ───────────────────────────────────────────────────────────────────

function SOPForm({ onSaved, onCancel }) {
  const EMPTY = {
    title: '', sop_code: '', version: '1.0', category: 'cultivation',
    status: 'draft', effective_date: '', review_date: '',
    approved_by: '', document_url: '', notes: '',
  }
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim())    { setError('Title is required'); return }
    if (!form.sop_code.trim()) { setError('SOP Code is required'); return }
    setSaving(true); setError('')
    try {
      await createSOP({
        title:          form.title.trim(),
        sop_code:       form.sop_code.trim(),
        version:        form.version     || null,
        category:       form.category,
        status:         form.status,
        effective_date: form.effective_date || null,
        review_date:    form.review_date    || null,
        approved_by:    form.approved_by    || null,
        document_url:   form.document_url   || null,
        notes:          form.notes          || null,
      })
      setForm(EMPTY)
      await onSaved()
    } catch (err) {
      setError(err?.message || err?.detail || JSON.stringify(err) || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const inp = {
    width: '100%', padding: '6px 9px', fontSize: 12, boxSizing: 'border-box',
    border: '0.5px solid var(--border)', borderRadius: 6,
    background: 'var(--bg)', color: 'var(--text)', outline: 'none',
  }
  const lbl = { fontSize: 11, color: 'var(--text-2)', display: 'block', marginBottom: 4 }

  return (
    <Panel title="New SOP">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Row 1: Title / SOP Code */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Title *</label>
            <input style={inp} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Mother Plant Propagation Protocol" required />
          </div>
          <div>
            <label style={lbl}>SOP Code *</label>
            <input style={inp} value={form.sop_code} onChange={e => set('sop_code', e.target.value)} placeholder="e.g. SOP-CULT-001" required />
          </div>
        </div>

        {/* Row 2: Version / Category / Status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Version</label>
            <input style={inp} value={form.version} onChange={e => set('version', e.target.value)} placeholder="1.0" />
          </div>
          <div>
            <label style={lbl}>Category</label>
            <select style={inp} value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Status</label>
            <select style={inp} value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        </div>

        {/* Row 3: Effective Date / Review Date / Approved By */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Effective Date</label>
            <input style={inp} type="date" value={form.effective_date} onChange={e => set('effective_date', e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Review Date</label>
            <input style={inp} type="date" value={form.review_date} onChange={e => set('review_date', e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Approved By</label>
            <input style={inp} value={form.approved_by} onChange={e => set('approved_by', e.target.value)} placeholder="Name or ID" />
          </div>
        </div>

        {/* Document URL */}
        <div>
          <label style={lbl}>Document URL</label>
          <input style={inp} type="url" value={form.document_url} onChange={e => set('document_url', e.target.value)} placeholder="https://…" />
        </div>

        {/* Notes */}
        <div>
          <label style={lbl}>Notes</label>
          <textarea
            style={{ ...inp, resize: 'vertical', minHeight: 64, fontFamily: 'inherit' }}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            maxLength={500}
            placeholder="Optional notes…"
          />
          {form.notes.length > 400 && (
            <div style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'right', marginTop: 2 }}>
              {form.notes.length}/500
            </div>
          )}
        </div>

        {error && <div style={{ fontSize: 12, color: '#f87171' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 2 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '7px 14px', fontSize: 12, border: '0.5px solid var(--border)',
              borderRadius: 6, background: 'transparent', color: 'var(--text-2)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '7px 14px', fontSize: 12, fontWeight: 600, border: 'none',
              borderRadius: 6, background: saving ? '#2d6e4a' : '#4ade80',
              color: '#0a0a0a', cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save SOP'}
          </button>
        </div>
      </form>
    </Panel>
  )
}

// ── AcknowledgeForm ───────────────────────────────────────────────────────────

function AcknowledgeForm({ sopId, onDone }) {
  const [staffName, setStaffName] = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!staffName.trim()) { setError('Staff name is required'); return }
    setSaving(true); setError('')
    try {
      await acknowledgeSOP(sopId, { staff_name: staffName.trim() })
      onDone()
    } catch (err) {
      setError(err?.message || 'Failed to acknowledge')
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onClick={e => e.stopPropagation()}
      style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}
    >
      <input
        autoFocus
        value={staffName}
        onChange={e => setStaffName(e.target.value)}
        placeholder="Staff name"
        style={{
          padding: '4px 8px', fontSize: 11, borderRadius: 5,
          border: '0.5px solid var(--border)', background: 'var(--bg)',
          color: 'var(--text)', outline: 'none', width: 140,
        }}
      />
      <button
        type="submit"
        disabled={saving}
        style={{
          padding: '4px 10px', fontSize: 11, fontWeight: 600, border: 'none',
          borderRadius: 5, background: saving ? '#2d6e4a' : '#4ade80',
          color: '#0a0a0a', cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? '…' : 'Submit'}
      </button>
      <button
        type="button"
        onClick={onDone}
        style={{
          padding: '4px 8px', fontSize: 11, border: '0.5px solid var(--border)',
          borderRadius: 5, background: 'transparent', color: 'var(--text-3)', cursor: 'pointer',
        }}
      >
        ✕
      </button>
      {error && <span style={{ fontSize: 11, color: '#f87171' }}>{error}</span>}
    </form>
  )
}

// ── SOPRow ────────────────────────────────────────────────────────────────────

function SOPRow({ record, onDelete, onAcknowledged, last }) {
  const [hovered, setHovered]       = useState(false)
  const [showAck, setShowAck]       = useState(false)
  const [ackCount, setAckCount]     = useState(record.acknowledgment_count ?? record.sop_acknowledgments?.length ?? 0)

  const overdue = isOverdue(record.review_date)
  const ackDone = () => { setAckCount(c => c + 1); setShowAck(false); onAcknowledged?.() }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 0',
        borderBottom: last ? 'none' : '0.5px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ width: 110, fontSize: 11, fontFamily: 'monospace', color: 'var(--text)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {record.sop_code ?? '—'}
        </span>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {record.title ?? '—'}
        </span>
        <span style={{ width: 44, fontSize: 11, color: 'var(--text-3)', flexShrink: 0, textAlign: 'center' }}>
          {record.version ?? '—'}
        </span>
        <span style={{ width: 110, flexShrink: 0 }}>
          <Badge variant="info">{CATEGORY_LABEL[record.category] ?? record.category ?? '—'}</Badge>
        </span>
        <span style={{ width: 90, flexShrink: 0 }}>
          <Badge variant={STATUS_VARIANT[record.status] ?? 'gray'}>
            {STATUS_LABEL[record.status] ?? record.status ?? '—'}
          </Badge>
        </span>
        <span style={{ width: 90, fontSize: 11, color: 'var(--text-2)', flexShrink: 0 }}>
          {fmtDate(record.effective_date)}
        </span>
        <span style={{ width: 90, fontSize: 11, flexShrink: 0, color: overdue ? '#f87171' : 'var(--text-2)', fontWeight: overdue ? 600 : 400 }}>
          {fmtDate(record.review_date)}
        </span>
        <span style={{ width: 90, fontSize: 11, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {record.approved_by ?? <span style={{ color: 'var(--text-3)' }}>—</span>}
        </span>
        <span style={{ width: 32, fontSize: 11, color: 'var(--text-3)', flexShrink: 0, textAlign: 'center' }}>
          {ackCount}
        </span>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
          {(hovered || showAck) && !showAck && (
            <button
              onClick={() => setShowAck(true)}
              title="Acknowledge SOP"
              style={{
                padding: '2px 6px', border: 'none', background: 'transparent',
                cursor: 'pointer', color: '#60a5fa', display: 'flex', alignItems: 'center',
              }}
            >
              <CheckSquare size={11} />
            </button>
          )}
          <div style={{ width: 24, display: 'flex', justifyContent: 'center' }}>
            {hovered && (
              <button
                onClick={() => onDelete(record.id)}
                title="Delete"
                style={{
                  padding: '2px 4px', border: 'none', background: 'transparent',
                  cursor: 'pointer', color: '#f87171', display: 'flex', alignItems: 'center',
                }}
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </div>
      </div>

      {showAck && (
        <AcknowledgeForm sopId={record.id} onDone={ackDone} />
      )}
    </div>
  )
}

// ── SOPManagement ─────────────────────────────────────────────────────────────

export default function SOPManagement() {
  const [sops, setSops]               = useState(null)
  const [showForm, setShowForm]       = useState(false)
  const [actionError, setActionError] = useState(null)

  async function loadSOPs() {
    try {
      const data = await fetchSOPs()
      setSops(data)
    } catch {
      setSops([])
    }
  }

  useEffect(() => { loadSOPs() }, [])

  async function handleDelete(id) {
    if (!window.confirm('Delete this SOP? This cannot be undone.')) return
    setActionError(null)
    try {
      await deleteSOP(id)
      setSops(prev => prev ? prev.filter(s => s.id !== id) : prev)
    } catch (err) {
      setActionError(`Delete failed: ${err.message}`)
    }
  }

  const hdr = { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }

  const data        = sops ?? []
  const active      = data.filter(s => s.status === 'active').length
  const underReview = data.filter(s => s.status === 'under_review').length
  const overdue     = data.filter(s => isOverdue(s.review_date)).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {showForm ? (
        <SOPForm
          onSaved={async () => { await loadSOPs(); setShowForm(false) }}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', fontSize: 12, fontWeight: 600,
              border: 'none', borderRadius: 6,
              background: '#4ade80', color: '#0a0a0a', cursor: 'pointer',
            }}
          >
            <Plus size={13} /> New SOP
          </button>
        </div>
      )}

      {actionError && (
        <div style={{ fontSize: 12, color: '#f87171' }}>{actionError}</div>
      )}

      {sops && sops.length > 0 && (
        <Grid cols={4} gap={8}>
          <StatCard label="Total SOPs"    value={sops.length} />
          <StatCard label="Active"        value={active} subVariant={active > 0 ? 'ok' : undefined} />
          <StatCard label="Under Review"  value={underReview} subVariant={underReview > 0 ? 'warn' : undefined} />
          <StatCard label="Overdue"       value={overdue} subVariant={overdue > 0 ? 'warn' : undefined} />
        </Grid>
      )}

      {sops === null ? (
        <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '32px', textAlign: 'center' }}>Loading…</div>
      ) : sops.length === 0 ? (
        <Panel>
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            No SOPs yet. Use the button above to add one.
          </div>
        </Panel>
      ) : (
        <Panel fullWidth>
          <div style={{ display: 'flex', gap: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--border)', marginBottom: 2 }}>
            <span style={{ ...hdr, width: 110 }}>SOP Code</span>
            <span style={{ ...hdr, flex: 1 }}>Title</span>
            <span style={{ ...hdr, width: 44, textAlign: 'center' }}>Ver.</span>
            <span style={{ ...hdr, width: 110 }}>Category</span>
            <span style={{ ...hdr, width: 90 }}>Status</span>
            <span style={{ ...hdr, width: 90 }}>Effective</span>
            <span style={{ ...hdr, width: 90 }}>Review</span>
            <span style={{ ...hdr, width: 90 }}>Approved By</span>
            <span style={{ ...hdr, width: 32, textAlign: 'center' }}>Acks</span>
            <span style={{ ...hdr, width: 52 }} />
          </div>
          {sops.map((s, i) => (
            <SOPRow
              key={s.id}
              record={s}
              onDelete={handleDelete}
              onAcknowledged={loadSOPs}
              last={i === sops.length - 1}
            />
          ))}
        </Panel>
      )}
    </div>
  )
}
