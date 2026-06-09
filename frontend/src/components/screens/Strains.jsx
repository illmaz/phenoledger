import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { StatCard, Panel, Badge, HBar, Grid, TOOLTIP_STYLE, AXIS_TICK, GRID_COLOR } from '../ui'
import { strainTrend, cannabinoidProfile, consistencyProfile } from '../../data/index'

export default function Strains() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Grid cols={4} gap={8}>
        <StatCard label="Avg THC"      value="21.4%" sub="Stable ±0.4%" />
        <StatCard label="Avg CBD"      value="0.12%" sub="Stable ±0.02%" />
        <StatCard label="Consistency"  value={<>94<span style={{ fontSize: 12, color: 'var(--text-2)' }}>/100</span></>} sub="6 batches" />
        <StatCard label="GACP Status"  value={<Badge>Compliant</Badge>} />
      </Grid>

      <Grid cols={2} gap={10}>
        <Panel title="THC Trend – Cookies & Cream F1" titleRight="6 batches" fullWidth>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={strainTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={v => v + '%'} domain={[18, 24]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => v.toFixed(1) + '%'} />
              <Line
                type="monotone" dataKey="thc" stroke="#4ade80" strokeWidth={2}
                dot={{ r: 4, fill: '#4ade80' }} activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Cannabinoid Profile">
          {cannabinoidProfile.map(c => (
            <HBar key={c.name} label={c.name} value={c.pct} max={26} color={c.color} showPct />
          ))}
        </Panel>

        <Panel title="Compound Consistency">
          {consistencyProfile.map(c => (
            <HBar key={c.name} label={c.name} value={c.score} max={100} color={c.color} showPct />
          ))}
        </Panel>
      </Grid>
    </div>
  )
}
