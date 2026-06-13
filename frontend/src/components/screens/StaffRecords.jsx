import { useState, useEffect } from 'react'
import { Trash2, Plus, BookOpen } from 'lucide-react'
import { Panel, Grid, StatCard, Badge } from '../ui'
import { fetchStaff, createStaff, deleteStaff, addStaffTraining, fetchVisitorLog, logVisitor, fetchSOPs } from '../../api'

const TRAINING_TYPES  = ['initial', 'refresher', 'certification']
const STAFF_STATUSES  = ['active', 'inactive']

const STATUS_VARIANT = { active: 'ok', inactive: 'gray' }
const STATUS_LABEL   = { active: 'Active', inactive: 'Inactive' }

const TODAY = new Date().toISOString().split('T')[0]

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(iso) {
  if (!iso) return null
  return Math.ceil((new Date(iso) - new Date(TODAY)) / 86400000)
}

function isExpiringSoon(member) {
  if (!Array.isArray(member.staff_training)) return false
  return member.staff_training.some(t => {
    const d = daysUntil(t.expiry_date)
    return d !== null && d >= 0 && d <= 30
  })
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const INP = {
  width: '100%', padding: '6px 9px', fontSize: 12, boxSizing: 'border-box',
  border: '0.5px solid var(--border)', borderRadius: 6,
  background: 'var(--bg)', color: 'var(--text)', outline: 'none',
}
const LBL = { fontSize: 11, color: 'var(--text-2)', display: 'block', marginBottom: 4 }

// ── TrainingForm ──────────────────────────────────────────────────────────────

function TrainingForm({ staffId, sops, onSaved, onCancel }) {
  const EMPTY = { sop_id: '', training_date: TODAY, training_type: 'initial', trainer: '', expiry_date: '', notes: '' }
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.training_date) { setError('Training date is required'); return }
    setSaving(true); setError('')
    try {
      await addStaffTraining(staffId, {
        sop_id:        form.sop_id        || null,
        training_date: form.training_date,
        training_type: form.training_type,
        trainer:       form.trainer       || null,
        expiry_date:   form.expiry_date   || null,
        notes:         form.notes         || null,
      })
      setForm(EMPTY)
      await onSaved()
    } catch (err) {
      setError(err?.message || 'Failed to save')
      setSaving(false)
    }
  }

  const inp = { ...INP, padding: '5px 8px' }

  return (
    <form
      onSubmit={handleSubmit}
      onClick={e => e.stopPropagation()}
      style={{ marginTop: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 2 }}>Add Training Record</div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
        <div>
          <label style={LBL}>SOP</label>
          <select style={inp} value={form.sop_id} onChange={e => set('sop_id', e.target.value)}>
            <option value="">— None —</option>
            {sops.map(s => <option key={s.id} value={s.id}>{s.sop_code} — {s.title}</option>)}
          </select>
        </div>
        <div>
          <label style={LBL}>Training Date *</label>
          <input style={inp} type="date" value={form.training_date} onChange={e => set('training_date', e.target.value)} required />
        </div>
        <div>
          <label style={LBL}>Type</label>
          <select style={inp} value={form.training_type} onChange={e => set('training_type', e.target.value)}>
            {TRAINING_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 8 }}>
        <div>
          <label style={LBL}>Trainer</label>
          <input style={inp} value={form.trainer} onChange={e => set('trainer', e.target.value)} placeholder="Name" />
        </div>
        <div>
          <label style={LBL}>Expiry Date</label>
          <input style={inp} type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} />
        </div>
        <div>
          <label style={LBL}>Notes</label>
          <input style={inp} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional" />
        </div>
      </div>
      {error && <div style={{ fontSize: 11, color: '#f87171' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ padding: '5px 12px', fontSize: 11, border: '0.5px solid var(--border)', borderRadius: 5, background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>Cancel</button>
        <button type="submit" disabled={saving} style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 5, background: saving ? '#2d6e4a' : '#4ade80', color: '#0a0a0a', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving…' : 'Add Training'}
        </button>
      </div>
    </form>
  )
}

// ── StaffRow ──────────────────────────────────────────────────────────────────

function StaffRow({ member, sops, onDelete, onTrainingAdded, last }) {
  const [hovered, setHovered]           = useState(false)
  const [showTraining, setShowTraining] = useState(false)

  const trainingCount = member.staff_training?.length ?? 0
  const expiring      = isExpiringSoon(member)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ padding: '8px 0', borderBottom: last && !showTraining ? 'none' : '0.5px solid var(--border)' }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {member.name}
          {expiring && <span style={{ marginLeft: 6, fontSize: 10, color: '#fbbf24', fontWeight: 600 }}>⚠ expiring</span>}
        </span>
        <span style={{ width: 120, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {member.role ?? <span style={{ color: 'var(--text-3)' }}>—</span>}
        </span>
        <span style={{ width: 80, flexShrink: 0 }}>
          <Badge variant={STATUS_VARIANT[member.status] ?? 'gray'}>
            {STATUS_LABEL[member.status] ?? member.status ?? '—'}
          </Badge>
        </span>
        <span style={{ width: 90, fontSize: 11, color: 'var(--text-2)', flexShrink: 0 }}>
          {fmtDate(member.start_date)}
        </span>
        <span style={{ width: 70, fontSize: 11, color: 'var(--text-3)', flexShrink: 0, textAlign: 'center' }}>
          {trainingCount} record{trainingCount !== 1 ? 's' : ''}
        </span>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
          {(hovered || showTraining) && !showTraining && (
            <button
              onClick={() => setShowTraining(true)}
              title="Add training record"
              style={{ padding: '2px 6px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}
            >
              <BookOpen size={11} />
            </button>
          )}
          <div style={{ width: 24, display: 'flex', justifyContent: 'center' }}>
            {hovered && (
              <button onClick={() => onDelete(member.id)} title="Delete" style={{ padding: '2px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#f87171', display: 'flex', alignItems: 'center' }}>
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </div>
      </div>

      {showTraining && (
        <TrainingForm
          staffId={member.id}
          sops={sops}
          onSaved={async () => { setShowTraining(false); await onTrainingAdded() }}
          onCancel={() => setShowTraining(false)}
        />
      )}
    </div>
  )
}

// ── StaffForm ─────────────────────────────────────────────────────────────────

function StaffForm({ onSaved, onCancel }) {
  const EMPTY = { name: '', role: '', email: '', phone: '', start_date: '', status: 'active' }
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      await createStaff({
        name:       form.name.trim(),
        role:       form.role       || null,
        email:      form.email      || null,
        phone:      form.phone      || null,
        start_date: form.start_date || null,
        status:     form.status,
      })
      setForm(EMPTY)
      await onSaved()
    } catch (err) {
      setError(err?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel title="Add Staff Member">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={LBL}>Name *</label>
            <input style={INP} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name" required />
          </div>
          <div>
            <label style={LBL}>Role</label>
            <input style={INP} value={form.role} onChange={e => set('role', e.target.value)} placeholder="e.g. Cultivator" />
          </div>
          <div>
            <label style={LBL}>Status</label>
            <select style={INP} value={form.status} onChange={e => set('status', e.target.value)}>
              {STAFF_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={LBL}>Email</label>
            <input style={INP} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label style={LBL}>Phone</label>
            <input style={INP} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label style={LBL}>Start Date</label>
            <input style={INP} type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
          </div>
        </div>
        {error && <div style={{ fontSize: 12, color: '#f87171' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 2 }}>
          <button type="button" onClick={onCancel} style={{ padding: '7px 14px', fontSize: 12, border: '0.5px solid var(--border)', borderRadius: 6, background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: saving ? '#2d6e4a' : '#4ade80', color: '#0a0a0a', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : 'Add Staff Member'}
          </button>
        </div>
      </form>
    </Panel>
  )
}

// ── VisitorForm ───────────────────────────────────────────────────────────────

function VisitorForm({ onSaved, onCancel }) {
  const EMPTY = { visitor_name: '', organization: '', purpose: '', visit_date: TODAY, host_name: '', notes: '' }
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.visitor_name.trim()) { setError('Visitor name is required'); return }
    if (!form.visit_date)          { setError('Visit date is required'); return }
    setSaving(true); setError('')
    try {
      await logVisitor({
        visitor_name: form.visitor_name.trim(),
        organization: form.organization || null,
        purpose:      form.purpose      || null,
        visit_date:   form.visit_date,
        host_name:    form.host_name    || null,
        notes:        form.notes        || null,
      })
      setForm(EMPTY)
      await onSaved()
    } catch (err) {
      setError(err?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel title="Log Visitor">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={LBL}>Visitor Name *</label>
            <input style={INP} value={form.visitor_name} onChange={e => set('visitor_name', e.target.value)} placeholder="Full name" required />
          </div>
          <div>
            <label style={LBL}>Organization</label>
            <input style={INP} value={form.organization} onChange={e => set('organization', e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label style={LBL}>Visit Date *</label>
            <input style={INP} type="date" value={form.visit_date} onChange={e => set('visit_date', e.target.value)} required />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div>
            <label style={LBL}>Purpose</label>
            <input style={INP} value={form.purpose} onChange={e => set('purpose', e.target.value)} placeholder="Reason for visit" />
          </div>
          <div>
            <label style={LBL}>Host Name</label>
            <input style={INP} value={form.host_name} onChange={e => set('host_name', e.target.value)} placeholder="Staff member hosting" />
          </div>
        </div>
        <div>
          <label style={LBL}>Notes</label>
          <textarea
            style={{ ...INP, resize: 'vertical', minHeight: 56, fontFamily: 'inherit' }}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            maxLength={500}
            placeholder="Optional notes…"
          />
          {form.notes.length > 400 && (
            <div style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'right', marginTop: 2 }}>{form.notes.length}/500</div>
          )}
        </div>
        {error && <div style={{ fontSize: 12, color: '#f87171' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 2 }}>
          <button type="button" onClick={onCancel} style={{ padding: '7px 14px', fontSize: 12, border: '0.5px solid var(--border)', borderRadius: 6, background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: saving ? '#2d6e4a' : '#4ade80', color: '#0a0a0a', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : 'Log Visitor'}
          </button>
        </div>
      </form>
    </Panel>
  )
}

// ── StaffTab ──────────────────────────────────────────────────────────────────

function StaffTab({ staff, sops, onReload, onDeleteStaff, actionError }) {
  const [showForm, setShowForm] = useState(false)

  const hdr = { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }

  const data            = staff ?? []
  const active          = data.filter(m => m.status === 'active').length
  const expiringSoon    = data.filter(isExpiringSoon).length
  const totalTrainings  = data.reduce((s, m) => s + (m.staff_training?.length ?? 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {showForm ? (
        <StaffForm
          onSaved={async () => { await onReload(); setShowForm(false) }}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowForm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: '#4ade80', color: '#0a0a0a', cursor: 'pointer' }}
          >
            <Plus size={13} /> Add Staff
          </button>
        </div>
      )}

      {actionError && <div style={{ fontSize: 12, color: '#f87171' }}>{actionError}</div>}

      {staff && staff.length > 0 && (
        <Grid cols={4} gap={8}>
          <StatCard label="Total Staff"        value={staff.length} />
          <StatCard label="Active"             value={active} subVariant={active > 0 ? 'ok' : undefined} />
          <StatCard label="Expiring Soon"      value={expiringSoon} subVariant={expiringSoon > 0 ? 'warn' : undefined} />
          <StatCard label="Training Records"   value={totalTrainings} />
        </Grid>
      )}

      {staff === null ? (
        <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '32px', textAlign: 'center' }}>Loading…</div>
      ) : staff.length === 0 ? (
        <Panel>
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            No staff records yet. Use the button above to add one.
          </div>
        </Panel>
      ) : (
        <Panel fullWidth>
          <div style={{ display: 'flex', gap: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--border)', marginBottom: 2 }}>
            <span style={{ ...hdr, flex: 1 }}>Name</span>
            <span style={{ ...hdr, width: 120 }}>Role</span>
            <span style={{ ...hdr, width: 80 }}>Status</span>
            <span style={{ ...hdr, width: 90 }}>Start Date</span>
            <span style={{ ...hdr, width: 70, textAlign: 'center' }}>Training</span>
            <span style={{ ...hdr, width: 52 }} />
          </div>
          {staff.map((m, i) => (
            <StaffRow
              key={m.id}
              member={m}
              sops={sops}
              onDelete={onDeleteStaff}
              onTrainingAdded={onReload}
              last={i === staff.length - 1}
            />
          ))}
        </Panel>
      )}
    </div>
  )
}

// ── VisitorTab ────────────────────────────────────────────────────────────────

function VisitorTab({ visitors, onReload, actionError }) {
  const [showForm, setShowForm] = useState(false)

  const hdr = { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {showForm ? (
        <VisitorForm
          onSaved={async () => { await onReload(); setShowForm(false) }}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowForm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: '#4ade80', color: '#0a0a0a', cursor: 'pointer' }}
          >
            <Plus size={13} /> Log Visitor
          </button>
        </div>
      )}

      {actionError && <div style={{ fontSize: 12, color: '#f87171' }}>{actionError}</div>}

      {visitors === null ? (
        <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '32px', textAlign: 'center' }}>Loading…</div>
      ) : visitors.length === 0 ? (
        <Panel>
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            No visitor logs yet. Use the button above to log a visit.
          </div>
        </Panel>
      ) : (
        <Panel fullWidth>
          <div style={{ display: 'flex', gap: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--border)', marginBottom: 2 }}>
            <span style={{ ...hdr, width: 90 }}>Date</span>
            <span style={{ ...hdr, width: 150 }}>Visitor Name</span>
            <span style={{ ...hdr, width: 130 }}>Organization</span>
            <span style={{ ...hdr, flex: 1 }}>Purpose</span>
            <span style={{ ...hdr, width: 120 }}>Host</span>
            <span style={{ ...hdr, width: 140 }}>Notes</span>
          </div>
          {visitors.map((v, i) => (
            <VisitorRow key={v.id} record={v} last={i === visitors.length - 1} />
          ))}
        </Panel>
      )}
    </div>
  )
}

function VisitorRow({ record, last }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: last ? 'none' : '0.5px solid var(--border)' }}>
      <span style={{ width: 90, fontSize: 11, color: 'var(--text-2)', flexShrink: 0 }}>{fmtDate(record.visit_date)}</span>
      <span style={{ width: 150, fontSize: 12, color: 'var(--text)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.visitor_name}</span>
      <span style={{ width: 130, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.organization ?? <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {record.purpose ?? <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span style={{ width: 120, fontSize: 12, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.host_name ?? <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span title={record.notes ?? undefined} style={{ width: 140, fontSize: 11, color: 'var(--text-3)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.notes ?? '—'}
      </span>
    </div>
  )
}

// ── StaffRecords ──────────────────────────────────────────────────────────────

export default function StaffRecords() {
  const [activeTab, setActiveTab]     = useState('staff')
  const [staff, setStaff]             = useState(null)
  const [visitors, setVisitors]       = useState(null)
  const [sops, setSops]               = useState([])
  const [actionError, setActionError] = useState(null)

  async function loadStaff() {
    try { setStaff(await fetchStaff()) } catch { setStaff([]) }
  }
  async function loadVisitors() {
    try { setVisitors(await fetchVisitorLog()) } catch { setVisitors([]) }
  }

  useEffect(() => {
    loadStaff()
    loadVisitors()
    fetchSOPs().then(setSops).catch(() => {})
  }, [])

  async function handleDeleteStaff(id) {
    if (!window.confirm('Delete this staff member and all their training records? This cannot be undone.')) return
    setActionError(null)
    try {
      await deleteStaff(id)
      setStaff(prev => prev ? prev.filter(m => m.id !== id) : prev)
    } catch (err) {
      setActionError(`Delete failed: ${err.message}`)
    }
  }

  const TAB_STYLE = (isActive) => ({
    padding: '6px 16px', fontSize: 12, fontWeight: isActive ? 600 : 400,
    border: 'none', borderRadius: 6, cursor: 'pointer',
    background: isActive ? 'rgba(74,222,128,0.15)' : 'transparent',
    color: isActive ? '#4ade80' : 'var(--text-2)',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 4, padding: '2px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, width: 'fit-content', border: '0.5px solid var(--border)' }}>
        <button style={TAB_STYLE(activeTab === 'staff')}    onClick={() => { setActiveTab('staff');    setActionError(null) }}>Staff</button>
        <button style={TAB_STYLE(activeTab === 'visitors')} onClick={() => { setActiveTab('visitors'); setActionError(null) }}>Visitors</button>
      </div>

      {activeTab === 'staff' ? (
        <StaffTab
          staff={staff}
          sops={sops}
          onReload={loadStaff}
          onDeleteStaff={handleDeleteStaff}
          actionError={actionError}
        />
      ) : (
        <VisitorTab
          visitors={visitors}
          onReload={loadVisitors}
          actionError={actionError}
        />
      )}
    </div>
  )
}
