import { useState } from 'react'
import {
  LayoutDashboard, Dna, FlaskConical, GitBranch, Leaf,
  TestTube2, FileCheck2, Building2, Globe, Zap,
} from 'lucide-react'

const PHASE_TAG = {
  live: { bg: 'rgba(74,222,128,0.15)',  color: '#4ade80',  label: 'live' },
  p2:   { bg: 'rgba(96,165,250,0.15)',  color: '#60a5fa',  label: 'p2'   },
  p3:   { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24',  label: 'p3'   },
  p4:   { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa',  label: 'p4'   },
  p5:   { bg: 'rgba(248,113,113,0.15)', color: '#f87171',  label: 'p5'   },
  p6:   { bg: 'rgba(255,255,255,0.07)', color: '#888888',  label: 'p6'   },
}

const NAV = [
  {
    section: 'Phase 1 · COA Intelligence',
    items: [
      { id: 'overview',    label: 'Overview',    Icon: LayoutDashboard, phase: 'live' },
      { id: 'strains',     label: 'Strains',     Icon: Dna,             phase: 'live' },
      { id: 'coa-library', label: 'COA Library', Icon: FlaskConical,    phase: 'live' },
    ],
  },
  {
    section: 'Phase 2 · Genetic Lineage',
    items: [
      { id: 'lineage',       label: 'Lineage Tree',  Icon: GitBranch, phase: 'p2' },
      { id: 'mother-plants', label: 'Mother Plants', Icon: Leaf,      phase: 'p2' },
    ],
  },
  {
    section: 'Phase 3 · Local Validation',
    items: [
      { id: 'trials', label: 'Trial Data', Icon: TestTube2, phase: 'p3' },
    ],
  },
  {
    section: 'Phase 4 · Compliance',
    items: [
      { id: 'gacp',     label: 'GACP Reports', Icon: FileCheck2, phase: 'p4' },
      { id: 'thai-fda', label: 'Thai FDA',      Icon: Building2,  phase: 'p4' },
    ],
  },
  {
    section: 'Phase 5 · CannaVerify',
    items: [
      { id: 'cannaverify', label: 'Public Search', Icon: Globe, phase: 'p5' },
    ],
  },
  {
    section: 'Phase 6 · Integrations',
    items: [
      { id: 'api', label: 'API & Webhooks', Icon: Zap, phase: 'p6' },
    ],
  },
]

export default function Sidebar({ active, onNavigate }) {
  const [hovered, setHovered] = useState(null)
  return (
    <aside style={{
      width: 200, flexShrink: 0, background: '#1e1e1e',
      borderRight: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text)' }}>
          PhenoLedger
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
          Irie Seeds · Farm Portal
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <div style={{
              fontSize: 9, letterSpacing: '0.09em', textTransform: 'uppercase',
              color: 'var(--text-3)', padding: '12px 16px 4px',
            }}>
              {section}
            </div>
            {items.map(({ id, label, Icon, phase }) => {
              const isActive = active === id
              const tag = PHASE_TAG[phase]
              const dimmed = phase !== 'live'
              return (
                <button
                  key={id}
                  onClick={() => onNavigate(id)}
                  onMouseEnter={() => setHovered(id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 16px', fontSize: 12, border: 'none',
                    color: isActive ? 'var(--text)' : dimmed ? 'var(--text-3)' : 'var(--text-2)',
                    borderLeft: `2px solid ${isActive ? '#4ade80' : 'transparent'}`,
                    cursor: 'pointer', textAlign: 'left',
                    background: isActive
                      ? 'rgba(255,255,255,0.04)'
                      : hovered === id
                        ? 'rgba(255,255,255,0.02)'
                        : 'transparent',
                  }}
                >
                  <Icon size={14} />
                  <span style={{ flex: 1 }}>{label}</span>
                  <span style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 3, fontWeight: 600,
                    background: tag.bg, color: tag.color,
                  }}>
                    {tag.label}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
