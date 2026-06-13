import { useState, useEffect } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { Panel, Grid, StatCard, Badge } from '../ui'
import { fetchAllStrains, fetchExportRecords, createExportRecord, deleteExportRecord } from '../../api'

const STATUSES = ['pending', 'approved', 'shipped', 'completed', 'cancelled']

const STATUS_VARIANT = {
  pending:   'gray',
  approved:  'info',
  shipped:   'warn',
  completed: 'ok',
  cancelled: 'danger',
}
const STATUS_LABEL = {
  pending:   'Pending',
  approved:  'Approved',
  shipped:   'Shipped',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── ExportForm ────────────────────────────────────────────────────────────────

function ExportForm({ strains, onSaved, onCancel }) {
  const EMPTY = {
    batch_code: '', strain_id: '', destination_country: '', exporter_name: '',
    export_date: '', certificate_number: '', status: 'pending', notes: '',
  }
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.batch_code.trim())         { setError('Batch code is required'); return }
    if (!form.destination_country.trim()) { setError('Destination country is required'); return }
    setSaving(true); setError('')
    try {
      await createExportRecord({
        batch_code:          form.batch_code.trim(),
        strain_id:           form.strain_id           || null,
        destination_country: form.destination_country.trim(),
        exporter_name:       form.exporter_name       || null,
        export_date:         form.export_date         || null,
        certificate_number:  form.certificate_number  || null,
        status:              form.status,
        notes:               form.notes               || null,
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
    <Panel title="New Export Record">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Row 1: Batch Code / Strain */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Batch Code *</label>
            <input style={inp} value={form.batch_code} onChange={e => set('batch_code', e.target.value)} placeholder="e.g. BATCH-2024-001" required />
          </div>
          <div>
            <label style={lbl}>Strain</label>
            <select style={inp} value={form.strain_id} onChange={e => set('strain_id', e.target.value)}>
              <option value="">— Select strain —</option>
              {strains.map(s => <option key={s.strain_id} value={s.strain_id}>{s.strain}</option>)}
            </select>
          </div>
        </div>

        {/* Row 2: Destination Country / Exporter Name */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Destination Country *</label>
            <input style={inp} value={form.destination_country} onChange={e => set('destination_country', e.target.value)} placeholder="e.g. Germany" required />
          </div>
          <div>
            <label style={lbl}>Exporter Name</label>
            <input style={inp} value={form.exporter_name} onChange={e => set('exporter_name', e.target.value)} placeholder="Company or individual name" />
          </div>
        </div>

        {/* Row 3: Export Date / Certificate Number / Status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Export Date</label>
            <input style={inp} type="date" value={form.export_date} onChange={e => set('export_date', e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Certificate Number</label>
            <input style={inp} value={form.certificate_number} onChange={e => set('certificate_number', e.target.value)} placeholder="e.g. COO-2024-001" />
          </div>
          <div>
            <label style={lbl}>Status</label>
            <select style={inp} value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
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
            {saving ? 'Saving…' : 'Save Export Record'}
          </button>
        </div>
      </form>
    </Panel>
  )
}

// ── ExportRow ─────────────────────────────────────────────────────────────────

function ExportRow({ record, onDelete, last }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', gap: 12, alignItems: 'center',
        padding: '8px 0',
        borderBottom: last ? 'none' : '0.5px solid var(--border)',
      }}
    >
      <span style={{ width: 120, fontSize: 12, color: 'var(--text)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
        {record.batch_code ?? '—'}
      </span>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {record.strains?.name ?? <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span style={{ width: 110, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.destination_country ?? <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span style={{ width: 120, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.exporter_name ?? <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span style={{ width: 90, flexShrink: 0 }}>
        <Badge variant={STATUS_VARIANT[record.status] ?? 'gray'}>
          {STATUS_LABEL[record.status] ?? record.status ?? '—'}
        </Badge>
      </span>
      <span style={{ width: 90, fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {fmtDate(record.export_date)}
      </span>
      <span style={{ width: 120, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
        {record.certificate_number ?? <span style={{ color: 'var(--text-3)', fontFamily: 'inherit' }}>—</span>}
      </span>
      <div style={{ width: 28, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
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
  )
}

// ── ExportRecords ─────────────────────────────────────────────────────────────

export default function ExportRecords() {
  const [records,     setRecords]     = useState(null)
  const [strains,     setStrains]     = useState([])
  const [showForm,    setShowForm]    = useState(false)
  const [actionError, setActionError] = useState(null)

  async function loadRecords() {
    try {
      const data = await fetchExportRecords()
      setRecords(data)
    } catch {
      setRecords([])
    }
  }

  useEffect(() => {
    loadRecords()
    fetchAllStrains().then(setStrains).catch(() => {})
  }, [])

  async function handleDelete(id) {
    if (!window.confirm('Delete this export record? This cannot be undone.')) return
    setActionError(null)
    try {
      await deleteExportRecord(id)
      setRecords(prev => prev ? prev.filter(r => r.id !== id) : prev)
    } catch (err) {
      setActionError(`Delete failed: ${err.message}`)
    }
  }

  const hdr = { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }

  const data       = records ?? []
  const pending    = data.filter(r => r.status === 'pending').length
  const completed  = data.filter(r => r.status === 'completed').length
  const countries  = new Set(data.map(r => r.destination_country).filter(Boolean)).size

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {showForm ? (
        <ExportForm
          strains={strains}
          onSaved={async () => { await loadRecords(); setShowForm(false) }}
          onCancel={() => { setShowForm(false); setActionError(null) }}
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
            <Plus size={13} /> New Export Record
          </button>
        </div>
      )}

      {actionError && (
        <div style={{ fontSize: 12, color: '#f87171' }}>{actionError}</div>
      )}

      {records !== null && data.length > 0 && (
        <Grid cols={4} gap={8}>
          <StatCard label="Total Records"          value={data.length} />
          <StatCard label="Pending"                value={pending} />
          <StatCard label="Completed"              value={completed} subVariant={completed > 0 ? 'ok' : undefined} />
          <StatCard label="Destination Countries"  value={countries} />
        </Grid>
      )}

      {records === null ? (
        <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '32px', textAlign: 'center' }}>Loading…</div>
      ) : data.length === 0 ? (
        <Panel>
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            No export records yet. Use the button above to add one.
          </div>
        </Panel>
      ) : (
        <Panel fullWidth>
          <div style={{ display: 'flex', gap: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--border)', marginBottom: 2 }}>
            <span style={{ ...hdr, width: 120 }}>Batch Code</span>
            <span style={{ ...hdr, flex: 1 }}>Strain</span>
            <span style={{ ...hdr, width: 110 }}>Country</span>
            <span style={{ ...hdr, width: 120 }}>Exporter</span>
            <span style={{ ...hdr, width: 90 }}>Status</span>
            <span style={{ ...hdr, width: 90 }}>Export Date</span>
            <span style={{ ...hdr, width: 120 }}>Certificate No.</span>
            <span style={{ ...hdr, width: 28 }} />
          </div>
          {data.map((r, i) => (
            <ExportRow
              key={r.id}
              record={r}
              onDelete={handleDelete}
              last={i === data.length - 1}
            />
          ))}
        </Panel>
      )}
    </div>
  )
}
