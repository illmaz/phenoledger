import { useState } from 'react'
import { Search } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { StatCard, Panel, Badge, Row, Grid, TOOLTIP_STYLE, AXIS_TICK, GRID_COLOR } from '../ui'
import { cannaDistribution, topStrains } from '../../data/index'

export default function CannaVerify() {
  const [query, setQuery] = useState('')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 12, color: 'var(--text-2)' }}>
        Anonymised aggregate data — anyone can search. Farms never identified. Thailand's genetic intelligence layer.
      </p>

      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search strains, cannabinoid profiles, or ask in natural language…"
          style={{
            width: '100%', padding: '8px 12px 8px 30px', fontSize: 13,
            border: '0.5px solid var(--border)', borderRadius: 8,
            background: 'var(--card)', color: 'var(--text)', outline: 'none',
          }}
        />
      </div>

      <Grid cols={4} gap={8}>
        <StatCard label="Strains Indexed"     value="847" />
        <StatCard label="COAs Processed"      value="4,210" />
        <StatCard label="Contributing Farms"  value="63" sub="Anonymous" />
        <StatCard label="Countries"           value="7" />
      </Grid>

      <Grid cols={2} gap={10}>
        <Panel title="THC Distribution – Thai-grown Indica" titleRight="Anonymised · 312 batches" fullWidth>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={cannaDistribution} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="range" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={v => v + ' batches'} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" name="Batches" fill="#4ade80" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Top Consistent Strains – Thailand">
          {topStrains.map((s, i) => (
            <Row key={s.name} last={i === topStrains.length - 1}>
              <span>{s.name}</span>
              <Badge>{s.score}/100</Badge>
            </Row>
          ))}
        </Panel>

        <Panel title="Market Benchmarks">
          {[
            ['Avg Thai-grown THC',       '19.8%'],
            ['Top quartile THC',          '23.1%+'],
            ['Avg consistency score',     '82/100'],
            ['GACP-documented strains',   '34%'],
          ].map(([k, v], i, arr) => (
            <Row key={k} last={i === arr.length - 1}>
              <span style={{ color: 'var(--text-2)' }}>{k}</span>
              <span style={{ fontWeight: 500 }}>{v}</span>
            </Row>
          ))}
        </Panel>
      </Grid>
    </div>
  )
}
