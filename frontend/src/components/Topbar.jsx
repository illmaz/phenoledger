import { useRef, useState } from 'react'
import { Bell, Upload, ChevronRight, LogOut } from 'lucide-react'
import { uploadCOA } from '../api'

export default function Topbar({ breadcrumb, onUploadSuccess, onLogout }) {
  const [section, page] = breadcrumb
  const fileRef = useRef()
  const [uploadState, setUploadState] = useState(null) // null | 'uploading' | 'ok' | 'error'
  const [feedback, setFeedback] = useState('')

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setUploadState('uploading')
    setFeedback('')
    try {
      const data = await uploadCOA(file)
      setUploadState('ok')
      setFeedback(`${data.compounds_extracted} compounds extracted`)
      onUploadSuccess?.()
      setTimeout(() => setUploadState(null), 4000)
    } catch (err) {
      setUploadState('error')
      setFeedback(err.message)
      setTimeout(() => setUploadState(null), 5000)
    }
  }

  const feedbackColor = uploadState === 'ok' ? '#4ade80' : uploadState === 'error' ? '#f87171' : 'var(--text-2)'

  return (
    <div style={{
      height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', borderBottom: '0.5px solid var(--border)', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
        {section}
        <ChevronRight size={10} />
        <span style={{ color: 'var(--text)', fontWeight: 500 }}>{page}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {uploadState && (
          <span style={{ fontSize: 11, color: feedbackColor }}>
            {uploadState === 'uploading' ? 'Uploading…' : feedback}
          </span>
        )}
        <button style={{
          fontSize: 11, padding: '4px 10px', border: '0.5px solid var(--border)',
          borderRadius: 6, background: 'transparent', color: 'var(--text-2)',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <Bell size={13} />
        </button>
        <button
          onClick={onLogout}
          title="Sign out"
          style={{
            fontSize: 11, padding: '4px 10px', border: '0.5px solid var(--border)',
            borderRadius: 6, background: 'transparent', color: 'var(--text-2)',
            display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
          }}
        >
          <LogOut size={13} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploadState === 'uploading'}
          style={{
            fontSize: 11, padding: '4px 10px', border: 'none',
            borderRadius: 6,
            background: uploadState === 'uploading' ? '#2d6e4a' : '#4ade80',
            color: '#0a0a0a', fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            cursor: uploadState === 'uploading' ? 'not-allowed' : 'pointer',
            opacity: uploadState === 'uploading' ? 0.7 : 1,
          }}
        >
          <Upload size={13} />
          {uploadState === 'uploading' ? 'Uploading…' : 'Upload COA'}
        </button>
      </div>
    </div>
  )
}
