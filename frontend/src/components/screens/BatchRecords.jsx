import { useState, useEffect } from 'react'
import { Trash2, Plus, FileDown, Loader } from 'lucide-react'
import { Panel, Grid, StatCard, Badge } from '../ui'
import { fetchAllStrains, fetchSeedLots, fetchMotherPlants, fetchTrials, fetchBatchRecords, createBatchRecord, deleteBatchRecord, downloadBatchReport } from '../../api'

const STATUSES = ['planning', 'growing', 'harvested', 'tested', 'complete']

const STATUS_VARIANT = {
  planning: 'gray',
  growing:  'ok',
  harvested:'warn',
  tested:   'info',
  complete: 'purple',
}
const STATUS_LABEL = {
  planning: 'Planning',
  growing:  'Growing',
  harvested:'Harvested',
  tested:   'Tested',
  complete: 'Complete',
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function shortId(id) {
  if (!id) return '—'
  return String(id).slice(0, 8).toUpperCase()
}

// ── BatchForm ─────────────────────────────────────────────────────────────────

function BatchForm({ strains, seedLots, motherPlants, trials, onSaved, onCancel }) {
  const EMPTY = {
    batch_code: '', strain_id: '', status: 'planning',
    seed_lot_id: '', mother_plant_id: '', trial_id: '', notes: '',
  }
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.batch_code.trim()) { setError('Batch Code is required'); return }
    setSaving(true); setError('')
    try {
      await createBatchRecord({
        batch_code:      form.batch_code.trim(),
        strain_id:       form.strain_id       || null,
        status:          form.status,
        seed_lot_id:     form.seed_lot_id     || null,
        mother_plant_id: form.mother_plant_id || null,
        trial_id:        form.trial_id        || null,
        notes:           form.notes           || null,
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
    <Panel title="New Batch Record">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Row 1: Batch Code / Strain */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Batch Code *</label>
            <input
              style={inp} value={form.batch_code}
              onChange={e => set('batch_code', e.target.value)}
              placeholder="e.g. BTH-2024-001"
              required
            />
          </div>
          <div>
            <label style={lbl}>Strain</label>
            <select style={inp} value={form.strain_id} onChange={e => set('strain_id', e.target.value)}>
              <option value="">— Select strain —</option>
              {strains.map(s => <option key={s.strain_id} value={s.strain_id}>{s.strain}</option>)}
            </select>
          </div>
        </div>

        {/* Row 2: Status / Seed Lot */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Status</label>
            <select style={inp} value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Seed Lot</label>
            <select style={inp} value={form.seed_lot_id} onChange={e => set('seed_lot_id', e.target.value)}>
              <option value="">— None —</option>
              {seedLots.map(l => <option key={l.id} value={l.id}>{l.lot_code}</option>)}
            </select>
          </div>
        </div>

        {/* Row 3: Mother Plant / Trial */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Mother Plant</label>
            <select style={inp} value={form.mother_plant_id} onChange={e => set('mother_plant_id', e.target.value)}>
              <option value="">— None —</option>
              {motherPlants.map(p => <option key={p.id} value={p.id}>{p.plant_code}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Trial</label>
            <select style={inp} value={form.trial_id} onChange={e => set('trial_id', e.target.value)}>
              <option value="">— None —</option>
              {trials.map(t => <option key={t.id} value={t.id}>{t.location_name || t.id}</option>)}
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
            {saving ? 'Saving…' : 'Save Batch Record'}
          </button>
        </div>
      </form>
    </Panel>
  )
}

// ── BatchRow ──────────────────────────────────────────────────────────────────

function BatchRow({ record, onDelete, last }) {
  const [hovered, setHovered]           = useState(false)
  const [downloading, setDownloading]   = useState(false)
  const [downloadError, setDownloadError] = useState(false)

  const strainName = record.strains?.name ?? record.strains?.strain ?? '—'

  async function handleDownload() {
    setDownloading(true)
    setDownloadError(false)
    try {
      await downloadBatchReport(record.id, record.batch_code)
    } catch {
      setDownloadError(true)
    } finally {
      setDownloading(false)
    }
  }

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
      <span style={{ width: 130, fontSize: 12, fontFamily: 'monospace', color: 'var(--text)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.batch_code ?? '—'}
      </span>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {strainName}
      </span>
      <span style={{ width: 90, flexShrink: 0 }}>
        <Badge variant={STATUS_VARIANT[record.status] ?? 'gray'}>
          {STATUS_LABEL[record.status] ?? record.status ?? '—'}
        </Badge>
      </span>
      <span style={{ width: 90, fontSize: 11, color: 'var(--text-3)', flexShrink: 0, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.seed_lot_id ? shortId(record.seed_lot_id) : <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span style={{ width: 90, fontSize: 11, color: 'var(--text-3)', flexShrink: 0, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.mother_plant_id ? shortId(record.mother_plant_id) : <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span style={{ width: 80, fontSize: 11, color: 'var(--text-3)', flexShrink: 0, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.trial_id ? shortId(record.trial_id) : <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span style={{ width: 80, fontSize: 11, color: 'var(--text-3)', flexShrink: 0, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.coa_report_id ? shortId(record.coa_report_id) : <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span style={{ width: 90, fontSize: 11, color: 'var(--text-2)', flexShrink: 0 }}>
        {fmtDate(record.created_at)}
      </span>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={handleDownload}
          disabled={downloading}
          title={downloadError ? 'Download failed — try again' : 'Download PDF report'}
          style={{
            padding: '2px 6px', border: 'none', background: 'transparent', borderRadius: 4,
            cursor: downloading ? 'default' : 'pointer',
            color: downloadError ? '#f87171' : '#60a5fa',
            opacity: downloading ? 0.6 : 1,
            display: 'flex', alignItems: 'center', gap: 3, fontSize: 11,
          }}
        >
          {downloading
            ? <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} />
            : <FileDown size={11} />
          }
        </button>
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
  )
}

// ── BatchRecords ──────────────────────────────────────────────────────────────

export default function BatchRecords() {
  const [records, setRecords]         = useState(null)
  const [strains, setStrains]           = useState([])
  const [seedLots, setSeedLots]         = useState([])
  const [motherPlants, setMotherPlants] = useState([])
  const [trials, setTrials]             = useState([])
  const [showForm, setShowForm]         = useState(false)
  const [actionError, setActionError]   = useState(null)

  async function loadRecords() {
    try {
      const data = await fetchBatchRecords()
      setRecords(data)
    } catch {
      setRecords([])
    }
  }

  useEffect(() => {
    loadRecords()
    fetchAllStrains().then(setStrains).catch(() => {})
    fetchSeedLots().then(setSeedLots).catch(() => {})
    fetchMotherPlants().then(setMotherPlants).catch(() => {})
    fetchTrials().then(setTrials).catch(() => {})
  }, [])

  async function handleDelete(id) {
    if (!window.confirm('Delete this batch record? This cannot be undone.')) return
    setActionError(null)
    try {
      await deleteBatchRecord(id)
      setRecords(prev => prev ? prev.filter(r => r.id !== id) : prev)
    } catch (err) {
      setActionError(`Delete failed: ${err.message}`)
    }
  }

  const hdr = { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }

  const data      = records ?? []
  const planning  = data.filter(r => r.status === 'planning').length
  const inProgress= data.filter(r => r.status === 'growing' || r.status === 'harvested').length
  const completed = data.filter(r => r.status === 'tested' || r.status === 'complete').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {showForm ? (
        <BatchForm
          strains={strains}
          seedLots={seedLots}
          motherPlants={motherPlants}
          trials={trials}
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
            <Plus size={13} /> New Batch Record
          </button>
        </div>
      )}

      {actionError && (
        <div style={{ fontSize: 12, color: '#f87171' }}>{actionError}</div>
      )}

      {records && records.length > 0 && (
        <Grid cols={4} gap={8}>
          <StatCard label="Total Batches" value={records.length} />
          <StatCard label="Planning"      value={planning} />
          <StatCard label="In Progress"   value={inProgress} subVariant={inProgress > 0 ? 'ok' : undefined} />
          <StatCard label="Completed"     value={completed} subVariant={completed > 0 ? 'ok' : undefined} />
        </Grid>
      )}

      {records === null ? (
        <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '32px', textAlign: 'center' }}>Loading…</div>
      ) : records.length === 0 ? (
        <Panel>
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            No batch records yet. Use the button above to add one.
          </div>
        </Panel>
      ) : (
        <Panel fullWidth>
          <div style={{ display: 'flex', gap: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--border)', marginBottom: 2 }}>
            <span style={{ ...hdr, width: 130 }}>Batch Code</span>
            <span style={{ ...hdr, flex: 1 }}>Strain</span>
            <span style={{ ...hdr, width: 90 }}>Status</span>
            <span style={{ ...hdr, width: 90 }}>Seed Lot</span>
            <span style={{ ...hdr, width: 90 }}>Mother Plant</span>
            <span style={{ ...hdr, width: 80 }}>Trial</span>
            <span style={{ ...hdr, width: 80 }}>COA</span>
            <span style={{ ...hdr, width: 90 }}>Created</span>
            <span style={{ ...hdr, width: 52 }} />
          </div>
          {records.map((r, i) => (
            <BatchRow
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
