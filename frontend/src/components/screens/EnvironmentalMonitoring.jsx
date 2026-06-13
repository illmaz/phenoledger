import { useState, useEffect } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { Panel, Grid, StatCard, Badge } from '../ui'
import {
  fetchGrowRooms, createGrowRoom, deleteGrowRoom,
  fetchEnvironmentalLogs, createEnvironmentalLog, deleteEnvironmentalLog,
} from '../../api'

const ROOM_TYPES = ['veg', 'flower', 'mother', 'clone', 'drying', 'other']
const ROOM_TYPE_LABEL = {
  veg: 'Veg', flower: 'Flower', mother: 'Mother', clone: 'Clone', drying: 'Drying', other: 'Other',
}
const ROOM_TYPE_VARIANT = {
  veg: 'ok', flower: 'purple', mother: 'info', clone: 'info', drying: 'warn', other: 'gray',
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtRange(min, max, unit) {
  if (min == null && max == null) return '—'
  if (min == null) return `—–${max}${unit}`
  if (max == null) return `${min}–—${unit}`
  return `${min}–${max}${unit}`
}

function isOutOfRange(log) {
  return (log.temp_max != null && log.temp_max > 30) ||
         (log.humidity_max != null && log.humidity_max > 70)
}

// ── GrowRoomSection ───────────────────────────────────────────────────────────

function GrowRoomSection({ rooms, onRoomAdded, onRoomDeleted }) {
  const EMPTY = { name: '', room_type: 'veg', capacity_plants: '' }
  const [form, setForm]       = useState(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Room name is required'); return }
    setSaving(true); setError('')
    try {
      await createGrowRoom({
        name:             form.name.trim(),
        room_type:        form.room_type,
        capacity_plants:  form.capacity_plants ? parseInt(form.capacity_plants, 10) : null,
      })
      setForm(EMPTY)
      setShowAdd(false)
      await onRoomAdded()
    } catch (err) {
      setError(err?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const inp = {
    padding: '5px 8px', fontSize: 12, boxSizing: 'border-box',
    border: '0.5px solid var(--border)', borderRadius: 6,
    background: 'var(--bg)', color: 'var(--text)', outline: 'none',
  }
  const hdr = { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }

  return (
    <Panel title="Grow Rooms" titleRight={
      !showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, padding: '4px 10px', border: 'none', borderRadius: 5,
            background: '#4ade80', color: '#0a0a0a', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={11} /> Add Room
        </button>
      )
    }>
      {rooms.length === 0 && !showAdd ? (
        <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>No grow rooms registered yet.</div>
      ) : (
        <>
          {rooms.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: 12, paddingBottom: 6, borderBottom: '0.5px solid var(--border)', marginBottom: 2 }}>
                <span style={{ ...hdr, flex: 1 }}>Name</span>
                <span style={{ ...hdr, width: 80 }}>Type</span>
                <span style={{ ...hdr, width: 80 }}>Capacity</span>
                <span style={{ width: 28 }} />
              </div>
              {rooms.map((r, i) => (
                <GrowRoomRow key={r.id} room={r} onDelete={onRoomDeleted} last={i === rooms.length - 1 && !showAdd} />
              ))}
            </>
          )}

          {showAdd && (
            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: rooms.length > 0 ? 10 : 0, flexWrap: 'wrap' }}
            >
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 3 }}>Name *</div>
                <input style={{ ...inp, width: 160 }} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Room A" required />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 3 }}>Type</div>
                <select style={{ ...inp, width: 110 }} value={form.room_type} onChange={e => set('room_type', e.target.value)}>
                  {ROOM_TYPES.map(t => <option key={t} value={t}>{ROOM_TYPE_LABEL[t]}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 3 }}>Capacity (plants)</div>
                <input style={{ ...inp, width: 110 }} type="number" min="0" value={form.capacity_plants} onChange={e => set('capacity_plants', e.target.value)} placeholder="Optional" />
              </div>
              {error && <span style={{ fontSize: 11, color: '#f87171', alignSelf: 'center' }}>{error}</span>}
              <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                <button type="button" onClick={() => { setShowAdd(false); setError('') }} style={{ ...inp, width: 'auto', cursor: 'pointer', color: 'var(--text-2)' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ ...inp, width: 'auto', background: saving ? '#2d6e4a' : '#4ade80', color: '#0a0a0a', fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving…' : 'Add'}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </Panel>
  )
}

function GrowRoomRow({ room, onDelete, last }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '7px 0', borderBottom: last ? 'none' : '0.5px solid var(--border)' }}
    >
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{room.name}</span>
      <span style={{ width: 80, flexShrink: 0 }}>
        <Badge variant={ROOM_TYPE_VARIANT[room.room_type] ?? 'gray'}>{ROOM_TYPE_LABEL[room.room_type] ?? room.room_type}</Badge>
      </span>
      <span style={{ width: 80, fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {room.capacity_plants != null ? `${room.capacity_plants} plants` : <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <div style={{ width: 28, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        {hovered && (
          <button onClick={() => onDelete(room.id)} title="Delete" style={{ padding: '2px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#f87171', display: 'flex', alignItems: 'center' }}>
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── LogForm ───────────────────────────────────────────────────────────────────

function LogForm({ rooms, onSaved, onCancel }) {
  const EMPTY = {
    grow_room_id: '', log_date: '', temp_min: '', temp_max: '',
    humidity_min: '', humidity_max: '', co2_ppm: '', vpd: '', notes: '',
  }
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.log_date) { setError('Date is required'); return }
    setSaving(true); setError('')
    try {
      await createEnvironmentalLog({
        grow_room_id:  form.grow_room_id  || null,
        log_date:      form.log_date,
        temp_min:      form.temp_min      ? parseFloat(form.temp_min)      : null,
        temp_max:      form.temp_max      ? parseFloat(form.temp_max)      : null,
        humidity_min:  form.humidity_min  ? parseFloat(form.humidity_min)  : null,
        humidity_max:  form.humidity_max  ? parseFloat(form.humidity_max)  : null,
        co2_ppm:       form.co2_ppm       ? parseFloat(form.co2_ppm)       : null,
        vpd:           form.vpd           ? parseFloat(form.vpd)           : null,
        notes:         form.notes         || null,
      })
      setForm(EMPTY)
      await onSaved()
    } catch (err) {
      setError(err?.message || 'Failed to save')
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
    <Panel title="Log Environment">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Row 1: Room / Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Grow Room</label>
            <select style={inp} value={form.grow_room_id} onChange={e => set('grow_room_id', e.target.value)}>
              <option value="">— None —</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Date *</label>
            <input style={inp} type="date" value={form.log_date} onChange={e => set('log_date', e.target.value)} required />
          </div>
        </div>

        {/* Row 2: Temp Min / Temp Max / Humidity Min / Humidity Max */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Temp Min (°C)</label>
            <input style={inp} type="number" step="0.1" value={form.temp_min} onChange={e => set('temp_min', e.target.value)} placeholder="e.g. 20" />
          </div>
          <div>
            <label style={lbl}>Temp Max (°C)</label>
            <input style={inp} type="number" step="0.1" value={form.temp_max} onChange={e => set('temp_max', e.target.value)} placeholder="e.g. 28" />
          </div>
          <div>
            <label style={lbl}>Humidity Min (%)</label>
            <input style={inp} type="number" step="0.1" min="0" max="100" value={form.humidity_min} onChange={e => set('humidity_min', e.target.value)} placeholder="e.g. 50" />
          </div>
          <div>
            <label style={lbl}>Humidity Max (%)</label>
            <input style={inp} type="number" step="0.1" min="0" max="100" value={form.humidity_max} onChange={e => set('humidity_max', e.target.value)} placeholder="e.g. 65" />
          </div>
        </div>

        {/* Row 3: CO2 / VPD */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>CO₂ (ppm)</label>
            <input style={inp} type="number" step="1" value={form.co2_ppm} onChange={e => set('co2_ppm', e.target.value)} placeholder="e.g. 1200" />
          </div>
          <div>
            <label style={lbl}>VPD (kPa)</label>
            <input style={inp} type="number" step="0.01" value={form.vpd} onChange={e => set('vpd', e.target.value)} placeholder="e.g. 1.2" />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label style={lbl}>Notes</label>
          <textarea
            style={{ ...inp, resize: 'vertical', minHeight: 56, fontFamily: 'inherit' }}
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
          <button type="button" onClick={onCancel} style={{ padding: '7px 14px', fontSize: 12, border: '0.5px solid var(--border)', borderRadius: 6, background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="submit" disabled={saving} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: saving ? '#2d6e4a' : '#4ade80', color: '#0a0a0a', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : 'Log Environment'}
          </button>
        </div>
      </form>
    </Panel>
  )
}

// ── LogRow ────────────────────────────────────────────────────────────────────

function LogRow({ record, roomMap, onDelete, last }) {
  const [hovered, setHovered] = useState(false)
  const alert = isOutOfRange(record)
  const roomName = record.grow_room_id ? (roomMap[record.grow_room_id] ?? '—') : '—'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', gap: 12, alignItems: 'center',
        padding: '8px 0', paddingLeft: alert ? 8 : 0,
        borderBottom: last ? 'none' : '0.5px solid var(--border)',
        borderLeft: alert ? '2px solid #fbbf24' : '2px solid transparent',
      }}
    >
      <span style={{ width: 90, fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {fmtDate(record.log_date)}
      </span>
      <span style={{ width: 100, fontSize: 12, color: 'var(--text)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {roomName}
      </span>
      <span style={{ width: 100, fontSize: 12, color: record.temp_max > 30 ? '#fbbf24' : 'var(--text-2)', flexShrink: 0 }}>
        {fmtRange(record.temp_min, record.temp_max, '°C')}
      </span>
      <span style={{ width: 100, fontSize: 12, color: record.humidity_max > 70 ? '#fbbf24' : 'var(--text-2)', flexShrink: 0 }}>
        {fmtRange(record.humidity_min, record.humidity_max, '%')}
      </span>
      <span style={{ width: 70, fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {record.co2_ppm != null ? `${record.co2_ppm}` : <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span style={{ width: 60, fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>
        {record.vpd != null ? record.vpd : <span style={{ color: 'var(--text-3)' }}>—</span>}
      </span>
      <span title={record.notes ?? undefined} style={{ flex: 1, fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {record.notes ?? '—'}
      </span>
      <div style={{ width: 28, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        {hovered && (
          <button onClick={() => onDelete(record.id)} title="Delete" style={{ padding: '2px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#f87171', display: 'flex', alignItems: 'center' }}>
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── EnvironmentalMonitoring ───────────────────────────────────────────────────

export default function EnvironmentalMonitoring() {
  const [rooms, setRooms]             = useState([])
  const [logs, setLogs]               = useState(null)
  const [roomFilter, setRoomFilter]   = useState('')
  const [showForm, setShowForm]       = useState(false)
  const [actionError, setActionError] = useState(null)

  async function loadRooms() {
    try { setRooms(await fetchGrowRooms()) } catch { setRooms([]) }
  }

  async function loadLogs() {
    try {
      const filters = roomFilter ? { grow_room_id: roomFilter } : {}
      setLogs(await fetchEnvironmentalLogs(filters))
    } catch {
      setLogs([])
    }
  }

  useEffect(() => { loadRooms() }, [])
  useEffect(() => { setLogs(null); loadLogs() }, [roomFilter])

  async function handleDeleteRoom(id) {
    if (!window.confirm('Delete this grow room? This cannot be undone.')) return
    setActionError(null)
    try {
      await deleteGrowRoom(id)
      setRooms(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      setActionError(`Delete failed: ${err.message}`)
    }
  }

  async function handleDeleteLog(id) {
    if (!window.confirm('Delete this log entry? This cannot be undone.')) return
    setActionError(null)
    try {
      await deleteEnvironmentalLog(id)
      setLogs(prev => prev ? prev.filter(l => l.id !== id) : prev)
    } catch (err) {
      setActionError(`Delete failed: ${err.message}`)
    }
  }

  const roomMap = Object.fromEntries(rooms.map(r => [r.id, r.name]))

  const hdr = { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }

  const data        = logs ?? []
  const outOfRange  = data.filter(isOutOfRange).length
  const avgTempMax  = data.length
    ? (data.reduce((s, l) => s + (l.temp_max ?? 0), 0) / data.filter(l => l.temp_max != null).length || 0).toFixed(1)
    : '—'
  const avgHumMax   = data.length
    ? (data.reduce((s, l) => s + (l.humidity_max ?? 0), 0) / data.filter(l => l.humidity_max != null).length || 0).toFixed(1)
    : '—'

  const inp = {
    padding: '6px 10px', fontSize: 12,
    border: '0.5px solid var(--border)', borderRadius: 6,
    background: 'var(--card)', color: 'var(--text)', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Grow Rooms */}
      <GrowRoomSection
        rooms={rooms}
        onRoomAdded={loadRooms}
        onRoomDeleted={handleDeleteRoom}
      />

      {actionError && (
        <div style={{ fontSize: 12, color: '#f87171' }}>{actionError}</div>
      )}

      {/* Log form / button */}
      {showForm ? (
        <LogForm
          rooms={rooms}
          onSaved={async () => { await loadLogs(); setShowForm(false) }}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', fontSize: 12, fontWeight: 600,
              border: 'none', borderRadius: 6,
              background: '#4ade80', color: '#0a0a0a', cursor: 'pointer',
            }}
          >
            <Plus size={13} /> Log Environment
          </button>
        </div>
      )}

      {/* Stats */}
      {logs && logs.length > 0 && (
        <Grid cols={4} gap={8}>
          <StatCard label="Total Logs"      value={logs.length} />
          <StatCard label="Avg Temp Max"    value={avgTempMax === '—' ? '—' : `${avgTempMax}°C`} />
          <StatCard label="Avg Humidity Max" value={avgHumMax === '—' ? '—' : `${avgHumMax}%`} />
          <StatCard label="Out of Range"    value={outOfRange} subVariant={outOfRange > 0 ? 'warn' : undefined} />
        </Grid>
      )}

      {/* Filter */}
      {rooms.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--text-3)' }}>Filter by room:</label>
          <select style={{ ...inp }} value={roomFilter} onChange={e => setRoomFilter(e.target.value)}>
            <option value="">All rooms</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      )}

      {/* Logs table */}
      {logs === null ? (
        <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '32px', textAlign: 'center' }}>Loading…</div>
      ) : logs.length === 0 ? (
        <Panel>
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            {roomFilter ? 'No logs for this room.' : 'No environmental logs yet. Use the button above to log one.'}
          </div>
        </Panel>
      ) : (
        <Panel fullWidth>
          <div style={{ display: 'flex', gap: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--border)', marginBottom: 2, paddingLeft: 10 }}>
            <span style={{ ...hdr, width: 90 }}>Date</span>
            <span style={{ ...hdr, width: 100 }}>Room</span>
            <span style={{ ...hdr, width: 100 }}>Temp (°C)</span>
            <span style={{ ...hdr, width: 100 }}>Humidity (%)</span>
            <span style={{ ...hdr, width: 70 }}>CO₂ ppm</span>
            <span style={{ ...hdr, width: 60 }}>VPD</span>
            <span style={{ ...hdr, flex: 1 }}>Notes</span>
            <span style={{ ...hdr, width: 28 }} />
          </div>
          {logs.map((l, i) => (
            <LogRow
              key={l.id}
              record={l}
              roomMap={roomMap}
              onDelete={handleDeleteLog}
              last={i === logs.length - 1}
            />
          ))}
        </Panel>
      )}
    </div>
  )
}
