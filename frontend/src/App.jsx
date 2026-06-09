import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Overview from './components/screens/Overview'
import Strains from './components/screens/Strains'
import COALibrary from './components/screens/COALibrary'
import Lineage from './components/screens/Lineage'
import MotherPlants from './components/screens/MotherPlants'
import Trials from './components/screens/Trials'
import GACP from './components/screens/GACP'
import ThaiFDA from './components/screens/ThaiFDA'
import CannaVerify from './components/screens/CannaVerify'
import APIIntegrations from './components/screens/APIIntegrations'

const SCREENS = {
  'overview':      { bc: ['Overview', 'Dashboard'],                Component: Overview        },
  'strains':       { bc: ['Strains', 'All strains'],                Component: Strains         },
  'coa-library':   { bc: ['COA Library', 'All records'],           Component: COALibrary      },
  'lineage':       { bc: ['Genetic Lineage', 'Cookies & Cream F1'],Component: Lineage         },
  'mother-plants': { bc: ['Mother Plants', 'Registry'],            Component: MotherPlants    },
  'trials':        { bc: ['Local Trial Data', 'Thailand'],         Component: Trials          },
  'gacp':          { bc: ['GACP Reports', 'Compliance'],           Component: GACP            },
  'thai-fda':      { bc: ['Thai FDA', 'Submissions'],              Component: ThaiFDA         },
  'cannaverify':   { bc: ['CannaVerify', 'Public Search'],         Component: CannaVerify     },
  'api':           { bc: ['API', 'Integrations'],                  Component: APIIntegrations },
}

export default function App() {
  const [active, setActive] = useState('overview')
  const [uploadKey, setUploadKey] = useState(0)
  const { bc, Component } = SCREENS[active] || SCREENS['overview']

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      <Sidebar active={active} onNavigate={setActive} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar breadcrumb={bc} onUploadSuccess={() => setUploadKey(k => k + 1)} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <Component refreshKey={uploadKey} />
        </div>
      </div>
    </div>
  )
}
