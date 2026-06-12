import { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, Trash2, X, ChevronLeft } from 'lucide-react'
import { Panel, Badge, Grid, StatCard, TOOLTIP_STYLE, AXIS_TICK, GRID_COLOR } from '../ui'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  fetchTrials, createTrial, deleteTrial, fetchStrains,
  fetchTrialDetail, fetchTrialEvents, createTrialEvent, linkTrialCOA,
  fetchStrainBatches, fetchTrialAnalyticsSummary,
} from '../../api'

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
  return <Badge variant={GROW_BADGE[gt] || 'gray'}>{gt.charAt(0).toUpperCase() + gt.slice(1)}</Badge>
}

const EVENT_BADGE = { pesticide: 'warn', nutrient: 'ok', anomaly: 'danger', observation: 'info' }

function DataField({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
      padding: '5px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)',
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--text-2)', textAlign: 'right' }}>
        {value != null && value !== '' ? value : <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
    </div>
  )
}

function YieldStat({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--text)', lineHeight: 1 }}>{value ?? '—'}</div>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginTop: 5 }}>{label}</div>
    </div>
  )
}

// ── AddEventModal ─────────────────────────────────────────────────────────────

function AddEventModal({ trialId, onClose, onSaved }) {
  const [form, setForm] = useState({
    event_date: '', event_type: 'observation',
    product_name: '', quantity: '', unit: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.event_date) { setError('Event date is required'); return }
    setSaving(true); setError('')
    try {
      await createTrialEvent(trialId, {
        event_date:   form.event_date,
        event_type:   form.event_type,
        product_name: form.product_name || null,
        quantity:     form.quantity ? parseFloat(form.quantity) : null,
        unit:         form.unit     || null,
        notes:        form.notes    || null,
      })
      onSaved()
    } catch (err) {
      setError(err.message); setSaving(false)
    }
  }

  const inp  = { width: '100%', padding: '6px 9px', fontSize: 12, boxSizing: 'border-box', border: '0.5px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', outline: 'none' }
  const lbl  = { fontSize: 11, color: 'var(--text-2)', display: 'block', marginBottom: 4 }
  const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '28px 28px 24px', width: 420, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Add Event</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex' }}><X size={15} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={row2}>
            <div>
              <label style={lbl}>Date *</label>
              <input style={inp} type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)} required />
            </div>
            <div>
              <label style={lbl}>Event Type</label>
              <select style={inp} value={form.event_type} onChange={e => set('event_type', e.target.value)}>
                <option value="observation">Observation</option>
                <option value="pesticide">Pesticide</option>
                <option value="nutrient">Nutrient</option>
                <option value="anomaly">Anomaly</option>
              </select>
            </div>
          </div>

          <div>
            <label style={lbl}>Product Name</label>
            <input style={inp} value={form.product_name} onChange={e => set('product_name', e.target.value)} placeholder="e.g. Neem Oil, Cal-Mag" />
          </div>

          <div style={row2}>
            <div>
              <label style={lbl}>Quantity</label>
              <input style={inp} type="number" min="0" step="0.01" value={form.quantity} onChange={e => set('quantity', e.target.value)} placeholder="10" />
            </div>
            <div>
              <label style={lbl}>Unit</label>
              <input style={inp} value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="mL, g, L" />
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
              <div style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'right', marginTop: 2 }}>{form.notes.length}/500</div>
            )}
          </div>

          {error && <div style={{ fontSize: 12, color: '#f87171' }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '7px 14px', fontSize: 12, border: '0.5px solid var(--border)', borderRadius: 6, background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: saving ? '#2d6e4a' : '#4ade80', color: '#0a0a0a', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : 'Add Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
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

  const inp  = { width: '100%', padding: '6px 9px', fontSize: 12, boxSizing: 'border-box', border: '0.5px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', outline: 'none' }
  const lbl  = { fontSize: 11, color: 'var(--text-2)', display: 'block', marginBottom: 4 }
  const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '28px 28px 24px', width: 520, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Register Trial</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex' }}><X size={15} /></button>
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
              <div style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'right', marginTop: 2 }}>{form.notes.length}/500</div>
            )}
          </div>

          {error && <div style={{ fontSize: 12, color: '#f87171' }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '7px 14px', fontSize: 12, border: '0.5px solid var(--border)', borderRadius: 6, background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: saving ? '#2d6e4a' : '#4ade80', color: '#0a0a0a', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : 'Register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── TrialDetail ───────────────────────────────────────────────────────────────

function TrialDetail({ trial: initialTrial, onBack }) {
  const [detail, setDetail]   = useState(null)
  const [events, setEvents]   = useState(null)
  const [loadErr, setLoadErr] = useState(null)
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [showLinkCOA, setShowLinkCOA]   = useState(false)
  const [batches, setBatches]             = useState([])
  const [batchesLoading, setBatchesLoading] = useState(false)
  const [selectedBatch, setSelectedBatch]   = useState('')
  const [linking, setLinking]       = useState(false)
  const [linkError, setLinkError]   = useState(null)
  const [refreshWarn, setRefreshWarn] = useState(false)

  function reloadDetail() {
    return fetchTrialDetail(initialTrial.id)
      .then(setDetail)
      .catch(e => setLoadErr(e.message))
  }
  function reloadEvents() {
    return fetchTrialEvents(initialTrial.id)
      .then(setEvents)
      .catch(() => setEvents([]))
  }

  useEffect(() => {
    reloadDetail()
    reloadEvents()
  }, [initialTrial.id])

  function handleShowLinkCOA() {
    setShowLinkCOA(true)
    setLinkError(null)
    setSelectedBatch('')
    const strainName = (detail || initialTrial).strains?.name
    if (!strainName) return
    setBatchesLoading(true)
    fetchStrainBatches(strainName)
      .then(setBatches)
      .catch(() => setBatches([]))
      .finally(() => setBatchesLoading(false))
  }

  async function handleLinkCOA() {
    if (!selectedBatch) return
    setLinking(true); setLinkError(null)
    try {
      await linkTrialCOA(initialTrial.id, selectedBatch)
    } catch (err) {
      setLinkError(err.message)
      setLinking(false)
      return
    }
    setShowLinkCOA(false)
    setSelectedBatch('')
    setLinking(false)
    fetchTrialDetail(initialTrial.id)
      .then(setDetail)
      .catch(() => setRefreshWarn(true))
  }

  const t          = detail || initialTrial
  const strainName = t.strains?.name ?? '—'
  const motherCode = t.mother_plants?.plant_code ?? null

  const dryG   = t.dry_weight_g != null ? parseFloat(t.dry_weight_g) : null
  const wetG   = t.wet_weight_g != null ? parseFloat(t.wet_weight_g) : null
  const plants = t.plant_count  != null ? parseInt(t.plant_count, 10) : null

  const yieldPerPlant = dryG && plants ? `${(dryG / plants).toFixed(1)}g` : '—'
  const efficiency    = dryG && wetG && wetG > 0 ? `${(dryG / wetG * 100).toFixed(1)}%` : '—'

  const linkedCOAs   = detail?.trial_coa_links || []
  const linkedIds    = new Set(linkedCOAs.map(l => l.report_id))
  const availBatches = batches.filter(b => !linkedIds.has(b.report_id))

  const selInp = {
    padding: '5px 9px', fontSize: 12, boxSizing: 'border-box',
    border: '0.5px solid var(--border)', borderRadius: 6,
    background: 'var(--bg)', color: 'var(--text)', outline: 'none',
  }
  const smallBtn = (extra = {}) => ({
    padding: '4px 10px', fontSize: 11, fontWeight: 500, border: 'none',
    borderRadius: 5, cursor: 'pointer', ...extra,
  })

  if (loadErr) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 12, padding: '4px 0', width: 'fit-content' }}>
          <ChevronLeft size={13} /> Back to Trials
        </button>
        <div style={{ fontSize: 12, color: '#f87171' }}>Failed to load trial: {loadErr}</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 12, padding: '4px 0', flexShrink: 0 }}
        >
          <ChevronLeft size={13} /> Back
        </button>
        <div style={{ width: '0.5px', height: 14, background: 'var(--border)', flexShrink: 0 }} />
        <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t.location_name || 'Trial'}
        </div>
        <GrowBadge gt={t.grow_type} />
        <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>{strainName}</span>
      </div>

      {/* Info + Environmental grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Panel title="Trial Info">
          <DataField label="Strain"       value={strainName} />
          {motherCode && <DataField label="Mother Plant" value={motherCode} />}
          <DataField label="Location"     value={t.location_name} />
          <DataField label="Start Date"   value={fmtDate(t.start_date)} />
          <DataField label="Harvest Date" value={fmtDate(t.harvest_date)} />
          {t.notes && (
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 10, paddingTop: 10, borderTop: '0.5px solid rgba(255,255,255,0.05)', lineHeight: 1.5 }}>
              {t.notes}
            </div>
          )}
        </Panel>

        <Panel title="Environmental Conditions">
          <DataField
            label="Temperature"
            value={t.temperature_min != null || t.temperature_max != null
              ? `${t.temperature_min ?? '?'}°C – ${t.temperature_max ?? '?'}°C`
              : null}
          />
          <DataField
            label="Humidity"
            value={t.humidity_min != null || t.humidity_max != null
              ? `${t.humidity_min ?? '?'}% – ${t.humidity_max ?? '?'}%`
              : null}
          />
          <DataField label="Grow Medium" value={t.grow_medium} />
          <DataField label="Light Cycle" value={t.light_cycle} />
          <DataField label="Plant Count" value={t.plant_count?.toLocaleString()} />
        </Panel>
      </div>

      {/* Yield Summary */}
      <Panel title="Yield">
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '10px 0' }}>
          <YieldStat label="Wet Weight"       value={fmtWeight(t.wet_weight_g)} />
          <div style={{ width: '0.5px', height: 36, background: 'rgba(255,255,255,0.08)' }} />
          <YieldStat label="Dry Weight"       value={fmtWeight(t.dry_weight_g)} />
          <div style={{ width: '0.5px', height: 36, background: 'rgba(255,255,255,0.08)' }} />
          <YieldStat label="Plants"           value={t.plant_count?.toLocaleString() ?? '—'} />
          <div style={{ width: '0.5px', height: 36, background: 'rgba(255,255,255,0.08)' }} />
          <YieldStat label="Yield per Plant"  value={yieldPerPlant} />
          <div style={{ width: '0.5px', height: 36, background: 'rgba(255,255,255,0.08)' }} />
          <YieldStat label="Yield Efficiency" value={efficiency} />
        </div>
      </Panel>

      {refreshWarn && (
        <div style={{ fontSize: 11, color: '#fbbf24', padding: '6px 10px', background: 'rgba(251,191,36,0.08)', borderRadius: 5, border: '0.5px solid rgba(251,191,36,0.2)' }}>
          Refresh failed — please reload
        </div>
      )}

      {/* Linked COAs */}
      <Panel
        title="Linked COAs"
        titleRight={
          !showLinkCOA && (
            <button
              onClick={handleShowLinkCOA}
              style={{ ...smallBtn(), background: 'rgba(255,255,255,0.07)', color: 'var(--text-2)', fontSize: 11 }}
            >
              + Link COA
            </button>
          )
        }
      >
        {detail === null ? (
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Loading…</div>
        ) : linkedCOAs.length === 0 && !showLinkCOA ? (
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>No COAs linked to this trial.</div>
        ) : (
          linkedCOAs.map((link, i) => {
            const r = link.coa_reports || {}
            return (
              <div key={link.report_id} style={{
                display: 'flex', justifyContent: 'space-between', gap: 12,
                padding: '6px 0',
                borderBottom: i < linkedCOAs.length - 1 || showLinkCOA ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
              }}>
                <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{r.sample_name || link.report_id}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{fmtDate(r.report_date)}</span>
              </div>
            )
          })
        )}

        {showLinkCOA && (
          <div style={{ marginTop: linkedCOAs.length > 0 ? 10 : 0, paddingTop: linkedCOAs.length > 0 ? 10 : 0 }}>
            {batchesLoading ? (
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Loading batches…</div>
            ) : availBatches.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>No unlinked batches available for this strain.</div>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={selectedBatch}
                  onChange={e => setSelectedBatch(e.target.value)}
                  style={{ ...selInp, flex: 1 }}
                >
                  <option value="">— Select batch —</option>
                  {availBatches.map(b => (
                    <option key={b.report_id} value={b.report_id}>
                      {fmtDate(b.date)}{b.thca != null ? ` — THCA ${b.thca}%` : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleLinkCOA}
                  disabled={!selectedBatch || linking}
                  style={{ ...smallBtn(), background: (!selectedBatch || linking) ? '#2d6e4a' : '#4ade80', color: '#0a0a0a', fontWeight: 600 }}
                >
                  {linking ? 'Linking…' : 'Link'}
                </button>
                <button
                  onClick={() => { setShowLinkCOA(false); setLinkError(null) }}
                  style={{ ...smallBtn(), background: 'transparent', border: '0.5px solid var(--border)', color: 'var(--text-2)' }}
                >
                  Cancel
                </button>
              </div>
            )}
            {linkError && <div style={{ fontSize: 12, color: '#f87171', marginTop: 6 }}>{linkError}</div>}
          </div>
        )}
      </Panel>

      {/* Trial Events */}
      <Panel
        title="Trial Events"
        titleRight={
          <button
            onClick={() => setShowAddEvent(true)}
            style={{ ...smallBtn(), background: 'rgba(255,255,255,0.07)', color: 'var(--text-2)', fontSize: 11 }}
          >
            + Add Event
          </button>
        }
      >
        {events === null ? (
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Loading…</div>
        ) : events.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>No events logged for this trial.</div>
        ) : (
          events.map((ev, i) => (
            <div key={ev.id} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '8px 0',
              borderBottom: i < events.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
            }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0, width: 80 }}>
                {fmtDate(ev.event_date)}
              </span>
              <div style={{ flexShrink: 0 }}>
                <Badge variant={EVENT_BADGE[ev.event_type] || 'gray'}>
                  {ev.event_type ? ev.event_type.charAt(0).toUpperCase() + ev.event_type.slice(1) : '—'}
                </Badge>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {ev.product_name && (
                  <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>
                    {ev.product_name}
                    {ev.quantity != null
                      ? ` — ${ev.quantity}${ev.unit ? ' ' + ev.unit : ''}`
                      : ''}
                  </div>
                )}
                {ev.notes && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: ev.product_name ? 2 : 0, lineHeight: 1.4 }}>
                    {ev.notes}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </Panel>

      {showAddEvent && (
        <AddEventModal
          trialId={initialTrial.id}
          onClose={() => setShowAddEvent(false)}
          onSaved={() => { setShowAddEvent(false); reloadEvents() }}
        />
      )}
    </div>
  )
}

// ── TrialAnalytics ────────────────────────────────────────────────────────────

function TrialAnalytics({ data, error }) {
  if (data === null && !error) {
    return <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: 32 }}>Loading…</div>
  }

  if (error) {
    return <div style={{ fontSize: 12, color: '#f87171', padding: '12px 0' }}>Failed to load analytics: {error}</div>
  }

  const hasData = data.length > 0 && data.some(r => r.avg_thca != null || r.avg_yield_per_plant_g != null)

  if (!hasData) {
    return (
      <Panel>
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
          Not enough data yet — register trials and link COAs to see analytics.
        </div>
      </Panel>
    )
  }

  const chartData = data.map(r => ({
    name:      r.grow_type ? r.grow_type.charAt(0).toUpperCase() + r.grow_type.slice(1) : 'Unknown',
    thca:      r.avg_thca              != null ? parseFloat(r.avg_thca.toFixed(2))              : null,
    yieldPlant: r.avg_yield_per_plant_g != null ? parseFloat(r.avg_yield_per_plant_g.toFixed(1)) : null,
  }))

  const hdr = { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <Panel title="Performance by Grow Type">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} barCategoryGap="40%">
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis
              yAxisId="thca"
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => v + '%'}
              width={38}
            />
            <YAxis
              yAxisId="yield"
              orientation="right"
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => v + 'g'}
              width={42}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value, name) =>
                name === 'Avg THCA %' ? [value + '%', name] : [value + 'g', name]
              }
            />
            <Legend wrapperStyle={{ fontSize: 10, color: '#888' }} iconType="rect" iconSize={8} />
            <Bar yAxisId="thca"  dataKey="thca"       name="Avg THCA %"     fill="#4ade80" radius={[2, 2, 0, 0]} />
            <Bar yAxisId="yield" dataKey="yieldPlant" name="Avg Yield/Plant" fill="#60a5fa" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel fullWidth>
        <div style={{ display: 'flex', gap: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--border)', marginBottom: 2 }}>
          <span style={{ ...hdr, width: 110 }}>Grow Type</span>
          <span style={{ ...hdr, width: 72, textAlign: 'right' }}>Trials</span>
          <span style={{ ...hdr, flex: 1, textAlign: 'right' }}>Avg THCA%</span>
          <span style={{ ...hdr, flex: 1, textAlign: 'right' }}>Avg Yield/Plant</span>
          <span style={{ ...hdr, flex: 1, textAlign: 'right' }}>Avg Yield Eff.</span>
        </div>
        {data.map((r, i) => (
          <div key={r.grow_type ?? i} style={{
            display: 'flex', gap: 12, padding: '8px 0', alignItems: 'center',
            borderBottom: i < data.length - 1 ? '0.5px solid var(--border)' : 'none',
          }}>
            <span style={{ width: 110, flexShrink: 0 }}>
              <GrowBadge gt={r.grow_type} />
            </span>
            <span style={{ width: 72, textAlign: 'right', fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
              {r.trial_count}
            </span>
            <span style={{ flex: 1, textAlign: 'right', fontSize: 12, color: 'var(--text-2)' }}>
              {r.avg_thca != null ? r.avg_thca.toFixed(2) + '%' : '—'}
            </span>
            <span style={{ flex: 1, textAlign: 'right', fontSize: 12, color: 'var(--text-2)' }}>
              {r.avg_yield_per_plant_g != null ? r.avg_yield_per_plant_g.toFixed(1) + 'g' : '—'}
            </span>
            <span style={{ flex: 1, textAlign: 'right', fontSize: 12, color: 'var(--text-2)' }}>
              {r.avg_yield_efficiency_pct != null ? r.avg_yield_efficiency_pct.toFixed(1) + '%' : '—'}
            </span>
          </div>
        ))}
      </Panel>
    </div>
  )
}

// ── TrialRow ──────────────────────────────────────────────────────────────────

function TrialRow({ trial, onOpen, onDelete, last }) {
  const [hovered, setHovered] = useState(false)
  const strainName = trial.strains?.name ?? '—'
  const hasCoA = Array.isArray(trial.trial_coa_links) && trial.trial_coa_links.length > 0

  return (
    <div
      onClick={() => onOpen(trial)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', gap: 12, alignItems: 'center',
        padding: '8px 0',
        borderBottom: last ? 'none' : '0.5px solid var(--border)',
        cursor: 'pointer',
        background: hovered ? 'rgba(255,255,255,0.02)' : 'transparent',
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
            onClick={e => { e.stopPropagation(); onDelete(trial.id) }}
            title="Delete trial"
            style={{ padding: '2px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#f87171', display: 'flex', alignItems: 'center' }}
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
  const [selectedTrial, setSelectedTrial]   = useState(null)
  const [activeTab, setActiveTab]           = useState('trials')
  const [analyticsData, setAnalyticsData]   = useState(null)
  const [analyticsError, setAnalyticsError] = useState(null)
  const analyticsLoaded = useRef(false)

  function handleTabSwitch(id) {
    setActiveTab(id)
    if (id === 'analytics' && !analyticsLoaded.current) {
      analyticsLoaded.current = true
      fetchTrialAnalyticsSummary()
        .then(setAnalyticsData)
        .catch(e => setAnalyticsError(e.message))
    }
  }

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

  if (selectedTrial) {
    return (
      <TrialDetail
        trial={selectedTrial}
        onBack={() => { setSelectedTrial(null); load() }}
      />
    )
  }

  const data = trials ?? []

  const filtered = useMemo(() => {
    let r = data
    if (filterStrain)             r = r.filter(t => t.strain_id === filterStrain)
    if (filterGrowType !== 'all') r = r.filter(t => t.grow_type === filterGrowType)
    return r
  }, [data, filterStrain, filterGrowType])

  const uniqueStrains   = new Set(data.map(t => t.strain_id).filter(Boolean)).size
  const uniqueLocations = new Set(data.map(t => t.location_name).filter(Boolean)).size
  const dryWeights      = data.map(t => t.dry_weight_g).filter(v => v != null)
  const avgDryWeight    = dryWeights.length > 0
    ? `${Math.round(dryWeights.reduce((s, v) => s + parseFloat(v), 0) / dryWeights.length).toLocaleString()}g`
    : '—'

  const hdr      = { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }
  const pillBase = { padding: '3px 10px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Trial Data</div>
        {activeTab === 'trials' && (
          <button
            onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '5px 12px', border: 'none', borderRadius: 6, background: '#4ade80', color: '#0a0a0a', cursor: 'pointer' }}
          >
            <Plus size={13} /> Register Trial
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid var(--border)', marginBottom: -4 }}>
        {[['trials', 'Trials'], ['analytics', 'Analytics']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => handleTabSwitch(id)}
            style={{
              padding: '6px 16px', fontSize: 12, border: 'none', background: 'transparent',
              cursor: 'pointer',
              color: activeTab === id ? 'var(--text)' : 'var(--text-3)',
              fontWeight: activeTab === id ? 500 : 400,
              borderBottom: `1.5px solid ${activeTab === id ? '#4ade80' : 'transparent'}`,
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Analytics tab */}
      {activeTab === 'analytics' && <TrialAnalytics data={analyticsData} error={analyticsError} />}

      {/* Trials tab */}
      {activeTab === 'trials' && (
        <>
          {actionError && (
            <div style={{ fontSize: 12, color: '#f87171' }}>{actionError}</div>
          )}

          {trials && trials.length > 0 && (
            <Grid cols={4} gap={8}>
              <StatCard label="Total Trials"   value={trials.length} />
              <StatCard label="Strains Tested" value={uniqueStrains} />
              <StatCard label="Locations"      value={uniqueLocations} />
              <StatCard label="Avg Dry Weight" value={avgDryWeight} />
            </Grid>
          )}

          {trials && trials.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={filterStrain}
                onChange={e => setFilterStrain(e.target.value)}
                style={{ padding: '4px 8px', fontSize: 11, borderRadius: 5, border: '0.5px solid var(--border)', background: 'var(--card)', color: 'var(--text)', outline: 'none', cursor: 'pointer' }}
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
                    onOpen={setSelectedTrial}
                    onDelete={handleDelete}
                    last={i === filtered.length - 1}
                  />
                ))
              )}
            </Panel>
          )}
        </>
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
