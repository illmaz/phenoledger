import { useState, useEffect } from 'react'
import { FileDown, CheckCircle2, XCircle } from 'lucide-react'
import { Badge } from '../ui'
import {
  fetchStrains,
  fetchComplianceChecklist,
  downloadGACPReport,
  downloadStrainPerformanceReport,
  downloadImportSummaryReport,
  downloadTrialPerformanceReport,
} from '../../api'

const SEVERITY_COLOR = {
  critical: '#f87171',
  high:     '#fbbf24',
  medium:   '#fde68a',
}

function scoreVariant(pct) {
  if (pct >= 85) return 'ok'
  if (pct >= 60) return 'warn'
  return 'danger'
}

// ── ComplianceChecklist ───────────────────────────────────────────────────────

function ComplianceChecklist({ strainName }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!strainName) { setData(null); setError(null); return }
    let cancelled = false
    setLoading(true); setData(null); setError(null)
    fetchComplianceChecklist(strainName)
      .then(d  => { if (!cancelled) { setData(d);           setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message);  setLoading(false) } })
    return () => { cancelled = true }
  }, [strainName])

  if (!strainName) return null

  if (loading) {
    return (
      <div style={{ fontSize: 11, color: 'var(--text-3)', padding: '8px 0', fontStyle: 'italic' }}>
        Checking compliance…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ fontSize: 11, color: '#f87171', padding: '8px 0' }}>
        Checklist unavailable
      </div>
    )
  }

  if (!data) return null

  const passed  = data.passed ?? 0
  const total   = data.total  ?? 0
  const pct     = total > 0 ? Math.round((passed / total) * 100) : 0
  const checks  = data.checks ?? []

  return (
    <div style={{
      border: '0.5px solid var(--border)', borderRadius: 6,
      padding: '10px 12px', marginBottom: 10,
      background: 'rgba(255,255,255,0.02)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Score summary */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{passed}/{total}</span> checks passed
        </span>
        <Badge variant={scoreVariant(pct)}>{pct}%</Badge>
      </div>

      {/* Ready message */}
      <div style={{ fontSize: 11, color: data.ready ? '#4ade80' : '#fbbf24', fontWeight: 500 }}>
        {data.ready ? '✓ Ready to generate report' : '⚠ Issues found — review before submitting'}
      </div>

      {/* Check items */}
      {checks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {checks.map((item, i) => {
            const failColor = SEVERITY_COLOR[item.severity] ?? '#f87171'
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                {item.passed
                  ? <CheckCircle2 size={11} color="#4ade80" style={{ flexShrink: 0, marginTop: 1 }} />
                  : <XCircle      size={11} color={failColor} style={{ flexShrink: 0, marginTop: 1 }} />
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: 11,
                    color: item.passed ? 'var(--text-2)' : failColor,
                  }}>
                    {item.label}
                  </span>
                  {!item.passed && item.message && (
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
                      {item.message}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── ReportCard ────────────────────────────────────────────────────────────────

function ReportCard({ title, description, needsStrain, strains, strainsLoading, onDownload }) {
  const [selected, setSelected] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  const ready = needsStrain ? !!selected && !loading : !loading

  async function handleDownload() {
    setLoading(true); setError(null)
    try {
      await onDownload(needsStrain ? selected : undefined)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'var(--card)', border: '0.5px solid var(--border)',
      borderRadius: 8, padding: 16,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{description}</div>

      <div style={{ borderTop: '0.5px solid var(--border)', margin: '14px 0' }} />

      {needsStrain && (
        <>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
              Strain
            </div>
            <select
              value={selected}
              onChange={e => { setSelected(e.target.value); setError(null) }}
              disabled={strainsLoading}
              style={{
                width: '100%', padding: '6px 8px', fontSize: 11,
                background: 'var(--bg)', border: '0.5px solid var(--border)',
                borderRadius: 5, color: selected ? 'var(--text)' : 'var(--text-3)',
                appearance: 'none', cursor: strainsLoading ? 'not-allowed' : 'pointer',
              }}
            >
              <option value="">
                {strainsLoading ? 'Loading strains…' : '— Select a strain —'}
              </option>
              {(strains ?? []).map(s => (
                <option key={s.strain} value={s.strain}>{s.strain}</option>
              ))}
            </select>
          </div>

          <ComplianceChecklist strainName={selected} />
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
        <button
          onClick={handleDownload}
          disabled={!ready}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 13px', fontSize: 11, fontWeight: 500,
            border: '0.5px solid var(--border)', borderRadius: 6,
            background: 'transparent',
            color: ready ? 'var(--text-2)' : 'var(--text-3)',
            cursor: ready ? 'pointer' : 'not-allowed',
            opacity: ready ? 1 : 0.6,
          }}
        >
          <FileDown size={12} />
          {loading ? 'Generating…' : 'Download'}
        </button>
        {error && (
          <span style={{ fontSize: 11, color: '#f87171' }}>{error}</span>
        )}
      </div>
    </div>
  )
}

// ── GACP ──────────────────────────────────────────────────────────────────────

export default function GACP() {
  const [strains, setStrains]               = useState(null)
  const [strainsLoading, setStrainsLoading] = useState(true)

  useEffect(() => {
    fetchStrains()
      .then(data => { setStrains(data); setStrainsLoading(false) })
      .catch(() => { setStrains([]); setStrainsLoading(false) })
  }, [])

  const sharedStrainProps = { strains, strainsLoading }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Reports</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>
          Generate compliance and performance reports for export and audit.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <ReportCard
          title="GACP Batch Compliance Report"
          description="Full compliance chain for a strain"
          needsStrain
          onDownload={downloadGACPReport}
          {...sharedStrainProps}
        />
        <ReportCard
          title="Strain Performance Report"
          description="Cannabinoid consistency and terpene profile"
          needsStrain
          onDownload={downloadStrainPerformanceReport}
          {...sharedStrainProps}
        />
        <ReportCard
          title="Import Documentation Summary"
          description="All seed import records for the farm"
          needsStrain={false}
          onDownload={downloadImportSummaryReport}
          {...sharedStrainProps}
        />
        <ReportCard
          title="Trial Performance Report"
          description="Local trial data linked to COA outcomes"
          needsStrain
          onDownload={downloadTrialPerformanceReport}
          {...sharedStrainProps}
        />
      </div>
    </div>
  )
}
