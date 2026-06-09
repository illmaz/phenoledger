export const fleetData = [
  { strain: 'C&C F1',     b1: 20.2, b2: 21.1, latest: 21.8 },
  { strain: 'OG Kush',    b1: 22.1, b2: 22.8, latest: 23.1 },
  { strain: 'Blue Lotus', b1: 18.4, b2: 17.9, latest: 18.1 },
  { strain: 'W. Pie',     b1: 19.8, b2: 20.1, latest: 20.4 },
  { strain: 'Zkittlez',   b1: 21.0, b2: 21.4, latest: 21.9 },
  { strain: 'SS Haze',    b1: 17.9, b2: 18.2, latest: 18.0 },
]

export const recentUploads = [
  { id: 'CC-F1-2025-006', name: 'Cookies & Cream F1', lab: 'SC Labs',        status: 'ok' },
  { id: 'OG-K-2025-012',  name: 'OG Kush Select',     lab: 'Confident LIMS', status: 'ok' },
  { id: 'BL-2025-003',    name: 'Blue Lotus F1',       lab: 'FESA Labs',      status: 'warn' },
  { id: 'WP-F1-2025-008', name: 'Wedding Pie F1',      lab: 'SC Labs',        status: 'ok' },
]

export const alerts = [
  { label: 'Blue Lotus F1 – THC', detail: '↓ 3.2%', variant: 'warn' },
  { label: 'OG Kush – Myrcene',   detail: '↑ high', variant: 'warn' },
]

export const strainTrend = [
  { month: 'Jun 24', thc: 20.2 },
  { month: 'Aug 24', thc: 21.1 },
  { month: 'Oct 24', thc: 20.8 },
  { month: 'Dec 24', thc: 20.9 },
  { month: 'Feb 25', thc: 21.3 },
  { month: 'Mar 25', thc: 21.8 },
]

export const cannabinoidProfile = [
  { name: 'THC',  pct: 21.8, color: '#4ade80' },
  { name: 'THCA', pct: 24.1, color: '#4ade80' },
  { name: 'CBD',  pct: 0.11, color: '#60a5fa' },
  { name: 'CBG',  pct: 0.34, color: '#fbbf24' },
]

export const consistencyProfile = [
  { name: 'THC',     score: 94, color: '#4ade80' },
  { name: 'THCA',    score: 91, color: '#4ade80' },
  { name: 'Myrcene', score: 78, color: '#fbbf24' },
  { name: 'CBD',     score: 96, color: '#4ade80' },
]

export const coaRecords = [
  { id: 'CC-F1-2025-006', strain: 'Cookies & Cream F1', lab: 'SC Labs',        date: '14 Mar 2025' },
  { id: 'OG-K-2025-012',  strain: 'OG Kush Select',     lab: 'Confident LIMS', date: '09 Mar 2025' },
  { id: 'BL-2025-003',    strain: 'Blue Lotus F1',       lab: 'FESA Labs',      date: '01 Mar 2025' },
  { id: 'WP-F1-2025-008', strain: 'Wedding Pie F1',      lab: 'SC Labs',        date: '22 Feb 2025' },
]

export const motherPlants = [
  { id: 'MP-CC-001', strain: 'Cookies & Cream F1', gen: 3, clones: 47 },
  { id: 'MP-OG-003', strain: 'OG Kush Select',     gen: 5, clones: 89 },
  { id: 'MP-BL-002', strain: 'Blue Lotus F1',       gen: 2, clones: 31 },
]

export const trialData = [
  { strain: 'C&C F1',     indoor: 21.8, greenhouse: 20.9, outdoor: 19.4 },
  { strain: 'OG Kush',    indoor: 23.1, greenhouse: 22.4, outdoor: 21.0 },
  { strain: 'Blue Lotus', indoor: 18.1, greenhouse: 17.6, outdoor: 16.9 },
  { strain: 'W. Pie',     indoor: 20.4, greenhouse: 19.8, outdoor: 18.7 },
]

export const submissions = [
  { id: 'SUB-2025-023', desc: 'CC-F1-2025-006 · Batch data', status: 'ok',   date: '14 Mar 2025' },
  { id: 'SUB-2025-022', desc: 'OG-K-2025-012 · Batch data',  status: 'ok',   date: '09 Mar 2025' },
  { id: 'SUB-2025-021', desc: 'GACP report Q1 2025',          status: 'warn', date: '01 Mar 2025' },
]

export const cannaDistribution = [
  { range: '<12%',   count: 8   },
  { range: '12–15%', count: 24  },
  { range: '15–18%', count: 67  },
  { range: '18–21%', count: 112 },
  { range: '21–24%', count: 89  },
  { range: '24%+',   count: 12  },
]

export const topStrains = [
  { name: 'OG Kush (Thai-acclimated)', score: 97 },
  { name: 'Cookies & Cream F1',        score: 94 },
  { name: 'Blue Dream (local trial)',   score: 91 },
  { name: 'Wedding Pie F1',             score: 89 },
]
