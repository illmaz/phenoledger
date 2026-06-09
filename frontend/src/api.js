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

export async function uploadCOA(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.detail || 'Upload failed')
  return body
}
