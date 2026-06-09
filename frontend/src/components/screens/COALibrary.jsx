import { useState } from 'react'
import { Search, FileText } from 'lucide-react'
import { StatCard, Panel, Badge, Row, Grid } from '../ui'
import { coaRecords } from '../../data/index'

export default function COALibrary() {
  const [query, setQuery] = useState('')
  const filtered = coaRecords.filter(r =>
    !query || [r.strain, r.lab, r.id, r.date].some(f => f.toLowerCase().includes(query.toLowerCase()))
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search COAs by strain, batch ID, lab, or date…"
          style={{
            width: '100%', padding: '8px 12px 8px 30px', fontSize: 13,
            border: '0.5px solid var(--border)', borderRadius: 8,
            background: 'var(--card)', color: 'var(--text)', outline: 'none',
          }}
        />
      </div>

      <Grid cols={4} gap={8}>
        <StatCard label="Total COAs"  value="47" />
        <StatCard label="Labs"        value="4" />
        <StatCard label="Strains"     value="12" />
        <StatCard label="This Month"  value="6" />
      </Grid>

      <Panel title="All COA Records" fullWidth>
        {filtered.map((r, i) => (
          <Row key={r.id} last={i === filtered.length - 1}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-3)', width: 120, flexShrink: 0 }}>{r.id}</span>
            <span style={{ flex: 1 }}>{r.strain}</span>
            <Badge variant="gray">{r.lab}</Badge>
            <span style={{ color: 'var(--text-2)', fontSize: 11, width: 90, textAlign: 'right' }}>{r.date}</span>
            <button style={{
              background: 'none', border: 'none', color: '#60a5fa', fontSize: 11,
              display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer',
            }}>
              <FileText size={12} /> View
            </button>
          </Row>
        ))}
        {filtered.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '12px 0' }}>No records match your search.</div>
        )}
      </Panel>
    </div>
  )
}
