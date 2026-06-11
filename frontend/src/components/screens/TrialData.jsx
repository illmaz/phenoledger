import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Panel, Badge, Grid, StatCard } from '../ui'
import { fetchTrials, createTrial, deleteTrial, fetchStrains } from '../../api'

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtWeight(g) {
  if (g == null) return '—'
  const n = parseFloat(g)
  return `${(n % 1 === 0 ? n : n.toFixed(1)).toLocaleString()}g`
}

const GROW_BADGE = { indoor: 'info', outdoor: 'ok', greenhouse: 'purple' }

function GrowBadge({ gt }) {
  if (!gt) return <span style={{ color: 'var(--text-3)' }}>—</span>
  return (
    <Badge variant={GROW_BADGE[gt] || 'gray'}>
      {gt.charAt(0).toUpperCase() + gt.slice(1)}
    </Badge>
  )
}

// ── RegisterModal ─────────────────────────────────────────────────────────────

function RegisterModal({ strains, onClose, onSaved }) {
  const [form, setForm] = useState({
    strain_id: '', location_name: '', grow_type: '',
    start_date: '', harvest_date: '', plant_count: '',
    grow_medium: '', light_cycle: '',
    temperature_min: '', temperature_max: '',
    humidity_min: '', humidity_max: '',
    wet_weight_g: '', dry_weight_g: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.strain_id) { setError('Strain is required'); return }
    setSaving(true); setError('')
    try {
      await createTrial({
        strain_id:       form.strain_id                                           || null,
        location_name:   form.location_name                                       || null,
        grow_type:       form.grow_type                                           || null,
        start_date:      form.start_date                                          || null,
        harvest_date:    form.harvest_date                                        || null,
        plant_count:     form.plant_count     ? parseInt(form.plant_count, 10)   : null,
        grow_medium:     form.grow_medium                                         || null,
        light_cycle:     form.light_cycle                                         || null,
        temperature_min: form.temperature_min ? parseFloat(form.temperature_min) : null,
        temperature_max: form.temperature_max ? parseFloat(form.temperature_max) : null,
        humidity_min:    form.humidity_min    ? parseFloat(form.humidity_min)    : null,
        humidity_max:    form.humidity_max    ? parseFloat(form.humidity_max)    : null,
        wet_weight_g:    form.wet_weight_g    ? parseFloat(form.wet_weight_g)    : null,
        dry_weight_g:    form.dry_weight_g    ? parseFloat(form.dry_weight_g)    : null,
        notes:           form.notes                                               || null,
      })
      onSaved()
    } catch (err) {
      setError(err.message); setSaving(false)
    }
  }

  const inp = {
    width: '100%', padding: '6px 9px', fontSize: 12, boxSizing: 'border-box',
    border: '0.5px solid var(--border)', borderRadius: 6,
    background: 'var(--bg)', color: 'var(--text)', outline: 'none',
  }
  const lbl  = { fontSize: 11, color: 'var(--text-2)', display: 'block', marginBottom: 4 }
  const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 10,
          padding: '28px 28px 24px', width: 520, maxWidth: '92vw', maxHeight: '90vh',
          overflowY: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Register Trial</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex' }}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div>
            <label style={lbl}>Strain *</label>
            <select style={inp} value={form.strain_id} onChange={e => set('strain_id', e.target.value)}>
              <option value="">— Select strain —</option>
              {strains.map(s => <option key={s.strain_id} value={s.strain_id}>{s.strain}</option>)}
            </select>
          </div>

          <div style={row2}>
            <div>
              <label style={lbl}>Location Name</label>
              <input style={inp} value={form.location_name} onChange={e => set('location_name', e.target.value)} placeholder="e.g. Greenhouse A" />
            </div>
            <div>
              <label style={lbl}>Grow Type</label>
              <select style={inp} value={form.grow_type} onChange={e => set('grow_type', e.target.value)}>
                <option value="">— Select —</option>
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
                <option value="greenhouse">Greenhouse</option>
              </select>
            </div>
          </div>

          <div style={row2}>
            <div>
              <label style={lbl}>Start Date</label>
              <input style={inp} type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Harvest Date</label>
              <input style={inp} type="date" value={form.harvest_date} onChange={e => set('harvest_date', e.target.value)} />
            </div>
          </div>

          <div style={row2}>
            <div>
              <label style={lbl}>Plant Count</label>
              <input style={inp} type="number" min="1" value={form.plant_count} onChange={e => set('plant_count', e.target.value)} placeholder="100" />
            </div>
            <div>
              <label style={lbl}>Grow Medium</label>
              <input style={inp} value={form.grow_medium} onChange={e => set('grow_medium', e.target.value)} placeholder="e.g. coco coir, soil, rockwool" />
            </div>
          </div>

          <div>
            <label style={lbl}>Light Cycle</label>
            <input style={inp} value={form.light_cycle} onChange={e => set('light_cycle', e.target.value)} placeholder="e.g. 18/6, 12/12, natural" />
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 8 }}>Temperature (°C)</div>
            <div style={row2}>
              <div>
                <label style={lbl}>Min</label>
                <input style={inp} type="number" step="0.1" value={form.temperature_min} onChange={e => set('temperature_min', e.target.value)} placeholder="22" />
              </div>
              <div>
                <label style={lbl}>Max</label>
                <input style={inp} type="number" step="0.1" value={form.temperature_max} onChange={e => set('temperature_max', e.target.value)} placeholder="28" />
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 8 }}>Humidity (%)</div>
            <div style={row2}>
              <div>
                <label style={lbl}>Min</label>
                <input style={inp} type="number" min="0" max="100" step="1" value={form.humidity_min} onChange={e => set('humidity_min', e.target.value)} placeholder="50" />
              </div>
              <div>
                <label style={lbl}>Max</label>
                <input style={inp} type="number" min="0" max="100" step="1" value={form.humidity_max} onChange={e => set('humidity_max', e.target.value)} placeholder="70" />
              </div>
            </div>
          </div>

          <div style={row2}>
            <div>
              <label style={lbl}>Wet Weight (g)</label>
              <input style={inp} type="number" min="0" step="0.1" value={form.wet_weight_g} onChange={e => set('wet_weight_g', e.target.value)} placeholder="1500" />
            </div>
            <div>
              <label style={lbl}>Dry Weight (g)</label>
              <input style={inp} type="number" min="0" step="0.1" value={form.dry_weight_g} onChange={e => set('dry_weight_g', e.target.value)} placeholder="250" />
            </div>
          </div>

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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{
              padding: '7px 14px', fontSize: 12, border: '0.5px solid var(--border)',
              borderRadius: 6, background: 'transparent', color: 'var(--text-2)', cursor: 'pointer',
            }}>Cancel</button>
            <button type="submit" disabled={saving} style={{
              padding: '7px 14px', fontSize: 12, fontWeight: 600, border: 'none',
              borderRadius: 6, background: saving ? '#2d6e4a' : '#4ade80',
              color: '#0a0a0a', cursor: saving ? 'not-allowed' : 'pointer',
            }}>
              {saving ? 'Saving…' : 'Register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── TrialRow ──────────────────────────────────────────────────────────────────

function TrialRow({ trial, onDelete, last }) {
  const [hovered, setHovered] = useState(false)
  const strainName = trial.strains?.name ?? '—'
  const hasCoA = Array.isArray(trial.trial_coa_links) && trial.trial_coa_links.length > 0

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
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {trial.location_name ?? <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span style={{ width: 130, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {strainName}
      </span>
      <span style={{ width: 90, flexShrink: 0 }}>
        <GrowBadge gt={trial.grow_type} />
      </span>
      <span style={{ width: 88, fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {fmtDate(trial.start_date)}
      </span>
      <span style={{ width: 88, fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {fmtDate(trial.harvest_date)}
      </span>
      <span style={{ width: 56, textAlign: 'right', fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {trial.plant_count != null ? trial.plant_count.toLocaleString() : '—'}
      </span>
      <span style={{ width: 76, textAlign: 'right', fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {fmtWeight(trial.dry_weight_g)}
      </span>
      <span style={{ width: 68, flexShrink: 0 }}>
        {hasCoA
          ? <Badge variant="ok">✓ COA</Badge>
          : <span style={{ fontSize: 12, color: 'var(--text-3)' }}>—</span>}
      </span>
      <div style={{ width: 28, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
        {hovered && (
          <button
            onClick={() => onDelete(trial.id)}
            title="Delete trial"
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

// ── TrialData ─────────────────────────────────────────────────────────────────

export default function TrialData() {
  const [trials, setTrials]           = useState(null)
  const [strains, setStrains]         = useState([])
  const [showModal, setShowModal]     = useState(false)
  const [actionError, setActionError] = useState(null)
  const [filterStrain, setFilterStrain]     = useState('')
  const [filterGrowType, setFilterGrowType] = useState('all')

  function load() {
    fetchTrials().then(setTrials).catch(() => setTrials([]))
  }

  useEffect(() => {
    load()
    fetchStrains().then(setStrains).catch(() => {})
  }, [])

  async function handleDelete(id) {
    if (!window.confirm('Delete this trial? This cannot be undone.')) return
    setActionError(null)
    try {
      await deleteTrial(id)
      setTrials(prev => prev ? prev.filter(t => t.id !== id) : prev)
    } catch (err) {
      setActionError(`Failed to delete trial: ${err.message}`)
    }
  }

  const data = trials ?? []

  const filtered = useMemo(() => {
    let r = data
    if (filterStrain)          r = r.filter(t => t.strain_id === filterStrain)
    if (filterGrowType !== 'all') r = r.filter(t => t.grow_type === filterGrowType)
    return r
  }, [data, filterStrain, filterGrowType])

  const uniqueStrains   = new Set(data.map(t => t.strain_id).filter(Boolean)).size
  const uniqueLocations = new Set(data.map(t => t.location_name).filter(Boolean)).size
  const dryWeights      = data.map(t => t.dry_weight_g).filter(v => v != null)
  const avgDryWeight    = dryWeights.length > 0
    ? `${Math.round(dryWeights.reduce((s, v) => s + parseFloat(v), 0) / dryWeights.length).toLocaleString()}g`
    : '—'

  const hdr     = { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }
  const pillBase = { padding: '3px 10px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Trial Data</div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 600, padding: '5px 12px',
            border: 'none', borderRadius: 6, background: '#4ade80', color: '#0a0a0a', cursor: 'pointer',
          }}
        >
          <Plus size={13} /> Register Trial
        </button>
      </div>

      {actionError && (
        <div style={{ fontSize: 12, color: '#f87171' }}>{actionError}</div>
      )}

      {/* Stats */}
      {trials && trials.length > 0 && (
        <Grid cols={4} gap={8}>
          <StatCard label="Total Trials"   value={trials.length} />
          <StatCard label="Strains Tested" value={uniqueStrains} />
          <StatCard label="Locations"      value={uniqueLocations} />
          <StatCard label="Avg Dry Weight" value={avgDryWeight} />
        </Grid>
      )}

      {/* Filters */}
      {trials && trials.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={filterStrain}
            onChange={e => setFilterStrain(e.target.value)}
            style={{
              padding: '4px 8px', fontSize: 11, borderRadius: 5,
              border: '0.5px solid var(--border)', background: 'var(--card)',
              color: 'var(--text)', outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">All Strains</option>
            {strains.map(s => <option key={s.strain_id} value={s.strain_id}>{s.strain}</option>)}
          </select>

          <div style={{ width: '0.5px', height: 16, background: 'var(--border)' }} />

          {['all', 'indoor', 'outdoor', 'greenhouse'].map(gt => (
            <button
              key={gt}
              onClick={() => setFilterGrowType(gt)}
              style={{
                ...pillBase,
                background: filterGrowType === gt ? '#4ade80' : 'rgba(255,255,255,0.07)',
                color:      filterGrowType === gt ? '#0a0a0a' : 'var(--text-2)',
                fontWeight: filterGrowType === gt ? 600 : 400,
              }}
            >
              {gt === 'all' ? 'All' : gt.charAt(0).toUpperCase() + gt.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {trials === null ? (
        <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '32px', textAlign: 'center' }}>Loading…</div>
      ) : trials.length === 0 ? (
        <Panel>
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            No trials registered yet. Click <strong>Register Trial</strong> to add one.
          </div>
        </Panel>
      ) : (
        <Panel fullWidth>
          <div style={{ display: 'flex', gap: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--border)', marginBottom: 2 }}>
            <span style={{ ...hdr, flex: 1 }}>Location</span>
            <span style={{ ...hdr, width: 130 }}>Strain</span>
            <span style={{ ...hdr, width: 90 }}>Grow Type</span>
            <span style={{ ...hdr, width: 88 }}>Start Date</span>
            <span style={{ ...hdr, width: 88 }}>Harvest Date</span>
            <span style={{ ...hdr, width: 56, textAlign: 'right' }}>Plants</span>
            <span style={{ ...hdr, width: 76, textAlign: 'right' }}>Dry Wt</span>
            <span style={{ ...hdr, width: 68 }}>COA</span>
            <span style={{ ...hdr, width: 28 }} />
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
              No trials match the current filters.
            </div>
          ) : (
            filtered.map((t, i) => (
              <TrialRow
                key={t.id}
                trial={t}
                onDelete={handleDelete}
                last={i === filtered.length - 1}
              />
            ))
          )}
        </Panel>
      )}

      {showModal && (
        <RegisterModal
          strains={strains}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
