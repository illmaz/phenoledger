import { useState, useEffect } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Panel, Badge, Grid, StatCard } from '../ui'
import { fetchMotherPlants, createMotherPlant, deleteMotherPlant, fetchStrains } from '../../api'

const HEALTH_VARIANT = { healthy: 'ok', watch: 'warn', sick: 'danger' }
const HLVD_VARIANT   = { negative: 'ok', positive: 'danger', pending: 'gray' }

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── RegisterModal ─────────────────────────────────────────────────────────────

function RegisterModal({ strains, onClose, onSaved }) {
  const [form, setForm] = useState({
    plant_code: '', strain_name: '', established_date: '',
    clone_generation: '', health_status: 'healthy',
    hlvd_tested: false, hlvd_result: 'pending',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.plant_code.trim()) { setError('Plant code is required'); return }
    setSaving(true); setError('')
    try {
      await createMotherPlant({
        ...form,
        clone_generation: form.clone_generation ? parseInt(form.clone_generation, 10) : null,
        strain_name: form.strain_name || null,
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
  const lbl = { fontSize: 11, color: 'var(--text-2)', display: 'block', marginBottom: 4 }

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
          padding: '28px 28px 24px', width: 440, maxWidth: '92vw',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Register Mother Plant</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex' }}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Plant Code *</label>
              <input style={inp} value={form.plant_code} onChange={e => set('plant_code', e.target.value)} placeholder="MP-001" required />
            </div>
            <div>
              <label style={lbl}>Clone Generation</label>
              <input style={inp} type="number" min="0" value={form.clone_generation} onChange={e => set('clone_generation', e.target.value)} placeholder="1" />
            </div>
          </div>

          <div>
            <label style={lbl}>Strain</label>
            <select style={inp} value={form.strain_name} onChange={e => set('strain_name', e.target.value)}>
              <option value="">— Select strain —</option>
              {strains.map(s => <option key={s.strain} value={s.strain}>{s.strain}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Established Date</label>
              <input style={inp} type="date" value={form.established_date} onChange={e => set('established_date', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Health Status</label>
              <select style={inp} value={form.health_status} onChange={e => set('health_status', e.target.value)}>
                <option value="healthy">Healthy</option>
                <option value="watch">Watch</option>
                <option value="sick">Sick</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
              <input
                type="checkbox" id="hlvd_tested"
                checked={form.hlvd_tested}
                onChange={e => set('hlvd_tested', e.target.checked)}
              />
              <label htmlFor="hlvd_tested" style={{ ...lbl, marginBottom: 0, cursor: 'pointer' }}>HLVd Tested</label>
            </div>
            <div>
              <label style={lbl}>HLVd Result</label>
              <select style={inp} value={form.hlvd_result} onChange={e => set('hlvd_result', e.target.value)}>
                <option value="pending">Pending</option>
                <option value="negative">Negative</option>
                <option value="positive">Positive</option>
              </select>
            </div>
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

// ── PlantRow ──────────────────────────────────────────────────────────────────

function PlantRow({ plant, onDelete, last }) {
  const [hovered, setHovered] = useState(false)
  const strainName = plant.strains?.name ?? plant.strain_name ?? '—'

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
      <span style={{ width: 100, fontFamily: 'monospace', fontSize: 11, color: 'var(--text)', flexShrink: 0 }}>
        {plant.plant_code ?? '—'}
      </span>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-2)' }}>{strainName}</span>
      <span style={{ width: 110, fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {fmtDate(plant.established_date)}
      </span>
      <span style={{ width: 52, textAlign: 'right', fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {plant.clone_generation != null ? `G${plant.clone_generation}` : '—'}
      </span>
      <div style={{ width: 90, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
        <Badge variant={HEALTH_VARIANT[plant.health_status] ?? 'gray'}>
          {plant.health_status ?? '—'}
        </Badge>
      </div>
      <div style={{ width: 90, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
        {plant.hlvd_tested ? (
          <Badge variant={HLVD_VARIANT[plant.hlvd_result] ?? 'gray'}>
            {plant.hlvd_result ?? 'pending'}
          </Badge>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Not tested</span>
        )}
      </div>
      <div style={{ width: 28, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        {hovered && (
          <button
            onClick={() => onDelete(plant.id, plant.plant_code)}
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

// ── MotherPlants ──────────────────────────────────────────────────────────────

export default function MotherPlants() {
  const [plants, setPlants]       = useState(null)
  const [strains, setStrains]     = useState([])
  const [showModal, setShowModal] = useState(false)

  function load() {
    fetchMotherPlants().then(setPlants).catch(() => setPlants([]))
  }

  useEffect(() => {
    load()
    fetchStrains().then(setStrains).catch(() => {})
  }, [])

  async function handleDelete(id, code) {
    if (!window.confirm(`Delete mother plant "${code}"? This cannot be undone.`)) return
    try {
      await deleteMotherPlant(id)
      setPlants(prev => prev ? prev.filter(p => p.id !== id) : prev)
    } catch { /* silent */ }
  }

  const hdr = { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }

  const healthy      = plants ? plants.filter(p => p.health_status === 'healthy').length : 0
  const watching     = plants ? plants.filter(p => p.health_status === 'watch').length : 0
  const hlvdPositive = plants ? plants.filter(p => p.hlvd_result === 'positive').length : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Mother Plant Registry</div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 600, padding: '5px 12px',
            border: 'none', borderRadius: 6, background: '#4ade80', color: '#0a0a0a', cursor: 'pointer',
          }}
        >
          <Plus size={13} /> Register Plant
        </button>
      </div>

      {/* Stats */}
      {plants && plants.length > 0 && (
        <Grid cols={4} gap={8}>
          <StatCard label="Total Plants"  value={plants.length} />
          <StatCard label="Healthy"       value={healthy} />
          <StatCard label="Watch"         value={watching} />
          <StatCard label="HLVd Positive" value={hlvdPositive} />
        </Grid>
      )}

      {/* Table */}
      {plants === null ? (
        <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '32px', textAlign: 'center' }}>Loading…</div>
      ) : plants.length === 0 ? (
        <Panel>
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            No mother plants registered yet. Click <strong>Register Plant</strong> to add one.
          </div>
        </Panel>
      ) : (
        <Panel fullWidth>
          <div style={{ display: 'flex', gap: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--border)', marginBottom: 2 }}>
            <span style={{ ...hdr, width: 100 }}>Plant Code</span>
            <span style={{ ...hdr, flex: 1 }}>Strain</span>
            <span style={{ ...hdr, width: 110 }}>Established</span>
            <span style={{ ...hdr, width: 52, textAlign: 'right' }}>Gen.</span>
            <span style={{ ...hdr, width: 90, textAlign: 'right' }}>Health</span>
            <span style={{ ...hdr, width: 90, textAlign: 'right' }}>HLVd</span>
            <span style={{ ...hdr, width: 28 }} />
          </div>
          {plants.map((p, i) => (
            <PlantRow
              key={p.id}
              plant={p}
              onDelete={handleDelete}
              last={i === plants.length - 1}
            />
          ))}
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
