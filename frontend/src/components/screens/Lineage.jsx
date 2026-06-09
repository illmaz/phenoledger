import { Panel, Badge, Row, Grid } from '../ui'
import { GitBranch, Leaf, FlaskConical } from 'lucide-react'

function NodeIcon({ color, children }) {
  const colors = {
    teal:   { bg: 'rgba(74,222,128,0.15)',  color: '#4ade80' },
    blue:   { bg: 'rgba(96,165,250,0.15)',  color: '#60a5fa' },
    purple: { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
  }
  const c = colors[color] || colors.teal
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexShrink: 0, background: c.bg, color: c.color,
    }}>
      {children}
    </div>
  )
}

function TreeRow({ icon, title, sub, badge, badgeVariant, indent = 0 }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '6px 0', borderBottom: '0.5px solid var(--border)',
      paddingLeft: indent,
    }}>
      {icon}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{sub}</div>
      </div>
      {badge && <Badge variant={badgeVariant || 'ok'}>{badge}</Badge>}
    </div>
  )
}

export default function Lineage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Full genetic provenance — seed lot origin → mother plant → batch</p>

      <Grid cols={2} gap={10}>
        <Panel title="Lineage Tree – Cookies & Cream F1" titleRight="Phase 2" fullWidth>
          <TreeRow
            icon={<NodeIcon color="purple"><GitBranch size={13} /></NodeIcon>}
            title="Seed lot SL-2023-001"
            sub="Imported · Dutch Passion genetics · Import permit #DP-TH-2023-044"
            badge="Origin" badgeVariant="purple"
          />
          <div style={{ paddingLeft: 20, borderLeft: '1.5px solid var(--border)', marginLeft: 13 }}>
            <TreeRow
              icon={<NodeIcon color="teal"><Leaf size={13} /></NodeIcon>}
              title="Mother plant MP-CC-001"
              sub="Established Jan 2024 · Indoor · Clone generation 3"
              badge="Active"
            />
            <div style={{ paddingLeft: 20, borderLeft: '1.5px solid var(--border)', marginLeft: 13 }}>
              <TreeRow
                icon={<NodeIcon color="blue"><FlaskConical size={13} /></NodeIcon>}
                title="Batch CC-F1-2025-006"
                sub="Harvest Mar 2025 · THC 21.8% · Consistency 94/100"
                badge="COA linked"
              />
              <TreeRow
                icon={<NodeIcon color="blue"><FlaskConical size={13} /></NodeIcon>}
                title="Batch CC-F1-2025-005"
                sub="Harvest Feb 2025 · THC 21.3% · Consistency 91/100"
                badge="COA linked"
              />
            </div>
          </div>
        </Panel>

        <Panel title="Mother Plant Record">
          {[
            ['Plant ID', <span style={{ fontFamily: 'monospace', fontSize: 11 }}>MP-CC-001</span>],
            ['Established', 'Jan 2024'],
            ['Clone generation', '3'],
            ['Clones taken', '47'],
            ['Health status', <Badge>Healthy</Badge>],
            ['HLVd tested', <Badge>Negative</Badge>],
          ].map(([k, v], i, arr) => (
            <Row key={k} last={i === arr.length - 1}>
              <span style={{ color: 'var(--text-2)' }}>{k}</span>
              <span>{v}</span>
            </Row>
          ))}
        </Panel>

        <Panel title="Seed Lot Documentation">
          {[
            ['Lot ID', <span style={{ fontFamily: 'monospace', fontSize: 11 }}>SL-2023-001</span>],
            ['Origin', 'Netherlands'],
            ['Import permit', <Badge variant="info">#DP-TH-2023-044</Badge>],
            ['Phytosanitary cert', <Badge>On file</Badge>],
            ['Germination rate', '94%'],
          ].map(([k, v], i, arr) => (
            <Row key={k} last={i === arr.length - 1}>
              <span style={{ color: 'var(--text-2)' }}>{k}</span>
              <span>{v}</span>
            </Row>
          ))}
        </Panel>
      </Grid>
    </div>
  )
}
