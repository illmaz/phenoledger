import { useState, useEffect } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { Panel, Grid, StatCard, Badge } from '../ui'
import { fetchInputRecords, createInputRecord, deleteInputRecord } from '../../api'

const INPUT_TYPES = ['fertilizer', 'pesticide', 'pH_adjuster', 'irrigation', 'other']

const TYPE_VARIANT = {
  fertilizer:  'ok',
  pesticide:   'danger',
  pH_adjuster: 'info',
  irrigation:  'info',
  other:       'gray',
}
const TYPE_LABEL = {
  fertilizer:  'Fertilizer',
  pesticide:   'Pesticide',
  pH_adjuster: 'pH Adjuster',
  irrigation:  'Irrigation',
  other:       'Other',
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── InputForm ─────────────────────────────────────────────────────────────────

function InputForm({ onSaved, onCancel }) {
  const EMPTY = {
    input_date: '', input_type: 'fertilizer', product_name: '',
    rate: '', unit: '', grow_room: '', operator: '', notes: '',
  }
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.input_date)         { setError('Input date is required'); return }
    if (!form.product_name.trim()) { setError('Product name is required'); return }
    setSaving(true); setError('')
    try {
      await createInputRecord({
        input_date:   form.input_date,
        input_type:   form.input_type,
        product_name: form.product_name.trim(),
        rate:         form.rate      || null,
        unit:         form.unit      || null,
        grow_room:    form.grow_room || null,
        operator:     form.operator  || null,
        notes:        form.notes     || null,
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
    <Panel title="Log Input">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Row 1: Date / Type */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Input Date *</label>
            <input style={inp} type="date" value={form.input_date} onChange={e => set('input_date', e.target.value)} required />
          </div>
          <div>
            <label style={lbl}>Input Type *</label>
            <select style={inp} value={form.input_type} onChange={e => set('input_type', e.target.value)}>
              {INPUT_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </div>
        </div>

        {/* Row 2: Product / Rate */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Product Name *</label>
            <input style={inp} value={form.product_name} onChange={e => set('product_name', e.target.value)} placeholder="e.g. CalMag Pro" required />
          </div>
          <div>
            <label style={lbl}>Rate</label>
            <input style={inp} value={form.rate} onChange={e => set('rate', e.target.value)} placeholder="e.g. 5 ml/L" />
          </div>
          <div>
            <label style={lbl}>Unit</label>
            <input style={inp} value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="e.g. ml/L" />
          </div>
        </div>

        {/* Row 3: Grow Room / Operator */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Grow Room</label>
            <input style={inp} value={form.grow_room} onChange={e => set('grow_room', e.target.value)} placeholder="e.g. Room A" />
          </div>
          <div>
            <label style={lbl}>Operator</label>
            <input style={inp} value={form.operator} onChange={e => set('operator', e.target.value)} placeholder="Name or ID" />
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
            {saving ? 'Saving…' : 'Log Input'}
          </button>
        </div>
      </form>
    </Panel>
  )
}

// ── InputRow ──────────────────────────────────────────────────────────────────

function InputRow({ record, onDelete, last }) {
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
      <span style={{ width: 90, fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {fmtDate(record.input_date)}
      </span>
      <span style={{ width: 90, flexShrink: 0 }}>
        <Badge variant={TYPE_VARIANT[record.input_type] ?? 'gray'}>
          {TYPE_LABEL[record.input_type] ?? record.input_type ?? '—'}
        </Badge>
      </span>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {record.product_name ?? '—'}
      </span>
      <span style={{ width: 100, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {[record.rate, record.unit].filter(Boolean).join(' ') || <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span style={{ width: 90, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.grow_room ?? <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span style={{ width: 90, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.operator ?? <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span title={record.notes ?? undefined} style={{ width: 120, fontSize: 11, color: 'var(--text-3)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.notes ?? '—'}
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

// ── InputRecords ──────────────────────────────────────────────────────────────

export default function InputRecords() {
  const [records, setRecords]         = useState(null)
  const [showForm, setShowForm]       = useState(false)
  const [actionError, setActionError] = useState(null)

  async function loadRecords() {
    try {
      const data = await fetchInputRecords()
      setRecords(data)
    } catch {
      setRecords([])
    }
  }

  useEffect(() => { loadRecords() }, [])

  async function handleDelete(id) {
    if (!window.confirm('Delete this input record? This cannot be undone.')) return
    setActionError(null)
    try {
      await deleteInputRecord(id)
      setRecords(prev => prev ? prev.filter(r => r.id !== id) : prev)
    } catch (err) {
      setActionError(`Delete failed: ${err.message}`)
    }
  }

  const hdr = { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }

  const data        = records ?? []
  const fertilizers = data.filter(r => r.input_type === 'fertilizer').length
  const pesticides  = data.filter(r => r.input_type === 'pesticide').length
  const other       = data.filter(r => !['fertilizer', 'pesticide'].includes(r.input_type)).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {showForm ? (
        <InputForm
          onSaved={async () => { await loadRecords(); setShowForm(false) }}
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
            <Plus size={13} /> Log Input
          </button>
        </div>
      )}

      {actionError && (
        <div style={{ fontSize: 12, color: '#f87171' }}>{actionError}</div>
      )}

      {records && records.length > 0 && (
        <Grid cols={4} gap={8}>
          <StatCard label="Total Inputs"  value={records.length} />
          <StatCard label="Fertilizers"   value={fertilizers} />
          <StatCard label="Pesticides"    value={pesticides} subVariant={pesticides > 0 ? 'warn' : undefined} />
          <StatCard label="Other"         value={other} />
        </Grid>
      )}

      {records === null ? (
        <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '32px', textAlign: 'center' }}>Loading…</div>
      ) : records.length === 0 ? (
        <Panel>
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            No input records yet. Use the button above to log one.
          </div>
        </Panel>
      ) : (
        <Panel fullWidth>
          <div style={{ display: 'flex', gap: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--border)', marginBottom: 2 }}>
            <span style={{ ...hdr, width: 90 }}>Date</span>
            <span style={{ ...hdr, width: 90 }}>Type</span>
            <span style={{ ...hdr, flex: 1 }}>Product</span>
            <span style={{ ...hdr, width: 100 }}>Rate / Unit</span>
            <span style={{ ...hdr, width: 90 }}>Grow Room</span>
            <span style={{ ...hdr, width: 90 }}>Operator</span>
            <span style={{ ...hdr, width: 120 }}>Notes</span>
            <span style={{ ...hdr, width: 28 }} />
          </div>
          {records.map((r, i) => (
            <InputRow
              key={r.id}
              record={r}
              onDelete={handleDelete}
              last={i === records.length - 1}
            />
          ))}
        </Panel>
      )}
    </div>
  )
}
