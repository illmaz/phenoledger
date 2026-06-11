import { useState, useEffect } from 'react'
import { Plus, Trash2, Pencil, X } from 'lucide-react'
import { Panel, Badge, Grid, StatCard } from '../ui'
import CountrySelect from '../CountrySelect'
import { fetchSeedLots, createSeedLot, updateSeedLot, deleteSeedLot, fetchStrains } from '../../api'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtGerm(rate) {
  if (rate == null) return '—'
  return `${parseFloat(rate).toFixed(1)}%`
}

function truncate(str, max = 14) {
  if (!str) return '—'
  return str.length > max ? str.slice(0, max) + '…' : str
}

// ── RegisterModal ─────────────────────────────────────────────────────────────

function RegisterModal({ strains, onClose, onSaved }) {
  const [form, setForm] = useState({
    lot_code: '', strain_id: '', origin_country: '',
    import_permit_number: '', phytosanitary_cert_number: '',
    germination_rate: '', quantity_seeds: '', arrival_date: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.lot_code.trim()) { setError('Lot code is required'); return }
    setSaving(true); setError('')
    try {
      await createSeedLot({
        lot_code:                  form.lot_code.trim(),
        strain_id:                 form.strain_id                 || null,
        origin_country:            form.origin_country            || null,
        import_permit_number:      form.import_permit_number      || null,
        phytosanitary_cert_number: form.phytosanitary_cert_number || null,
        germination_rate:          form.germination_rate  ? parseFloat(form.germination_rate)    : null,
        quantity_seeds:            form.quantity_seeds    ? parseInt(form.quantity_seeds, 10)    : null,
        arrival_date:              form.arrival_date               || null,
        notes:                     form.notes                      || null,
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
          padding: '28px 28px 24px', width: 460, maxWidth: '92vw', maxHeight: '90vh',
          overflowY: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Register Seed Lot</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex' }}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Lot Code *</label>
              <input style={inp} value={form.lot_code} onChange={e => set('lot_code', e.target.value)} placeholder="SL-001" required />
            </div>
            <div>
              <label style={lbl}>Arrival Date</label>
              <input style={inp} type="date" value={form.arrival_date} onChange={e => set('arrival_date', e.target.value)} />
            </div>
          </div>

          <div>
            <label style={lbl}>Strain</label>
            <select style={inp} value={form.strain_id} onChange={e => set('strain_id', e.target.value)}>
              <option value="">— Select strain —</option>
              {strains.map(s => <option key={s.strain_id} value={s.strain_id}>{s.strain}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Origin Country</label>
              <CountrySelect
                value={form.origin_country}
                onChange={v => set('origin_country', v)}
                inputStyle={inp}
              />
            </div>
            <div>
              <label style={lbl}>Quantity of Seeds</label>
              <input style={inp} type="number" min="0" value={form.quantity_seeds} onChange={e => set('quantity_seeds', e.target.value)} placeholder="500" />
            </div>
          </div>

          <div>
            <label style={lbl}>Import Permit Number</label>
            <input style={inp} value={form.import_permit_number} onChange={e => set('import_permit_number', e.target.value)} placeholder="IP-2024-XXXX" />
          </div>

          <div>
            <label style={lbl}>Phytosanitary Certificate Number</label>
            <input style={inp} value={form.phytosanitary_cert_number} onChange={e => set('phytosanitary_cert_number', e.target.value)} placeholder="PC-2024-XXXX" />
          </div>

          <div>
            <label style={lbl}>Germination Rate (%)</label>
            <input
              style={inp} type="number" min="0" max="100" step="0.1"
              value={form.germination_rate}
              onChange={e => set('germination_rate', e.target.value)}
              placeholder="85.0"
            />
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

// ── EditModal ─────────────────────────────────────────────────────────────────

function EditModal({ lot, onClose, onSaved }) {
  const [form, setForm] = useState({
    origin_country:            lot.origin_country            ?? '',
    import_permit_number:      lot.import_permit_number      ?? '',
    phytosanitary_cert_number: lot.phytosanitary_cert_number ?? '',
    germination_rate:          lot.germination_rate != null ? String(lot.germination_rate) : '',
    quantity_seeds:            lot.quantity_seeds   != null ? String(lot.quantity_seeds)   : '',
    arrival_date:              lot.arrival_date ? lot.arrival_date.split('T')[0] : '',
    notes:                     lot.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      await updateSeedLot(lot.id, {
        origin_country:            form.origin_country            || null,
        import_permit_number:      form.import_permit_number      || null,
        phytosanitary_cert_number: form.phytosanitary_cert_number || null,
        germination_rate:          form.germination_rate  ? parseFloat(form.germination_rate)  : null,
        quantity_seeds:            form.quantity_seeds    ? parseInt(form.quantity_seeds, 10)  : null,
        arrival_date:              form.arrival_date               || null,
        notes:                     form.notes                      || null,
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
          padding: '28px 28px 24px', width: 460, maxWidth: '92vw', maxHeight: '90vh',
          overflowY: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Edit Seed Lot</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, fontFamily: 'monospace' }}>{lot.lot_code}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex' }}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Origin Country</label>
              <CountrySelect
                value={form.origin_country}
                onChange={v => set('origin_country', v)}
                inputStyle={inp}
              />
            </div>
            <div>
              <label style={lbl}>Arrival Date</label>
              <input style={inp} type="date" value={form.arrival_date} onChange={e => set('arrival_date', e.target.value)} />
            </div>
          </div>

          <div>
            <label style={lbl}>Import Permit Number</label>
            <input style={inp} value={form.import_permit_number} onChange={e => set('import_permit_number', e.target.value)} placeholder="IP-2024-XXXX" />
          </div>

          <div>
            <label style={lbl}>Phytosanitary Certificate Number</label>
            <input style={inp} value={form.phytosanitary_cert_number} onChange={e => set('phytosanitary_cert_number', e.target.value)} placeholder="PC-2024-XXXX" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Germination Rate (%)</label>
              <input
                style={inp} type="number" min="0" max="100" step="0.1"
                value={form.germination_rate}
                onChange={e => set('germination_rate', e.target.value)}
                placeholder="85.0"
              />
            </div>
            <div>
              <label style={lbl}>Quantity of Seeds</label>
              <input style={inp} type="number" min="0" value={form.quantity_seeds} onChange={e => set('quantity_seeds', e.target.value)} placeholder="500" />
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
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── LotRow ────────────────────────────────────────────────────────────────────

function LotRow({ lot, onEdit, onDelete, last }) {
  const [hovered, setHovered] = useState(false)
  const strainName = lot.strains?.name ?? '—'

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
      <span style={{ width: 90, fontFamily: 'monospace', fontSize: 11, color: 'var(--text)', flexShrink: 0 }}>
        {lot.lot_code ?? '—'}
      </span>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {strainName}
      </span>
      <span style={{ width: 80, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {lot.origin_country ?? '—'}
      </span>
      <span
        title={lot.import_permit_number ?? undefined}
        style={{ width: 100, fontSize: 11, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {lot.import_permit_number ? truncate(lot.import_permit_number) : <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span
        title={lot.phytosanitary_cert_number ?? undefined}
        style={{ width: 90, fontSize: 11, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {lot.phytosanitary_cert_number ? (
          <Badge variant="ok">✓</Badge>
        ) : (
          <span style={{ color: 'var(--text-3)' }}>—</span>
        )}
      </span>
      <span style={{ width: 52, textAlign: 'right', fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {lot.quantity_seeds != null ? lot.quantity_seeds.toLocaleString() : '—'}
      </span>
      <span style={{ width: 68, textAlign: 'right', fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {fmtGerm(lot.germination_rate)}
      </span>
      <span style={{ width: 80, fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {fmtDate(lot.arrival_date)}
      </span>
      <div style={{ width: 52, display: 'flex', justifyContent: 'flex-end', gap: 2, flexShrink: 0 }}>
        {hovered && (
          <button
            onClick={() => onEdit(lot)}
            title="Edit"
            style={{
              padding: '2px 4px', border: 'none', background: 'transparent',
              cursor: 'pointer', color: '#60a5fa', display: 'flex', alignItems: 'center',
            }}
          >
            <Pencil size={11} />
          </button>
        )}
        {hovered && (
          <button
            onClick={() => onDelete(lot.id, lot.lot_code)}
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

// ── SeedLots ──────────────────────────────────────────────────────────────────

export default function SeedLots() {
  const [lots, setLots]               = useState(null)
  const [strains, setStrains]         = useState([])
  const [showModal, setShowModal]     = useState(false)
  const [editingLot, setEditingLot]   = useState(null)
  const [actionError, setActionError] = useState(null)

  function load() {
    fetchSeedLots().then(setLots).catch(() => setLots([]))
  }

  useEffect(() => {
    load()
    fetchStrains().then(setStrains).catch(() => {})
  }, [])

  async function handleDelete(id, code) {
    if (!window.confirm(`Delete seed lot "${code}"? This cannot be undone.`)) return
    setActionError(null)
    try {
      await deleteSeedLot(id)
      setLots(prev => prev ? prev.filter(l => l.id !== id) : prev)
    } catch (err) {
      setActionError(`Failed to delete "${code}": ${err.message}`)
    }
  }

  const hdr = { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }

  const data = lots ?? []
  const countries   = new Set(data.map(l => l.origin_country).filter(Boolean)).size
  const permitsOnFile = data.filter(l => l.import_permit_number).length
  const germRates   = data.map(l => l.germination_rate).filter(v => v != null)
  const avgGerm     = germRates.length > 0
    ? (germRates.reduce((s, v) => s + parseFloat(v), 0) / germRates.length).toFixed(1) + '%'
    : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Seed Lot Registry</div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 600, padding: '5px 12px',
            border: 'none', borderRadius: 6, background: '#4ade80', color: '#0a0a0a', cursor: 'pointer',
          }}
        >
          <Plus size={13} /> Register Lot
        </button>
      </div>

      {actionError && (
        <div style={{ fontSize: 12, color: '#f87171' }}>{actionError}</div>
      )}

      {/* Stats */}
      {lots && lots.length > 0 && (
        <Grid cols={4} gap={8}>
          <StatCard label="Total Lots"       value={lots.length} />
          <StatCard label="Countries"        value={countries} />
          <StatCard label="Permits on File"  value={permitsOnFile} />
          <StatCard label="Avg Germination"  value={avgGerm} />
        </Grid>
      )}

      {/* Table */}
      {lots === null ? (
        <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '32px', textAlign: 'center' }}>Loading…</div>
      ) : lots.length === 0 ? (
        <Panel>
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            No seed lots registered yet. Click <strong>Register Lot</strong> to add one.
          </div>
        </Panel>
      ) : (
        <Panel fullWidth>
          <div style={{ display: 'flex', gap: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--border)', marginBottom: 2 }}>
            <span style={{ ...hdr, width: 90 }}>Lot Code</span>
            <span style={{ ...hdr, flex: 1 }}>Strain</span>
            <span style={{ ...hdr, width: 80 }}>Origin</span>
            <span style={{ ...hdr, width: 100 }}>Import Permit</span>
            <span style={{ ...hdr, width: 90 }}>Phyto Cert</span>
            <span style={{ ...hdr, width: 52, textAlign: 'right' }}>Qty</span>
            <span style={{ ...hdr, width: 68, textAlign: 'right' }}>Germ.</span>
            <span style={{ ...hdr, width: 80 }}>Arrival</span>
            <span style={{ ...hdr, width: 52 }} />
          </div>
          {lots.map((l, i) => (
            <LotRow
              key={l.id}
              lot={l}
              onEdit={setEditingLot}
              onDelete={handleDelete}
              last={i === lots.length - 1}
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

      {editingLot && (
        <EditModal
          lot={editingLot}
          onClose={() => setEditingLot(null)}
          onSaved={() => { setEditingLot(null); load() }}
        />
      )}
    </div>
  )
}
