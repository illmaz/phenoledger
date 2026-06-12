import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { Panel, Grid, StatCard, Badge } from '../ui'
import { fetchStrains, fetchBreedingRecords, createBreedingRecord, deleteBreedingRecord } from '../../api'

const GENERATIONS = ['F1', 'F2', 'F3', 'F4', 'BX1', 'BX2', 'BX3', 'S1', 'IBL', 'Other']

const GEN_VARIANT = {
  F1: 'ok', F2: 'ok', F3: 'ok', F4: 'ok',
  BX1: 'info', BX2: 'info', BX3: 'info',
  S1: 'purple', IBL: 'warn', Other: 'gray',
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── BreedingForm ──────────────────────────────────────────────────────────────

function BreedingForm({ strains, onSaved }) {
  const EMPTY = {
    parent_a: '', parent_b: '', result_strain: '', generation: '',
    cross_date: '', seed_count: '', success_rate: '', notes: '',
  }
  const [form, setForm]   = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.parent_a)      { setError('Parent Strain A is required'); return }
    if (!form.result_strain) { setError('Result Strain is required'); return }
    if (!form.generation)    { setError('Generation is required'); return }
    setSaving(true); setError('')
    try {
      await createBreedingRecord({
        parent_a:      form.parent_a,
        parent_b:      form.parent_b      || null,
        result_strain: form.result_strain,
        generation:    form.generation,
        cross_date:    form.cross_date    || null,
        seed_count:    form.seed_count    ? parseInt(form.seed_count, 10)    : null,
        success_rate:  form.success_rate  ? parseFloat(form.success_rate)    : null,
        notes:         form.notes         || null,
      })
      setForm(EMPTY)
      onSaved()
    } catch (err) {
      setError(err.message)
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
    <Panel title="New Breeding Record">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Row 1: Parent A / Parent B */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Parent Strain A *</label>
            <select style={inp} value={form.parent_a} onChange={e => set('parent_a', e.target.value)} required>
              <option value="">— Select strain —</option>
              {strains.map(s => <option key={s.strain} value={s.strain}>{s.strain}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Parent Strain B</label>
            <select style={inp} value={form.parent_b} onChange={e => set('parent_b', e.target.value)}>
              <option value="">— none (selfing) —</option>
              {strains.map(s => <option key={s.strain} value={s.strain}>{s.strain}</option>)}
            </select>
          </div>
        </div>

        {/* Row 2: Result Strain / Generation */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Result Strain *</label>
            <select style={inp} value={form.result_strain} onChange={e => set('result_strain', e.target.value)} required>
              <option value="">— Select strain —</option>
              {strains.map(s => <option key={s.strain} value={s.strain}>{s.strain}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Generation *</label>
            <select style={inp} value={form.generation} onChange={e => set('generation', e.target.value)} required>
              <option value="">— Select —</option>
              {GENERATIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        {/* Row 3: Cross Date / Seed Count / Success Rate */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Cross Date</label>
            <input style={inp} type="date" value={form.cross_date} onChange={e => set('cross_date', e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Seed Count</label>
            <input
              style={inp} type="number" min="0"
              value={form.seed_count}
              onChange={e => set('seed_count', e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label style={lbl}>Success Rate %</label>
            <input
              style={inp} type="number" min="0" max="100" step="0.1"
              value={form.success_rate}
              onChange={e => set('success_rate', e.target.value)}
              placeholder="0.0"
            />
          </div>
        </div>

        {/* Row 4: Notes */}
        <div>
          <label style={lbl}>Breeding Notes</label>
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

// ── RecordRow ─────────────────────────────────────────────────────────────────

function RecordRow({ record, onDelete, last }) {
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
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {record.parent_a ?? '—'}
      </span>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {record.parent_b ?? <span style={{ color: 'var(--text-3)' }}>selfing</span>}
      </span>
      <span style={{ width: 130, fontSize: 12, color: 'var(--text)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.result_strain ?? '—'}
      </span>
      <span style={{ width: 60, flexShrink: 0 }}>
        <Badge variant={GEN_VARIANT[record.generation] ?? 'gray'}>{record.generation ?? '—'}</Badge>
      </span>
      <span style={{ width: 90, fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {fmtDate(record.cross_date)}
      </span>
      <span style={{ width: 70, textAlign: 'right', fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {record.seed_count != null ? record.seed_count.toLocaleString() : '—'}
      </span>
      <span style={{ width: 76, textAlign: 'right', fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {record.success_rate != null ? `${parseFloat(record.success_rate).toFixed(1)}%` : '—'}
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

// ── BreedingRecords ───────────────────────────────────────────────────────────

export default function BreedingRecords() {
  const [records, setRecords]         = useState(null)
  const [strains, setStrains]         = useState([])
  const [actionError, setActionError] = useState(null)

  function load() {
    fetchBreedingRecords().then(setRecords).catch(() => setRecords([]))
  }

  useEffect(() => {
    load()
    fetchStrains().then(setStrains).catch(() => {})
  }, [])

  async function handleDelete(id) {
    if (!window.confirm('Delete this breeding record? This cannot be undone.')) return
    setActionError(null)
    try {
      await deleteBreedingRecord(id)
      setRecords(prev => prev ? prev.filter(r => r.id !== id) : prev)
    } catch (err) {
      setActionError(`Delete failed: ${err.message}`)
    }
  }

  const hdr = { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }

  const data = records ?? []
  const selfings    = data.filter(r => !r.parent_b).length
  const genCounts   = data.reduce((acc, r) => { acc[r.generation] = (acc[r.generation] ?? 0) + 1; return acc }, {})
  const topGen      = Object.entries(genCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
  const avgSuccess  = (() => {
    const vals = data.map(r => r.success_rate).filter(v => v != null)
    return vals.length > 0
      ? (vals.reduce((s, v) => s + parseFloat(v), 0) / vals.length).toFixed(1) + '%'
      : '—'
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <BreedingForm strains={strains} onSaved={load} />

      {actionError && (
        <div style={{ fontSize: 12, color: '#f87171' }}>{actionError}</div>
      )}

      {records && records.length > 0 && (
        <Grid cols={4} gap={8}>
          <StatCard label="Total Records"  value={records.length} />
          <StatCard label="Selfings"        value={selfings} />
          <StatCard label="Most Common Gen" value={topGen} />
          <StatCard label="Avg Success"     value={avgSuccess} />
        </Grid>
      )}

      {records === null ? (
        <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '32px', textAlign: 'center' }}>Loading…</div>
      ) : records.length === 0 ? (
        <Panel>
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            No breeding records yet. Use the form above to add one.
          </div>
        </Panel>
      ) : (
        <Panel fullWidth>
          <div style={{ display: 'flex', gap: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--border)', marginBottom: 2 }}>
            <span style={{ ...hdr, flex: 1 }}>Parent A</span>
            <span style={{ ...hdr, flex: 1 }}>Parent B</span>
            <span style={{ ...hdr, width: 130 }}>Result Strain</span>
            <span style={{ ...hdr, width: 60 }}>Gen.</span>
            <span style={{ ...hdr, width: 90 }}>Cross Date</span>
            <span style={{ ...hdr, width: 70, textAlign: 'right' }}>Seeds</span>
            <span style={{ ...hdr, width: 76, textAlign: 'right' }}>Success</span>
            <span style={{ ...hdr, width: 28 }} />
          </div>
          {records.map((r, i) => (
            <RecordRow
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
