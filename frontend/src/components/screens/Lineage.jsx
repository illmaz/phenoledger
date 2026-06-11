import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { Badge } from '../ui'
import { fetchStrains, fetchLineage, fetchStrainBatches, createPropagation } from '../../api'

const HEALTH_VARIANT = { healthy: 'ok', watch: 'warn', sick: 'danger' }
const HLVD_VARIANT   = { negative: 'ok', positive: 'danger', pending: 'gray' }

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function DataRow({ label, value, title: titleProp }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11 }}>
      <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>{label}</span>
      <span title={titleProp} style={{ color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  )
}

function Connector() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', height: 24 }}>
      <div style={{ width: 1, background: 'var(--border)' }} />
    </div>
  )
}

function SectionLabel({ text, count }) {
  return (
    <div style={{
      fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
      color: 'var(--text-3)', marginBottom: 10, textAlign: 'center',
    }}>
      {text} ({count})
    </div>
  )
}

// ── Propagation Modal ─────────────────────────────────────────────────────────

function PropagationModal({ plant, strainName, onClose, onSaved }) {
  const [form, setForm] = useState({
    propagation_date: '', clones_taken: '',
    grow_type: 'indoor', report_id: '', notes: '',
  })
  const [batches, setBatches] = useState([])
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    fetchStrainBatches(strainName).then(setBatches).catch(() => {})
  }, [strainName])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.propagation_date) { setError('Propagation date is required'); return }
    const clones = parseInt(form.clones_taken, 10)
    if (!form.clones_taken || clones < 1) { setError('Clones taken must be at least 1'); return }
    setSaving(true); setError('')
    try {
      await createPropagation({
        mother_plant_id:  plant.id,
        propagation_date: form.propagation_date,
        clones_taken:     clones,
        grow_type:        form.grow_type   || null,
        report_id:        form.report_id   || null,
        notes:            form.notes       || null,
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
          padding: '28px 28px 24px', width: 420, maxWidth: '92vw', maxHeight: '90vh',
          overflowY: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Record Propagation</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, fontFamily: 'monospace' }}>{plant.plant_code}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex' }}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Propagation Date *</label>
              <input style={inp} type="date" value={form.propagation_date} onChange={e => set('propagation_date', e.target.value)} required />
            </div>
            <div>
              <label style={lbl}>Clones Taken *</label>
              <input style={inp} type="number" min="1" value={form.clones_taken} onChange={e => set('clones_taken', e.target.value)} placeholder="20" required />
            </div>
          </div>

          <div>
            <label style={lbl}>Grow Type</label>
            <select style={inp} value={form.grow_type} onChange={e => set('grow_type', e.target.value)}>
              <option value="indoor">Indoor</option>
              <option value="outdoor">Outdoor</option>
              <option value="greenhouse">Greenhouse</option>
            </select>
          </div>

          <div>
            <label style={lbl}>Link to COA Batch</label>
            <select style={inp} value={form.report_id} onChange={e => set('report_id', e.target.value)}>
              <option value="">— None —</option>
              {batches.map(b => (
                <option key={b.report_id} value={b.report_id}>
                  {fmtDate(b.date)} · #{b.report_id.slice(0, 8).toUpperCase()}
                  {b.thca != null ? ` · THCA ${b.thca}%` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={lbl}>Notes</label>
            <textarea
              style={{ ...inp, resize: 'vertical', minHeight: 60, fontFamily: 'inherit' }}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              maxLength={500}
              placeholder="Optional notes…"
            />
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
              {saving ? 'Saving…' : 'Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Seed Lot Card ─────────────────────────────────────────────────────────────

function SeedLotCard({ lot }) {
  return (
    <div style={{
      background: 'var(--card)', border: '0.5px solid var(--border)',
      borderRadius: 8, padding: '12px 16px', minWidth: 176, maxWidth: 220,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{
          fontSize: 9, background: 'rgba(96,165,250,0.15)', color: '#60a5fa',
          padding: '1px 5px', borderRadius: 3, fontWeight: 600, flexShrink: 0,
        }}>SEED</span>
        <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lot.lot_code ?? lot.id?.slice(0, 8).toUpperCase()}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {lot.origin_country       && <DataRow label="Origin"  value={lot.origin_country} />}
        {lot.import_permit_number && <DataRow label="Permit"  value={lot.import_permit_number} title={lot.import_permit_number} />}
        {lot.germination_rate != null && (
          <DataRow label="Germ." value={`${parseFloat(lot.germination_rate).toFixed(1)}%`} />
        )}
        {lot.quantity_seeds != null && (
          <DataRow label="Seeds" value={lot.quantity_seeds.toLocaleString()} />
        )}
        {lot.arrival_date && <DataRow label="Arrived" value={fmtDate(lot.arrival_date)} />}
      </div>
    </div>
  )
}

// ── Propagation Row ───────────────────────────────────────────────────────────

function PropagationRow({ prop }) {
  const coa = prop.coa_reports

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)', borderRadius: 5,
      padding: '7px 10px', border: '0.5px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'monospace', flexShrink: 0 }}>
          {fmtDate(prop.propagation_date)}
        </span>
        {prop.clones_taken != null && (
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {prop.clones_taken} clone{prop.clones_taken !== 1 ? 's' : ''}
          </span>
        )}
        {prop.grow_type && (
          <span style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 3,
            background: 'rgba(255,255,255,0.06)', color: 'var(--text-3)', textTransform: 'capitalize',
          }}>
            {prop.grow_type}
          </span>
        )}
      </div>
      {coa && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, paddingLeft: 2 }}>
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>→</span>
          <span style={{ fontSize: 11, color: '#60a5fa' }}>{coa.sample_name ?? 'COA'}</span>
          {coa.report_date && (
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{fmtDate(coa.report_date)}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Mother Plant Block ────────────────────────────────────────────────────────

function MotherPlantBlock({ mp, onRecord }) {
  const propagations = mp.propagations ?? []

  return (
    <div style={{
      background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 8,
      padding: '14px 16px',
    }}>
      {/* Plant header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
            {mp.plant_code}
          </div>
          {mp.clone_generation != null && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
              Generation {mp.clone_generation}
            </div>
          )}
          {mp.established_date && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
              Est. {fmtDate(mp.established_date)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <Badge variant={HEALTH_VARIANT[mp.health_status] ?? 'gray'}>
            {mp.health_status ?? '—'}
          </Badge>
          {mp.hlvd_tested && (
            <Badge variant={HLVD_VARIANT[mp.hlvd_result] ?? 'gray'}>
              {mp.hlvd_result ?? 'pending'}
            </Badge>
          )}
        </div>
      </div>

      {/* Propagations */}
      <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>
            {propagations.length > 0 ? `Propagations (${propagations.length})` : 'Propagations'}
          </div>
          <button
            onClick={() => onRecord(mp)}
            style={{
              display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600,
              padding: '3px 8px', border: '0.5px solid var(--border)', borderRadius: 4,
              background: 'transparent', color: 'var(--text-2)', cursor: 'pointer',
            }}
          >
            <Plus size={10} /> Record
          </button>
        </div>
        {propagations.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {propagations.map((p, i) => (
              <PropagationRow key={p.id ?? i} prop={p} />
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            No propagations recorded.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Lineage ───────────────────────────────────────────────────────────────────

export default function Lineage() {
  const [strains, setStrains]             = useState([])
  const [selectedStrain, setSelected]     = useState('')
  const [lineage, setLineage]             = useState(null)
  const [loading, setLoading]             = useState(false)
  const [recordingPlant, setRecordingPlant] = useState(null)

  useEffect(() => {
    fetchStrains().then(setStrains).catch(() => {})
  }, [])

  function loadLineage(strain) {
    if (!strain) { setLineage(null); return }
    setLoading(true)
    fetchLineage(strain)
      .then(data => { setLineage(data); setLoading(false) })
      .catch(() => { setLineage({ seed_lots: [], mother_plants: [] }); setLoading(false) })
  }

  useEffect(() => {
    loadLineage(selectedStrain)
  }, [selectedStrain])

  const hasMotherPlants = (lineage?.mother_plants?.length ?? 0) > 0
  const hasSeedLots     = (lineage?.seed_lots?.length ?? 0) > 0
  const hasData         = hasMotherPlants || hasSeedLots

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Strain selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>Strain</span>
        <select
          value={selectedStrain}
          onChange={e => setSelected(e.target.value)}
          style={{
            fontSize: 12, padding: '5px 10px', border: '0.5px solid var(--border)', borderRadius: 6,
            background: 'var(--card)', color: 'var(--text)', outline: 'none', minWidth: 240,
          }}
        >
          <option value="">— Select a strain —</option>
          {strains.map(s => <option key={s.strain} value={s.strain}>{s.strain}</option>)}
        </select>
      </div>

      {/* No strain selected */}
      {!selectedStrain && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: 260, fontSize: 12, color: 'var(--text-3)',
        }}>
          Select a strain above to view its genetic lineage.
        </div>
      )}

      {/* Loading */}
      {selectedStrain && loading && (
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-3)', padding: '40px 0' }}>
          Loading…
        </div>
      )}

      {/* Empty state */}
      {selectedStrain && !loading && lineage && !hasData && (
        <div style={{
          background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 8,
          padding: '40px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>
            No lineage data for <span style={{ color: '#4ade80' }}>{selectedStrain}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>
            Register a seed lot in <strong>Seed Lots</strong> or a mother plant in <strong>Mother Plants</strong>,
            <br />then link it to this strain to start building the tree.
          </div>
        </div>
      )}

      {/* Tree */}
      {selectedStrain && !loading && hasData && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

          {/* Root strain */}
          <div style={{
            background: 'rgba(74,222,128,0.08)', border: '0.5px solid rgba(74,222,128,0.3)',
            borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, color: '#4ade80',
          }}>
            {selectedStrain}
          </div>

          {/* Seed lots */}
          {hasSeedLots && (
            <>
              <Connector />
              <div style={{ width: '100%', maxWidth: 800 }}>
                <SectionLabel text="Seed Lots" count={lineage.seed_lots.length} />
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {lineage.seed_lots.map(lot => <SeedLotCard key={lot.id} lot={lot} />)}
                </div>
              </div>
            </>
          )}

          {/* Mother plants */}
          {hasMotherPlants && (
            <>
              <Connector />
              <div style={{ width: '100%', maxWidth: 800 }}>
                <SectionLabel text="Mother Plants" count={lineage.mother_plants.length} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {lineage.mother_plants.map(mp => (
                    <MotherPlantBlock
                      key={mp.id}
                      mp={mp}
                      onRecord={setRecordingPlant}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Propagation modal */}
      {recordingPlant && (
        <PropagationModal
          plant={recordingPlant}
          strainName={selectedStrain}
          onClose={() => setRecordingPlant(null)}
          onSaved={() => {
            setRecordingPlant(null)
            loadLineage(selectedStrain)
          }}
        />
      )}
    </div>
  )
}
