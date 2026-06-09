import { StatCard, Panel, Badge, Row, Grid } from '../ui'

const endpoints = [
  { method: 'POST', path: '/v1/coa/upload' },
  { method: 'GET',  path: '/v1/strains/{id}/batches' },
  { method: 'GET',  path: '/v1/consistency/{strain_id}' },
  { method: 'POST', path: '/v1/webhooks/coa-processed' },
  { method: 'GET',  path: '/v1/gacp/report/{strain_id}' },
]

const integrations = [
  { name: 'SC Labs LIMS',       status: 'ok',     label: 'Live push'   },
  { name: 'Confident Cannabis', status: 'ok',     label: 'Live push'   },
  { name: 'Thai FDA track & trace', status: 'ok', label: 'Webhook'     },
  { name: 'ERP (custom)',       status: 'info',   label: 'Configured'  },
  { name: 'Metrc / seed-to-sale', status: 'gray', label: 'Available'   },
]

export default function APIIntegrations() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 12, color: 'var(--text-2)' }}>
        Labs push COA data directly. LIMS integrations. ERP connectors. Thai FDA webhook.
      </p>

      <Grid cols={4} gap={8}>
        <StatCard label="API Calls Today"   value="1,247" />
        <StatCard label="Connected Labs"    value="3" />
        <StatCard label="Webhooks Active"   value="5" />
        <StatCard label="Uptime"            value="99.9%" sub="30-day avg" />
      </Grid>

      <Grid cols={2} gap={10}>
        <Panel title="Available Endpoints">
          {endpoints.map((e, i) => (
            <div key={e.path} style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 5,
              padding: '6px 10px', fontFamily: 'monospace', fontSize: 11,
              color: 'var(--text-2)', marginBottom: i === endpoints.length - 1 ? 0 : 6,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{
                padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 700,
                background: e.method === 'POST' ? 'rgba(96,165,250,0.15)' : 'rgba(74,222,128,0.15)',
                color: e.method === 'POST' ? '#60a5fa' : '#4ade80',
              }}>
                {e.method}
              </span>
              {e.path}
            </div>
          ))}
        </Panel>

        <Panel title="Connected Integrations">
          {integrations.map((it, i) => (
            <Row key={it.name} last={i === integrations.length - 1}>
              <span>{it.name}</span>
              <Badge variant={it.status}>{it.label}</Badge>
            </Row>
          ))}
        </Panel>
      </Grid>
    </div>
  )
}
