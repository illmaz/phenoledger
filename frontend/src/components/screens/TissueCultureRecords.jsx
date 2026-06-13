import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { Panel, Grid, StatCard, Badge } from '../ui'
import { fetchAllStrains, fetchTissueCultureRecords, createTissueCultureRecord, deleteTissueCultureRecord } from '../../api'

const CULTURE_TYPES   = ['meristem', 'shoot_tip', 'callus', 'protoplast', 'embryo', 'pollen']
const VIABILITY_OPTS  = ['viable', 'degraded', 'unknown', 'destroyed']

const CULTURE_LABEL   = {
  meristem: 'Meristem', shoot_tip: 'Shoot Tip', callus: 'Callus',
  protoplast: 'Protoplast', embryo: 'Embryo', pollen: 'Pollen',
}
const VIABILITY_VARIANT = { viable: 'ok', degraded: 'warn', unknown: 'gray', destroyed: 'danger' }
const VIABILITY_LABEL   = { viable: 'Viable', degraded: 'Degraded', unknown: 'Unknown', destroyed: 'Destroyed' }

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── TissueCultureForm ─────────────────────────────────────────────────────────

function TissueCultureForm({ strains, onSaved }) {
  const EMPTY = {
    strain_id: '', accession_number: '', banking_date: '', storage_facility: '',
    culture_type: '', viability_status: 'viable', last_viability_check: '', notes: '',
  }
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.strain_id)        { setError('Strain is required'); return }
    if (!form.accession_number) { setError('Accession number is required'); return }
    if (!form.banking_date)     { setError('Banking date is required'); return }
    if (!form.culture_type)     { setError('Culture type is required'); return }
    setSaving(true); setError('')
    try {
      await createTissueCultureRecord({
        strain_id:            form.strain_id,
        accession_number:     form.accession_number,
        banking_date:         form.banking_date,
        storage_facility:     form.storage_facility     || null,
        culture_type:         form.culture_type,
        viability_status:     form.viability_status,
        last_viability_check: form.last_viability_check || null,
        notes:                form.notes               || null,
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
    <Panel title="New Tissue Culture Record">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Row 1: Strain / Accession Number */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Strain *</label>
            <select style={inp} value={form.strain_id} onChange={e => set('strain_id', e.target.value)} required>
              <option value="">— Select strain —</option>
              {strains.map(s => <option key={s.strain_id} value={s.strain_id}>{s.strain}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Accession Number *</label>
            <input style={inp} value={form.accession_number} onChange={e => set('accession_number', e.target.value)} placeholder="e.g. TC-2024-001" required />
          </div>
        </div>

        {/* Row 2: Banking Date / Storage Facility */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Banking Date *</label>
            <input style={inp} type="date" value={form.banking_date} onChange={e => set('banking_date', e.target.value)} required />
          </div>
          <div>
            <label style={lbl}>Storage Facility</label>
            <input style={inp} value={form.storage_facility} onChange={e => set('storage_facility', e.target.value)} placeholder="Facility name or location" />
          </div>
        </div>

        {/* Row 3: Culture Type / Viability Status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Culture Type *</label>
            <select style={inp} value={form.culture_type} onChange={e => set('culture_type', e.target.value)} required>
              <option value="">— Select —</option>
              {CULTURE_TYPES.map(t => <option key={t} value={t}>{CULTURE_LABEL[t]}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Viability Status</label>
            <select style={inp} value={form.viability_status} onChange={e => set('viability_status', e.target.value)}>
              {VIABILITY_OPTS.map(v => <option key={v} value={v}>{VIABILITY_LABEL[v]}</option>)}
            </select>
          </div>
        </div>

        {/* Row 4: Last Viability Check */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Last Viability Check</label>
            <input style={inp} type="date" value={form.last_viability_check} onChange={e => set('last_viability_check', e.target.value)} />
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '7px 14px', fontSize: 12, fontWeight: 600, border: 'none',
              borderRadius: 6, background: saving ? '#2d6e4a' : '#4ade80',
              color: '#0a0a0a', cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save Record'}
          </button>
        </div>
      </form>
    </Panel>
  )
}

// ── CultureRow ────────────────────────────────────────────────────────────────

function CultureRow({ record, onDelete, last }) {
  const [hovered, setHovered] = useState(false)

  const strainName = record.strains?.name ?? '—'

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
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {strainName}
      </span>
      <span style={{ width: 120, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.accession_number ?? '—'}
      </span>
      <span style={{ width: 90, fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {fmtDate(record.banking_date)}
      </span>
      <span style={{ width: 80, fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {CULTURE_LABEL[record.culture_type] ?? record.culture_type ?? '—'}
      </span>
      <span style={{ width: 90, flexShrink: 0 }}>
        <Badge variant={VIABILITY_VARIANT[record.viability_status] ?? 'gray'}>
          {VIABILITY_LABEL[record.viability_status] ?? record.viability_status ?? '—'}
        </Badge>
      </span>
      <span style={{ width: 120, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.storage_facility ?? <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span style={{ width: 90, fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {fmtDate(record.last_viability_check)}
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

// ── TissueCultureRecords ──────────────────────────────────────────────────────

export default function TissueCultureRecords() {
  const [records, setRecords]         = useState(null)
  const [strains, setStrains]         = useState([])
  const [actionError, setActionError] = useState(null)

  async function loadRecords() {
    try {
      const data = await fetchTissueCultureRecords()
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
    if (!window.confirm('Delete this tissue culture record? This cannot be undone.')) return
    setActionError(null)
    try {
      await deleteTissueCultureRecord(id)
      setRecords(prev => prev ? prev.filter(r => r.id !== id) : prev)
    } catch (err) {
      setActionError(`Delete failed: ${err.message}`)
    }
  }

  const hdr = { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }

  const data      = records ?? []
  const viable    = data.filter(r => r.viability_status === 'viable').length
  const degraded  = data.filter(r => r.viability_status === 'degraded').length
  const destroyed = data.filter(r => r.viability_status === 'destroyed').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <TissueCultureForm strains={strains} onSaved={loadRecords} />

      {actionError && (
        <div style={{ fontSize: 12, color: '#f87171' }}>{actionError}</div>
      )}

      {records && records.length > 0 && (
        <Grid cols={4} gap={8}>
          <StatCard label="Total Records" value={records.length} />
          <StatCard label="Viable"        value={viable} subVariant={viable > 0 ? 'ok' : undefined} />
          <StatCard label="Degraded"      value={degraded} subVariant={degraded > 0 ? 'warn' : undefined} />
          <StatCard label="Destroyed"     value={destroyed} subVariant={destroyed > 0 ? 'warn' : undefined} />
        </Grid>
      )}

      {records === null ? (
        <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '32px', textAlign: 'center' }}>Loading…</div>
      ) : records.length === 0 ? (
        <Panel>
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            No tissue culture records yet. Use the form above to add one.
          </div>
        </Panel>
      ) : (
        <Panel fullWidth>
          <div style={{ display: 'flex', gap: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--border)', marginBottom: 2 }}>
            <span style={{ ...hdr, flex: 1 }}>Strain</span>
            <span style={{ ...hdr, width: 120 }}>Accession No.</span>
            <span style={{ ...hdr, width: 90 }}>Banking Date</span>
            <span style={{ ...hdr, width: 80 }}>Culture Type</span>
            <span style={{ ...hdr, width: 90 }}>Viability</span>
            <span style={{ ...hdr, width: 120 }}>Storage Facility</span>
            <span style={{ ...hdr, width: 90 }}>Last Check</span>
            <span style={{ ...hdr, width: 28 }} />
          </div>
          {records.map((r, i) => (
            <CultureRow
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
