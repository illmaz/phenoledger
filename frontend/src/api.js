const BASE = 'http://localhost:8001'

export async function fetchUploads() {
  const res = await fetch(`${BASE}/uploads`)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function fetchConsistency() {
  const res = await fetch(`${BASE}/consistency`)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function fetchStrains() {
  const res = await fetch(`${BASE}/strains`)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function fetchStrainCannabinoids(strainName) {
  const res = await fetch(`${BASE}/strain/${encodeURIComponent(strainName)}/cannabinoids`)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function fetchStrainTerpenes(strainName) {
  const res = await fetch(`${BASE}/strain/${encodeURIComponent(strainName)}/terpenes`)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function fetchStrainBatches(strainName) {
  const res = await fetch(`${BASE}/strain/${encodeURIComponent(strainName)}/batches`)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function fetchUploadsCount() {
  const res = await fetch(`${BASE}/uploads/count`)
  if (!res.ok) throw new Error(`${res.status}`)
  const data = await res.json()
  return data.count
}

export async function fetchUploadPdf(uploadId) {
  const res = await fetch(`${BASE}/upload/${encodeURIComponent(uploadId)}/pdf`)
  if (!res.ok) throw new Error(`${res.status}`)
  const data = await res.json()
  return data.url
}

export async function fetchMotherPlants() {
  const res = await fetch(`${BASE}/mother-plants`)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function createMotherPlant(payload) {
  const res = await fetch(`${BASE}/mother-plants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function deleteMotherPlant(id) {
  const res = await fetch(`${BASE}/mother-plants/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function fetchLineage(strainName) {
  const res = await fetch(`${BASE}/strain/${encodeURIComponent(strainName)}/lineage`)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function deleteStrain(strainName) {
  const res = await fetch(`${BASE}/strain/${encodeURIComponent(strainName)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function uploadCOA(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.detail || 'Upload failed')
  return body
}
