import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { Panel, Grid, StatCard, Badge } from '../ui'
import {
  fetchMotherPlants, fetchUploads,
  fetchPlantHealthScreenings, createPlantHealthScreening, deletePlantHealthScreening,
} from '../../api'

const PATHOGENS = [
  'Fusarium', 'Botrytis', 'HLVd', 'Powdery Mildew',
  'Spider Mites', 'Russet Mites', 'Root Aphids', 'Other',
]

const RESULT_VARIANT = { negative: 'ok', positive: 'danger', pending: 'warn' }
const RESULT_LABEL   = { negative: 'Negative', positive: 'Positive', pending: 'Pending' }

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── ScreeningForm ─────────────────────────────────────────────────────────────

function ScreeningForm({ motherPlants, uploads, onSaved }) {
  const EMPTY = {
    target_type: 'mother_plant', target_id: '',
    pathogen: '', test_date: '', result: 'pending',
    testing_lab: '', notes: '',
  }
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function switchTarget(type) {
    setForm(f => ({ ...f, target_type: type, target_id: '' }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.target_id)  { setError('Select a target'); return }
    if (!form.pathogen)   { setError('Pathogen is required'); return }
    if (!form.test_date)  { setError('Test date is required'); return }
    setSaving(true); setError('')
    try {
      await createPlantHealthScreening({
        target_type:  form.target_type,
        target_id:    form.target_id,
        pathogen:     form.pathogen,
        test_date:    form.test_date,
        result:       form.result,
        testing_lab:  form.testing_lab  || null,
        notes:        form.notes        || null,
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

  const targets     = form.target_type === 'mother_plant' ? motherPlants : uploads
  const targetLabel = form.target_type === 'mother_plant' ? 'Mother Plant' : 'COA Batch'
  const getLabel    = t => form.target_type === 'mother_plant' ? t.plant_code : (t.name ?? t.sample_name ?? t.id)

  return (
    <Panel title="New Health Screening">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Target type toggle */}
        <div>
          <label style={lbl}>Target Type</label>
          <div style={{ display: 'flex', border: '0.5px solid var(--border)', borderRadius: 6, overflow: 'hidden', width: 'fit-content' }}>
            {['mother_plant', 'coa_batch'].map((type, i) => (
              <button
                key={type}
                type="button"
                onClick={() => switchTarget(type)}
                style={{
                  padding: '5px 14px', fontSize: 11, border: 'none', cursor: 'pointer',
                  borderLeft: i > 0 ? '0.5px solid var(--border)' : 'none',
                  background: form.target_type === type ? 'rgba(255,255,255,0.07)' : 'transparent',
                  color: form.target_type === type ? 'var(--text)' : 'var(--text-2)',
                }}
              >
                {type === 'mother_plant' ? 'Mother Plant' : 'COA Batch'}
              </button>
            ))}
          </div>
        </div>

        {/* Target selector */}
        <div>
          <label style={lbl}>{targetLabel} *</label>
          <select style={inp} value={form.target_id} onChange={e => set('target_id', e.target.value)} required>
            <option value="">— Select {targetLabel.toLowerCase()} —</option>
            {targets.map(t => (
              <option key={t.id} value={t.id}>{getLabel(t)}</option>
            ))}
          </select>
        </div>

        {/* Pathogen / Result */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Pathogen *</label>
            <select style={inp} value={form.pathogen} onChange={e => set('pathogen', e.target.value)} required>
              <option value="">— Select —</option>
              {PATHOGENS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Result</label>
            <select style={inp} value={form.result} onChange={e => set('result', e.target.value)}>
              <option value="pending">Pending</option>
              <option value="negative">Negative</option>
              <option value="positive">Positive</option>
            </select>
          </div>
        </div>

        {/* Test Date / Testing Lab */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Test Date *</label>
            <input style={inp} type="date" value={form.test_date} onChange={e => set('test_date', e.target.value)} required />
          </div>
          <div>
            <label style={lbl}>Testing Lab</label>
            <input style={inp} value={form.testing_lab} onChange={e => set('testing_lab', e.target.value)} placeholder="Lab name" />
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
            {saving ? 'Saving…' : 'Save Screening'}
          </button>
        </div>
      </form>
    </Panel>
  )
}

// ── ScreeningRow ──────────────────────────────────────────────────────────────

function targetDisplay(record) {
  const name = record.target_name
    ?? record.target?.name
    ?? record.target?.plant_code
    ?? record.target_id
    ?? '—'
  const suffix = record.target_type === 'mother_plant' ? 'MP' : 'COA'
  return { name, suffix }
}

function ScreeningRow({ record, onDelete, last }) {
  const [hovered, setHovered] = useState(false)
  const { name, suffix } = targetDisplay(record)

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
        {name}
        <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 5 }}>{suffix}</span>
      </span>
      <span style={{ width: 110, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.pathogen ?? '—'}
      </span>
      <span style={{ width: 90, fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {fmtDate(record.test_date)}
      </span>
      <span style={{ width: 80, flexShrink: 0 }}>
        <Badge variant={RESULT_VARIANT[record.result] ?? 'gray'}>
          {RESULT_LABEL[record.result] ?? record.result ?? '—'}
        </Badge>
      </span>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {record.testing_lab ?? <span style={{ color: 'var(--text-3)' }}>—</span>}
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

// ── PlantHealthScreenings ─────────────────────────────────────────────────────

export default function PlantHealthScreenings() {
  const [screenings, setScreenings]   = useState(null)
  const [motherPlants, setMotherPlants] = useState([])
  const [uploads, setUploads]           = useState([])
  const [actionError, setActionError]   = useState(null)

  async function loadScreenings() {
    try {
      const data = await fetchPlantHealthScreenings()
      setScreenings(data)
    } catch {
      setScreenings([])
    }
  }

  useEffect(() => {
    loadScreenings()
    fetchMotherPlants().then(setMotherPlants).catch(() => {})
    fetchUploads().then(setUploads).catch(() => {})
  }, [])

  async function handleDelete(id) {
    if (!window.confirm('Delete this screening record? This cannot be undone.')) return
    setActionError(null)
    try {
      await deletePlantHealthScreening(id)
      setScreenings(prev => prev ? prev.filter(s => s.id !== id) : prev)
    } catch (err) {
      setActionError(`Delete failed: ${err.message}`)
    }
  }

  const hdr = { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }

  const data      = screenings ?? []
  const positives = data.filter(s => s.result === 'positive').length
  const pending   = data.filter(s => s.result === 'pending').length
  const labs      = new Set(data.map(s => s.testing_lab).filter(Boolean)).size

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <ScreeningForm
        motherPlants={motherPlants}
        uploads={uploads}
        onSaved={loadScreenings}
      />

      {actionError && (
        <div style={{ fontSize: 12, color: '#f87171' }}>{actionError}</div>
      )}

      {screenings && screenings.length > 0 && (
        <Grid cols={4} gap={8}>
          <StatCard label="Total Screenings"    value={screenings.length} />
          <StatCard label="Positive Detections" value={positives} subVariant={positives > 0 ? 'warn' : undefined} />
          <StatCard label="Pending Results"     value={pending} />
          <StatCard label="Labs Used"           value={labs || '—'} />
        </Grid>
      )}

      {screenings === null ? (
        <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '32px', textAlign: 'center' }}>Loading…</div>
      ) : screenings.length === 0 ? (
        <Panel>
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            No screenings recorded yet. Use the form above to add one.
          </div>
        </Panel>
      ) : (
        <Panel fullWidth>
          <div style={{ display: 'flex', gap: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--border)', marginBottom: 2 }}>
            <span style={{ ...hdr, flex: 1 }}>Target</span>
            <span style={{ ...hdr, width: 110 }}>Pathogen</span>
            <span style={{ ...hdr, width: 90 }}>Test Date</span>
            <span style={{ ...hdr, width: 80 }}>Result</span>
            <span style={{ ...hdr, flex: 1 }}>Lab</span>
            <span style={{ ...hdr, width: 28 }} />
          </div>
          {screenings.map((s, i) => (
            <ScreeningRow
              key={s.id}
              record={s}
              onDelete={handleDelete}
              last={i === screenings.length - 1}
            />
          ))}
        </Panel>
      )}
    </div>
  )
}
