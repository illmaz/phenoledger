import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { Panel, Grid, StatCard, Badge } from '../ui'
import { fetchAllStrains, fetchDUSTests, createDUSTest, deleteDUSTest } from '../../api'

const STATUSES = ['pending', 'in_progress', 'passed', 'failed']
const OVERALL_RESULTS = ['pending', 'pass', 'fail']

const STATUS_VARIANT  = { pending: 'warn', in_progress: 'info', passed: 'ok', failed: 'danger' }
const STATUS_LABEL    = { pending: 'Pending', in_progress: 'In Progress', passed: 'Passed', failed: 'Failed' }
const RESULT_VARIANT  = { pass: 'ok', fail: 'danger', pending: 'warn' }
const RESULT_LABEL    = { pass: 'Pass', fail: 'Fail', pending: 'Pending' }

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtScore(v) {
  if (v == null) return '—'
  return parseFloat(v).toFixed(1)
}

// ── DUSForm ───────────────────────────────────────────────────────────────────

function DUSForm({ strains, onSaved }) {
  const EMPTY = {
    strain_id: '', testing_body: '', test_date: '', status: 'pending',
    distinctness_score: '', uniformity_score: '', stability_score: '',
    overall_result: 'pending', registration_number: '', notes: '',
  }
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.strain_id)  { setError('Strain is required'); return }
    if (!form.test_date)  { setError('Test date is required'); return }
    setSaving(true); setError('')
    try {
      await createDUSTest({
        strain_id:           form.strain_id,
        testing_body:        form.testing_body        || null,
        test_date:           form.test_date,
        status:              form.status,
        distinctness_score:  form.distinctness_score  ? parseFloat(form.distinctness_score)  : null,
        uniformity_score:    form.uniformity_score    ? parseFloat(form.uniformity_score)    : null,
        stability_score:     form.stability_score     ? parseFloat(form.stability_score)     : null,
        overall_result:      form.overall_result,
        registration_number: form.registration_number || null,
        notes:               form.notes               || null,
      })
      setForm(EMPTY)
      await onSaved()
    } catch (err) {
      setError(err?.message || err?.detail || JSON.stringify(err) || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const inp = {
    width: '100%', padding: '6px 9px', fontSize: 12, boxSizing: 'border-box',
    border: '0.5px solid var(--border)', borderRadius: 6,
    background: 'var(--bg)', color: 'var(--text)', outline: 'none',
  }
  const lbl = { fontSize: 11, color: 'var(--text-2)', display: 'block', marginBottom: 4 }

  return (
    <Panel title="New DUS Test">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Row 1: Strain / Testing Body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Strain *</label>
            <select style={inp} value={form.strain_id} onChange={e => set('strain_id', e.target.value)} required>
              <option value="">— Select strain —</option>
              {strains.map(s => <option key={s.strain_id} value={s.strain_id}>{s.strain}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Testing Body</label>
            <input style={inp} value={form.testing_body} onChange={e => set('testing_body', e.target.value)} placeholder="e.g. UPOV, DPT" />
          </div>
        </div>

        {/* Row 2: Test Date / Status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Test Date *</label>
            <input style={inp} type="date" value={form.test_date} onChange={e => set('test_date', e.target.value)} required />
          </div>
          <div>
            <label style={lbl}>Status</label>
            <select style={inp} value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        </div>

        {/* Row 3: D / U / S Scores */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Distinctness Score</label>
            <input style={inp} type="number" min="0" max="100" step="0.1" value={form.distinctness_score} onChange={e => set('distinctness_score', e.target.value)} placeholder="0–100" />
          </div>
          <div>
            <label style={lbl}>Uniformity Score</label>
            <input style={inp} type="number" min="0" max="100" step="0.1" value={form.uniformity_score} onChange={e => set('uniformity_score', e.target.value)} placeholder="0–100" />
          </div>
          <div>
            <label style={lbl}>Stability Score</label>
            <input style={inp} type="number" min="0" max="100" step="0.1" value={form.stability_score} onChange={e => set('stability_score', e.target.value)} placeholder="0–100" />
          </div>
        </div>

        {/* Row 4: Overall Result / Registration Number */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Overall Result</label>
            <select style={inp} value={form.overall_result} onChange={e => set('overall_result', e.target.value)}>
              {OVERALL_RESULTS.map(r => <option key={r} value={r}>{RESULT_LABEL[r]}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Registration Number</label>
            <input style={inp} value={form.registration_number} onChange={e => set('registration_number', e.target.value)} placeholder="Optional" />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label style={lbl}>Notes</label>
          <textarea
            style={{ ...inp, resize: 'vertical', minHeight: 64, fontFamily: 'inherit' }}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            maxLength={500}
            placeholder="Optional notes…"
          />
          {form.notes.length > 400 && (
            <div style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'right', marginTop: 2 }}>
              {form.notes.length}/500
            </div>
          )}
        </div>

        {error && <div style={{ fontSize: 12, color: '#f87171' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '7px 14px', fontSize: 12, fontWeight: 600, border: 'none',
              borderRadius: 6, background: saving ? '#2d6e4a' : '#4ade80',
              color: '#0a0a0a', cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save DUS Test'}
          </button>
        </div>
      </form>
    </Panel>
  )
}

// ── DUSRow ────────────────────────────────────────────────────────────────────

function DUSRow({ record, onDelete, last }) {
  const [hovered, setHovered] = useState(false)

  const strainName = record.strains?.name ?? '—'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', gap: 12, alignItems: 'center',
        padding: '8px 0',
        borderBottom: last ? 'none' : '0.5px solid var(--border)',
      }}
    >
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {strainName}
      </span>
      <span title={record.testing_body ?? undefined} style={{ width: 110, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.testing_body ?? <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span style={{ width: 90, fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {fmtDate(record.test_date)}
      </span>
      <span style={{ width: 90, flexShrink: 0 }}>
        <Badge variant={STATUS_VARIANT[record.status] ?? 'gray'}>
          {STATUS_LABEL[record.status] ?? record.status ?? '—'}
        </Badge>
      </span>
      <span style={{ width: 110, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, letterSpacing: '0.02em' }}>
        {fmtScore(record.distinctness_score)} / {fmtScore(record.uniformity_score)} / {fmtScore(record.stability_score)}
      </span>
      <span style={{ width: 72, flexShrink: 0 }}>
        <Badge variant={RESULT_VARIANT[record.overall_result] ?? 'gray'}>
          {RESULT_LABEL[record.overall_result] ?? record.overall_result ?? '—'}
        </Badge>
      </span>
      <span style={{ width: 110, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.registration_number ?? <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <div style={{ width: 28, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        {hovered && (
          <button
            onClick={() => onDelete(record.id)}
            title="Delete"
            style={{
              padding: '2px 4px', border: 'none', background: 'transparent',
              cursor: 'pointer', color: '#f87171', display: 'flex', alignItems: 'center',
            }}
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── DUSTests ──────────────────────────────────────────────────────────────────

export default function DUSTests() {
  const [tests, setTests]           = useState(null)
  const [strains, setStrains]       = useState([])
  const [actionError, setActionError] = useState(null)

  async function loadTests() {
    try {
      const data = await fetchDUSTests()
      setTests(data)
    } catch {
      setTests([])
    }
  }

  useEffect(() => {
    loadTests()
    fetchAllStrains().then(setStrains).catch(() => {})
  }, [])

  async function handleDelete(id) {
    if (!window.confirm('Delete this DUS test record? This cannot be undone.')) return
    setActionError(null)
    try {
      await deleteDUSTest(id)
      setTests(prev => prev ? prev.filter(t => t.id !== id) : prev)
    } catch (err) {
      setActionError(`Delete failed: ${err.message}`)
    }
  }

  const hdr = { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }

  const data    = tests ?? []
  const passed  = data.filter(t => t.overall_result === 'pass').length
  const failed  = data.filter(t => t.overall_result === 'fail').length
  const pending = data.filter(t => t.status === 'pending' || t.status === 'in_progress').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <DUSForm strains={strains} onSaved={loadTests} />

      {actionError && (
        <div style={{ fontSize: 12, color: '#f87171' }}>{actionError}</div>
      )}

      {tests && tests.length > 0 && (
        <Grid cols={4} gap={8}>
          <StatCard label="Total Tests"    value={tests.length} />
          <StatCard label="Passed"         value={passed} subVariant={passed > 0 ? 'ok' : undefined} />
          <StatCard label="Failed"         value={failed} subVariant={failed > 0 ? 'warn' : undefined} />
          <StatCard label="In Progress"    value={pending} />
        </Grid>
      )}

      {tests === null ? (
        <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '32px', textAlign: 'center' }}>Loading…</div>
      ) : tests.length === 0 ? (
        <Panel>
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            No DUS tests recorded yet. Use the form above to add one.
          </div>
        </Panel>
      ) : (
        <Panel fullWidth>
          <div style={{ display: 'flex', gap: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--border)', marginBottom: 2 }}>
            <span style={{ ...hdr, flex: 1 }}>Strain</span>
            <span style={{ ...hdr, width: 110 }}>Testing Body</span>
            <span style={{ ...hdr, width: 90 }}>Test Date</span>
            <span style={{ ...hdr, width: 90 }}>Status</span>
            <span style={{ ...hdr, width: 110 }}>D / U / S</span>
            <span style={{ ...hdr, width: 72 }}>Result</span>
            <span style={{ ...hdr, width: 110 }}>Reg. No.</span>
            <span style={{ ...hdr, width: 28 }} />
          </div>
          {tests.map((t, i) => (
            <DUSRow
              key={t.id}
              record={t}
              onDelete={handleDelete}
              last={i === tests.length - 1}
            />
          ))}
        </Panel>
      )}
    </div>
  )
}
