import { StatCard, Panel, Badge, Row, Grid } from '../ui'
import { submissions } from '../../data/index'

export default function ThaiFDA() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Direct data pipeline to Thai FDA track-and-trace system.</p>

      <Grid cols={4} gap={8}>
        <StatCard label="Submitted" value="23" sub="Accepted" />
        <StatCard label="Pending"   value="3" />
        <StatCard label="Rejected"  value="0" />
        <StatCard label="Last Sync" value="Today" sub="Up to date" />
      </Grid>

      <Panel title="Submission History" fullWidth>
        {submissions.map((s, i) => (
          <Row key={s.id} last={i === submissions.length - 1}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-3)', width: 110, flexShrink: 0 }}>{s.id}</span>
            <span style={{ flex: 1 }}>{s.desc}</span>
            <Badge variant={s.status}>{s.status === 'ok' ? 'Accepted' : 'Pending review'}</Badge>
            <span style={{ fontSize: 11, color: 'var(--text-2)', width: 90, textAlign: 'right' }}>{s.date}</span>
          </Row>
        ))}
      </Panel>
    </div>
  )
}
