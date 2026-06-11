import { supabase } from './supabase'

const BASE = 'http://localhost:8001'

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {}
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
  if (!res.ok) throw new Error(`${res.status}`)
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
