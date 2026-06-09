import { Check, Clock, Download } from 'lucide-react'
import { StatCard, Panel, Row, Grid } from '../ui'

const checks = [
  { label: 'Batch COA documentation',  done: true  },
  { label: 'Mother plant records',      done: true  },
  { label: 'Seed lot import permit',    done: true  },
  { label: 'Local trial data',          done: true  },
  { label: 'DUS test results',          done: false },
  { label: 'Thai FDA data export',      done: true  },
]

const exports = [
  'GACP report PDF',
  'COA data package',
  'Lineage documentation',
  'Trial summary report',
]

export default function GACP() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Grid cols={4} gap={8}>
        <StatCard label="GACP Compliant" value="10/12" sub="2 pending docs" subVariant="warn" />
        <StatCard label="Reports Generated" value="8" />
        <StatCard label="Last Audit"      value="Mar 2025" />
        <StatCard label="Next Submission" value="Jun 2025" />
      </Grid>

      <Grid cols={2} gap={10}>
        <Panel title="Compliance Checklist – Cookies & Cream F1">
          {checks.map((c, i) => (
            <div key={c.label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '7px 0', borderBottom: i === checks.length - 1 ? 'none' : '0.5px solid var(--border)',
              fontSize: 12,
            }}>
              <span>{c.label}</span>
              {c.done ? (
                <span style={{ color: '#4ade80', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Check size={12} /> Complete
                </span>
              ) : (
                <span style={{ color: '#fbbf24', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Clock size={12} /> In progress
                </span>
              )}
            </div>
          ))}
        </Panel>

        <Panel title="Export for Thai FDA Submission">
          {exports.map((label, i) => (
            <Row key={label} last={i === exports.length - 1}>
              <span>{label}</span>
              <button style={{
                fontSize: 11, padding: '3px 9px', border: '0.5px solid var(--border)',
                borderRadius: 5, background: 'transparent', color: 'var(--text-2)',
                display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
              }}>
                <Download size={11} /> Download
              </button>
            </Row>
          ))}
        </Panel>
      </Grid>
    </div>
  )
}
