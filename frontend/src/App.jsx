import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Login from './components/screens/Login'
import Overview from './components/screens/Overview'
import Strains from './components/screens/Strains'
import COALibrary from './components/screens/COALibrary'
import PesticideResidues from './components/screens/PesticideResidues'
import ExportRecords from './components/screens/ExportRecords'
import Lineage from './components/screens/Lineage'
import MotherPlants from './components/screens/MotherPlants'
import SeedLots from './components/screens/SeedLots'
import TrialData from './components/screens/TrialData'
import BreedingRecords from './components/screens/BreedingRecords'
import PlantHealthScreenings from './components/screens/PlantHealthScreenings'
import BatchRecords from './components/screens/BatchRecords'
import InputRecords from './components/screens/InputRecords'
import SOPManagement from './components/screens/SOPManagement'
import EnvironmentalMonitoring from './components/screens/EnvironmentalMonitoring'
import StaffRecords from './components/screens/StaffRecords'
import DUSTests from './components/screens/DUSTests'
import TissueCultureRecords from './components/screens/TissueCultureRecords'
import GACP from './components/screens/GACP'
import ThaiFDA from './components/screens/ThaiFDA'
import CannaVerify from './components/screens/CannaVerify'
import APIIntegrations from './components/screens/APIIntegrations'

const SCREENS = {
  'overview':      { bc: ['Overview', 'Dashboard'],                Component: Overview        },
  'strains':       { bc: ['Strains', 'All strains'],                Component: Strains         },
  'coa-library':          { bc: ['COA Library', 'All records'],           Component: COALibrary         },
  'pesticide-residues':   { bc: ['Pesticide Residues', 'Intelligence'],   Component: PesticideResidues  },
  'lineage':       { bc: ['Genetic Lineage', 'Cookies & Cream F1'],Component: Lineage         },
  'mother-plants': { bc: ['Mother Plants', 'Registry'],            Component: MotherPlants    },
  'seed-lots':        { bc: ['Seed Lots', 'Registry'],               Component: SeedLots        },
  'breeding-records': { bc: ['Breeding Records', 'Registry'],        Component: BreedingRecords },
  'trials':        { bc: ['Local Trial Data', 'Thailand'],         Component: TrialData       },
  'batch-records':  { bc: ['Batch Records', 'Production'],           Component: BatchRecords    },
  'input-records':  { bc: ['Input Records', 'Compliance'],           Component: InputRecords    },
  'sop-management': { bc: ['SOP Management', 'Compliance'],          Component: SOPManagement   },
  'environmental':  { bc: ['Environmental', 'Monitoring'],            Component: EnvironmentalMonitoring },
  'staff-records':   { bc: ['Staff & Training', 'Records'],            Component: StaffRecords    },
  'export-records':  { bc: ['Export Records', 'Compliance'],           Component: ExportRecords   },
  'gacp':              { bc: ['GACP Reports', 'Compliance'],           Component: GACP                  },
  'health-screenings': { bc: ['Health Screenings', 'Compliance'],      Component: PlantHealthScreenings },
  'dus-tests':         { bc: ['DUS Testing', 'Compliance'],            Component: DUSTests              },
  'tissue-culture':    { bc: ['Tissue Culture', 'Compliance'],         Component: TissueCultureRecords  },
  'thai-fda':      { bc: ['Thai FDA', 'Submissions'],              Component: ThaiFDA         },
  'cannaverify':   { bc: ['CannaVerify', 'Public Search'],         Component: CannaVerify     },
  'api':           { bc: ['API', 'Integrations'],                  Component: APIIntegrations },
}

export default function App() {
  const [session, setSession]     = useState(undefined) // undefined = initial load
  const [active, setActive]       = useState('overview')
  const [uploadKey, setUploadKey] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Waiting for initial session check
  if (session === undefined) return null

  if (!session) {
    return <Login />
  }

  const { bc, Component } = SCREENS[active] || SCREENS['overview']

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      <Sidebar active={active} onNavigate={setActive} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          breadcrumb={bc}
          onUploadSuccess={() => setUploadKey(k => k + 1)}
          onLogout={handleLogout}
        />
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <Component refreshKey={uploadKey} onNavigate={setActive} />
        </div>
      </div>
    </div>
  )
}
