import { useState, useEffect } from 'react'
import { Badge } from '../ui'
import { fetchStrains, fetchLineage } from '../../api'

const HEALTH_VARIANT = { healthy: 'ok', watch: 'warn', sick: 'danger' }
const HLVD_VARIANT   = { negative: 'ok', positive: 'danger', pending: 'gray' }

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Node cards ────────────────────────────────────────────────────────────────

function MotherPlantCard({ mp }) {
  return (
    <div style={{
      background: 'var(--card)', border: '0.5px solid var(--border)',
      borderRadius: 8, padding: '12px 16px', minWidth: 176, maxWidth: 220,
    }}>
      <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
        {mp.plant_code}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <Row label="Established" value={fmtDate(mp.established_date)} />
        <Row label="Generation"  value={mp.clone_generation != null ? `G${mp.clone_generation}` : '—'} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Health</span>
          <Badge variant={HEALTH_VARIANT[mp.health_status] ?? 'gray'}>{mp.health_status ?? '—'}</Badge>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>HLVd</span>
          {mp.hlvd_tested ? (
            <Badge variant={HLVD_VARIANT[mp.hlvd_result] ?? 'gray'}>{mp.hlvd_result ?? 'pending'}</Badge>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Not tested</span>
          )}
        </div>
      </div>
    </div>
  )
}

function SeedLotCard({ lot }) {
  return (
    <div style={{
      background: 'var(--card)', border: '0.5px solid var(--border)',
      borderRadius: 8, padding: '12px 16px', minWidth: 176, maxWidth: 220,
    }}>
      <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
        {lot.lot_code ?? lot.id?.slice(0, 8).toUpperCase()}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {lot.supplier   && <Row label="Supplier"  value={lot.supplier} />}
        {lot.date_received && <Row label="Received" value={fmtDate(lot.date_received)} />}
        {lot.seed_count != null && <Row label="Seeds" value={lot.seed_count} />}
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
      <span style={{ color: 'var(--text-3)' }}>{label}</span>
      <span style={{ color: 'var(--text-2)' }}>{value}</span>
    </div>
  )
}

function Connector() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', height: 20 }}>
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

// ── Lineage ───────────────────────────────────────────────────────────────────

export default function Lineage() {
  const [strains, setStrains]           = useState([])
  const [selectedStrain, setSelected]   = useState('')
  const [lineage, setLineage]           = useState(null)
  const [loading, setLoading]           = useState(false)

  useEffect(() => {
    fetchStrains().then(setStrains).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedStrain) { setLineage(null); return }
    setLoading(true)
    fetchLineage(selectedStrain)
      .then(data => { setLineage(data); setLoading(false) })
      .catch(() => { setLineage({ seed_lots: [], mother_plants: [] }); setLoading(false) })
  }, [selectedStrain])

  const hasMotherPlants = lineage?.mother_plants?.length > 0
  const hasSeedLots     = lineage?.seed_lots?.length > 0
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

      {/* States */}
      {!selectedStrain && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: 260, fontSize: 12, color: 'var(--text-3)',
        }}>
          Select a strain above to view its genetic lineage.
        </div>
      )}

      {selectedStrain && loading && (
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-3)', padding: '40px 0' }}>Loading…</div>
      )}

      {selectedStrain && !loading && lineage && !hasData && (
        <div style={{
          background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 8,
          padding: '40px', textAlign: 'center', fontSize: 12, color: 'var(--text-3)',
        }}>
          No lineage data on file for <span style={{ color: 'var(--text)' }}>{selectedStrain}</span>.
          <div style={{ marginTop: 6, color: 'var(--text-3)' }}>
            Register a mother plant in the Mother Plants tab to start building the tree.
          </div>
        </div>
      )}

      {/* Tree */}
      {selectedStrain && !loading && hasData && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

          {/* Root strain node */}
          <div style={{
            background: 'rgba(74,222,128,0.08)', border: '0.5px solid rgba(74,222,128,0.3)',
            borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, color: '#4ade80',
          }}>
            {selectedStrain}
          </div>

          {/* Mother plants branch */}
          {hasMotherPlants && (
            <>
              <Connector />
              <div style={{ width: '100%' }}>
                <SectionLabel text="Mother Plants" count={lineage.mother_plants.length} />
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {lineage.mother_plants.map(mp => <MotherPlantCard key={mp.id} mp={mp} />)}
                </div>
              </div>
            </>
          )}

          {/* Seed lots branch */}
          {hasSeedLots && (
            <>
              <div style={{ height: 20 }} />
              <div style={{ width: '100%' }}>
                <SectionLabel text="Seed Lots" count={lineage.seed_lots.length} />
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {lineage.seed_lots.map(lot => <SeedLotCard key={lot.id} lot={lot} />)}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
