import { StatCard, Panel, Badge, Row, Grid } from '../ui'
import { motherPlants } from '../../data/index'

export default function MotherPlants() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Grid cols={4} gap={8}>
        <StatCard label="Active Mothers" value="8" />
        <StatCard label="Clones Taken"   value="312" sub="This year" subVariant="ok" />
        <StatCard label="HLVd Tested"    value="8/8" sub="All negative" />
        <StatCard label="Flagged"        value="0"   sub="All healthy" />
      </Grid>

      <Panel title="Mother Plant Registry" fullWidth>
        {motherPlants.map((p, i) => (
          <Row key={p.id} last={i === motherPlants.length - 1}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-3)', width: 90, flexShrink: 0 }}>{p.id}</span>
            <span style={{ flex: 1 }}>{p.strain}</span>
            <span style={{ color: 'var(--text-2)', fontSize: 11 }}>Gen {p.gen}</span>
            <Badge>Healthy</Badge>
            <Badge>HLVd −</Badge>
            <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{p.clones} clones</span>
          </Row>
        ))}
      </Panel>
    </div>
  )
}
