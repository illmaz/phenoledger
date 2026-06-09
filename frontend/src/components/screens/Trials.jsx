import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { StatCard, Panel, HBar, Grid, TOOLTIP_STYLE, AXIS_TICK, GRID_COLOR } from '../ui'
import { trialData } from '../../data/index'

export default function Trials() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 12, color: 'var(--text-2)' }}>
        Local performance data under Thai tropical conditions — the data Europe and North America cannot provide.
      </p>

      <Grid cols={4} gap={8}>
        <StatCard label="Active Trials"  value="4" />
        <StatCard label="Environments"   value="3" sub="Indoor / GH / Outdoor" />
        <StatCard label="Avg Yield"      value="480g/m²" />
        <StatCard label="Mold Incidents" value="0" sub="Clean season" />
      </Grid>

      <Grid cols={2} gap={10}>
        <Panel title="Environmental Performance">
          <HBar label="Heat tolerance"       value={92} color="#4ade80" showPct />
          <HBar label="Humidity resistance"  value={87} color="#4ade80" showPct />
          <HBar label="Tropical photoperiod" value={94} color="#4ade80" showPct />
          <HBar label="Pest pressure"        value={55} color="#fbbf24" showPct />
        </Panel>

        <Panel title="Trial Locations">
          <div style={{
            height: 140, background: 'rgba(255,255,255,0.03)', borderRadius: 6,
            border: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text-3)', fontSize: 12,
          }}>
            <span style={{ fontSize: 18 }}>📍</span>
            <span>Chiang Mai · Chonburi · Bangkok</span>
            <span style={{ fontSize: 10 }}>3 licensed grow sites</span>
          </div>
        </Panel>

        <Panel title="Cannabinoid Stability Across Environments" titleRight="Same strain, 3 conditions" fullWidth>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={trialData} barGap={2} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="strain" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={v => v + '%'} domain={[14, 26]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => v.toFixed(1) + '%'} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#666' }} iconType="rect" iconSize={8} />
              <Bar dataKey="indoor"     name="Indoor"     fill="#4ade80" radius={[2,2,0,0]} />
              <Bar dataKey="greenhouse" name="Greenhouse" fill="#60a5fa" radius={[2,2,0,0]} />
              <Bar dataKey="outdoor"    name="Outdoor"    fill="#fbbf24" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </Grid>
    </div>
  )
}
