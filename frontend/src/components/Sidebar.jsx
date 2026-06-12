import { useState } from 'react'
import {
  LayoutDashboard, Dna, FlaskConical, GitBranch, GitMerge, Leaf, Sprout,
  TestTube2, FileCheck2, Shield, Microscope, Building2, Globe, Zap,
} from 'lucide-react'

const NAV = [
  { id: 'overview',          label: 'Overview',         Icon: LayoutDashboard },
  { id: 'strains',           label: 'Strains',          Icon: Dna             },
  { id: 'coa-library',       label: 'COA Library',      Icon: FlaskConical    },
  { id: 'lineage',           label: 'Lineage Tree',     Icon: GitBranch       },
  { id: 'mother-plants',     label: 'Mother Plants',    Icon: Leaf            },
  { id: 'seed-lots',         label: 'Seed Lots',        Icon: Sprout          },
  { id: 'breeding-records',  label: 'Breeding Records', Icon: GitMerge        },
  { id: 'trials',            label: 'Trial Data',       Icon: TestTube2       },
  { id: 'gacp',              label: 'GACP Reports',     Icon: FileCheck2      },
  { id: 'health-screenings', label: 'Health Screenings',Icon: Shield          },
  { id: 'dus-tests',         label: 'DUS Testing',      Icon: FlaskConical    },
  { id: 'tissue-culture',    label: 'Tissue Culture',   Icon: Microscope      },
  { id: 'thai-fda',          label: 'Thai FDA',         Icon: Building2       },
  { id: 'cannaverify',       label: 'Public Search',    Icon: Globe           },
  { id: 'api',               label: 'API & Webhooks',   Icon: Zap             },
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
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {NAV.map(({ id, label, Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              onMouseEnter={() => setHovered(id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 16px', fontSize: 12, border: 'none',
                color: isActive ? 'var(--text)' : 'var(--text-2)',
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
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
