import { supabase } from './supabase'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001'

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return {}
  if (session.expires_at && session.expires_at < Date.now() / 1000) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession()
    return refreshed?.access_token
      ? { Authorization: `Bearer ${refreshed.access_token}` }
      : {}
  }
  return { Authorization: `Bearer ${session.access_token}` }
}

async function apiFetch(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timer)
    return res
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') throw new Error('Request timed out')
    throw err
  }
}

export async function fetchOverview() {
  const res = await apiFetch(`${BASE}/overview`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function fetchUploads() {
  const res = await apiFetch(`${BASE}/uploads`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function fetchConsistency() {
  const res = await apiFetch(`${BASE}/consistency`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function fetchConsistencyAlerts() {
  const res = await apiFetch(`${BASE}/consistency/alerts`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function fetchStrains() {
  const res = await apiFetch(`${BASE}/strains`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function fetchAllStrains() {
  const res = await apiFetch(`${BASE}/strains/all`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function fetchStrainCannabinoids(strainName) {
  const res = await apiFetch(`${BASE}/strain/${encodeURIComponent(strainName)}/cannabinoids`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function fetchStrainTerpenes(strainName) {
  const res = await apiFetch(`${BASE}/strain/${encodeURIComponent(strainName)}/terpenes`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function fetchStrainBatches(strainName) {
  const res = await apiFetch(`${BASE}/strain/${encodeURIComponent(strainName)}/batches`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function createPropagation(payload) {
  const res = await apiFetch(`${BASE}/propagations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function fetchUploadsCount() {
  const res = await apiFetch(`${BASE}/uploads/count`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  const data = await res.json()
  return data.count
}

export async function fetchUploadPdf(uploadId) {
  const res = await apiFetch(`${BASE}/upload/${encodeURIComponent(uploadId)}/pdf`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  const data = await res.json()
  return data.url
}

export async function fetchSeedLots() {
  const res = await apiFetch(`${BASE}/seed-lots`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function createSeedLot(payload) {
  const res = await apiFetch(`${BASE}/seed-lots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function updateSeedLot(id, payload) {
  const res = await apiFetch(`${BASE}/seed-lots/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function deleteSeedLot(id) {
  const res = await apiFetch(`${BASE}/seed-lots/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function fetchMotherPlants() {
  const res = await apiFetch(`${BASE}/mother-plants`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function createMotherPlant(payload) {
  const res = await apiFetch(`${BASE}/mother-plants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function retireMotherPlant(id) {
  const res = await apiFetch(`${BASE}/mother-plants/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function deleteMotherPlant(id) {
  const res = await apiFetch(`${BASE}/mother-plants/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function fetchLineage(strainName) {
  const res = await apiFetch(`${BASE}/strain/${encodeURIComponent(strainName)}/lineage`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function deleteStrain(strainName) {
  const res = await apiFetch(`${BASE}/strain/${encodeURIComponent(strainName)}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function fetchTrials() {
  const res = await apiFetch(`${BASE}/trials`, { headers: await authHeaders() })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function createTrial(payload) {
  const res = await apiFetch(`${BASE}/trials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function deleteTrial(id) {
  const res = await apiFetch(`${BASE}/trials/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function fetchTrialDetail(id) {
  const res = await apiFetch(`${BASE}/trials/${encodeURIComponent(id)}`, { headers: await authHeaders() })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function fetchTrialEvents(id) {
  const res = await apiFetch(`${BASE}/trials/${encodeURIComponent(id)}/events`, { headers: await authHeaders() })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function createTrialEvent(id, payload) {
  const res = await apiFetch(`${BASE}/trials/${encodeURIComponent(id)}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function fetchTrialAnalyticsSummary() {
  const res = await apiFetch(`${BASE}/trials/analytics/summary`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function downloadGACPReport(strainName) {
  const res = await apiFetch(`${BASE}/reports/gacp/${encodeURIComponent(strainName)}`, {
    headers: { ...await authHeaders() }
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || String(res.status))
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `GACP_${strainName.replace(/ /g, '_')}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export async function fetchPlantHealthScreenings() {
  const res = await apiFetch(`${BASE}/plant-health-screenings`, { headers: await authHeaders() })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function createPlantHealthScreening(payload) {
  const res = await apiFetch(`${BASE}/plant-health-screenings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function deletePlantHealthScreening(id) {
  const res = await apiFetch(`${BASE}/plant-health-screenings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function fetchTissueCultureRecords() {
  const res = await apiFetch(`${BASE}/tissue-culture-records`, { headers: await authHeaders() })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function createTissueCultureRecord(payload) {
  const res = await apiFetch(`${BASE}/tissue-culture-records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function deleteTissueCultureRecord(id) {
  const res = await apiFetch(`${BASE}/tissue-culture-records/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function fetchDUSTests() {
  const res = await apiFetch(`${BASE}/dus-tests`, { headers: await authHeaders() })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function createDUSTest(payload) {
  const res = await apiFetch(`${BASE}/dus-tests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function deleteDUSTest(id) {
  const res = await apiFetch(`${BASE}/dus-tests/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function fetchBreedingRecords() {
  const res = await apiFetch(`${BASE}/breeding-records`, { headers: await authHeaders() })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function createBreedingRecord(payload) {
  const res = await apiFetch(`${BASE}/breeding-records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function deleteBreedingRecord(id) {
  const res = await apiFetch(`${BASE}/breeding-records/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function downloadStrainPerformanceReport(strainName) {
  const res = await apiFetch(`${BASE}/reports/strain-performance/${encodeURIComponent(strainName)}`, {
    headers: { ...await authHeaders() }
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || String(res.status))
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `StrainPerformance_${strainName.replace(/ /g, '_')}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadImportSummaryReport() {
  const res = await apiFetch(`${BASE}/reports/import-summary`, {
    headers: { ...await authHeaders() }
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || String(res.status))
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'ImportSummary.pdf'
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadTrialPerformanceReport(strainName) {
  const res = await apiFetch(`${BASE}/reports/trial-performance/${encodeURIComponent(strainName)}`, {
    headers: { ...await authHeaders() }
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || String(res.status))
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `TrialPerformance_${strainName.replace(/ /g, '_')}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export async function linkTrialCOA(trialId, reportId) {
  const res = await apiFetch(
    `${BASE}/trials/${encodeURIComponent(trialId)}/coa`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...await authHeaders() },
      body: JSON.stringify({ report_id: reportId }),
    }
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || res.status)
  }
  return res.json()
}

export async function uploadCOA(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await apiFetch(`${BASE}/upload`, {
    method: 'POST',
    headers: await authHeaders(), // Content-Type set automatically by browser for FormData
    body: form,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.detail || 'Upload failed')
  return body
}
