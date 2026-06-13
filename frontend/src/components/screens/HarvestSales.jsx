import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { Panel, Grid, StatCard, Badge } from '../ui'
import { fetchAllStrains, fetchHarvestSales, createHarvestSale, deleteHarvestSale } from '../../api'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtNum(v, decimals = 0) {
  if (v == null) return '—'
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: decimals })
}

// ── SaleForm ──────────────────────────────────────────────────────────────────

function SaleForm({ strains, onSaved }) {
  const EMPTY = {
    sale_date: '', strain_id: '', batch_code: '', quantity_grams: '',
    buyer_name: '', buyer_gacp_cert: '', price_thb: '', notes: '',
  }
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.sale_date)            { setError('Sale date is required'); return }
    if (!form.quantity_grams)       { setError('Quantity is required'); return }
    if (!form.buyer_name.trim())    { setError('Buyer name is required'); return }
    setSaving(true); setError('')
    try {
      await createHarvestSale({
        sale_date:       form.sale_date,
        strain_id:       form.strain_id      || null,
        batch_code:      form.batch_code     || null,
        quantity_grams:  parseFloat(form.quantity_grams),
        buyer_name:      form.buyer_name.trim(),
        buyer_gacp_cert: form.buyer_gacp_cert || null,
        price_thb:       form.price_thb ? parseFloat(form.price_thb) : null,
        notes:           form.notes          || null,
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
    <Panel title="Log Sale">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Row 1: Sale Date / Strain */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Sale Date *</label>
            <input style={inp} type="date" value={form.sale_date} onChange={e => set('sale_date', e.target.value)} required />
          </div>
          <div>
            <label style={lbl}>Strain</label>
            <select style={inp} value={form.strain_id} onChange={e => set('strain_id', e.target.value)}>
              <option value="">— Select strain —</option>
              {strains.map(s => <option key={s.strain_id} value={s.strain_id}>{s.strain}</option>)}
            </select>
          </div>
        </div>

        {/* Row 2: Batch Code / Quantity */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Batch Code</label>
            <input style={inp} value={form.batch_code} onChange={e => set('batch_code', e.target.value)} placeholder="e.g. BATCH-2024-001" />
          </div>
          <div>
            <label style={lbl}>Quantity (grams) *</label>
            <input style={inp} type="number" min="0.01" step="0.01" value={form.quantity_grams} onChange={e => set('quantity_grams', e.target.value)} placeholder="e.g. 500" required />
          </div>
        </div>

        {/* Row 3: Buyer Name / Buyer GACP Cert */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Buyer Name *</label>
            <input style={inp} value={form.buyer_name} onChange={e => set('buyer_name', e.target.value)} placeholder="Company or individual" required />
          </div>
          <div>
            <label style={lbl}>Buyer GACP Cert</label>
            <input style={inp} value={form.buyer_gacp_cert} onChange={e => set('buyer_gacp_cert', e.target.value)} placeholder="Certificate number" />
          </div>
        </div>

        {/* Row 4: Price THB */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Price (THB)</label>
            <input style={inp} type="number" min="0" step="0.01" value={form.price_thb} onChange={e => set('price_thb', e.target.value)} placeholder="e.g. 25000" />
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
            {saving ? 'Saving…' : 'Log Sale'}
          </button>
        </div>
      </form>
    </Panel>
  )
}

// ── SaleRow ───────────────────────────────────────────────────────────────────

function SaleRow({ record, onDelete, last }) {
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
        {fmtDate(record.sale_date)}
      </span>
      <span style={{ width: 110, fontSize: 12, color: 'var(--text)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.strains?.name ?? <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span style={{ width: 110, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
        {record.batch_code ?? <span style={{ color: 'var(--text-3)', fontFamily: 'inherit' }}>—</span>}
      </span>
      <span style={{ width: 80, fontSize: 12, color: 'var(--text)', flexShrink: 0, textAlign: 'right' }}>
        {fmtNum(record.quantity_grams, 2)} g
      </span>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {record.buyer_name ?? '—'}
      </span>
      <span style={{ width: 110, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.buyer_gacp_cert ?? <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span style={{ width: 90, fontSize: 12, color: 'var(--text)', flexShrink: 0, textAlign: 'right' }}>
        {record.price_thb != null ? `฿${fmtNum(record.price_thb, 2)}` : <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span title={record.notes ?? undefined} style={{ width: 100, fontSize: 11, color: 'var(--text-3)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

// ── HarvestSales ──────────────────────────────────────────────────────────────

export default function HarvestSales() {
  const [sales,       setSales]       = useState(null)
  const [strains,     setStrains]     = useState([])
  const [actionError, setActionError] = useState(null)

  async function loadSales() {
    try {
      const data = await fetchHarvestSales()
      setSales(data)
    } catch {
      setSales([])
    }
  }

  useEffect(() => {
    loadSales()
    fetchAllStrains().then(setStrains).catch(() => {})
  }, [])

  async function handleDelete(id) {
    if (!window.confirm('Delete this sale record? This cannot be undone.')) return
    setActionError(null)
    try {
      await deleteHarvestSale(id)
      setSales(prev => prev ? prev.filter(s => s.id !== id) : prev)
    } catch (err) {
      setActionError(`Delete failed: ${err.message}`)
    }
  }

  const hdr = { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }

  const data       = sales ?? []
  const totalGrams = data.reduce((sum, r) => sum + (r.quantity_grams ?? 0), 0)
  const totalRev   = data.reduce((sum, r) => sum + (r.price_thb ?? 0), 0)
  const buyers     = new Set(data.map(r => r.buyer_name).filter(Boolean)).size

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <SaleForm strains={strains} onSaved={loadSales} />

      {actionError && (
        <div style={{ fontSize: 12, color: '#f87171' }}>{actionError}</div>
      )}

      {sales && sales.length > 0 && (
        <Grid cols={4} gap={8}>
          <StatCard label="Total Sales"       value={data.length} />
          <StatCard label="Total Grams Sold"  value={`${fmtNum(totalGrams, 2)} g`} />
          <StatCard label="Total Revenue"     value={`฿${fmtNum(totalRev, 2)}`} />
          <StatCard label="Unique Buyers"     value={buyers} />
        </Grid>
      )}

      {sales === null ? (
        <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '32px', textAlign: 'center' }}>Loading…</div>
      ) : data.length === 0 ? (
        <Panel>
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            No sales recorded yet. Use the form above to log one.
          </div>
        </Panel>
      ) : (
        <Panel fullWidth>
          <div style={{ display: 'flex', gap: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--border)', marginBottom: 2 }}>
            <span style={{ ...hdr, width: 90 }}>Date</span>
            <span style={{ ...hdr, width: 110 }}>Strain</span>
            <span style={{ ...hdr, width: 110 }}>Batch Code</span>
            <span style={{ ...hdr, width: 80, textAlign: 'right' }}>Qty (g)</span>
            <span style={{ ...hdr, flex: 1 }}>Buyer</span>
            <span style={{ ...hdr, width: 110 }}>GACP Cert</span>
            <span style={{ ...hdr, width: 90, textAlign: 'right' }}>Price (THB)</span>
            <span style={{ ...hdr, width: 100 }}>Notes</span>
            <span style={{ ...hdr, width: 28 }} />
          </div>
          {data.map((r, i) => (
            <SaleRow
              key={r.id}
              record={r}
              onDelete={handleDelete}
              last={i === data.length - 1}
            />
          ))}
        </Panel>
      )}
    </div>
  )
}
