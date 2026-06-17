import { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import JSZip from 'jszip'
import { getProcessedResults, clearProcessedResults } from '../store/processedStore'

// ─── useCountUp hook ───────────────────────────────────────────────
function useCountUp(target, duration = 1400, decimals = 1) {
  const [current, setCurrent] = useState(0)
  useEffect(() => {
    if (!Number.isFinite(target) || target <= 0) return
    const start = performance.now()
    function update(time) {
      const elapsed = Math.min((time - start) / duration, 1)
      const eased   = 1 - Math.pow(1 - elapsed, 3)
      setCurrent(target * eased)
      if (elapsed < 1) requestAnimationFrame(update)
    }
    requestAnimationFrame(update)
  }, [target, duration])
  return current.toFixed(decimals)
}

function formatTime(minutes) {
  if (!Number.isFinite(minutes) || minutes < 0) return '—'
  if (minutes < 60) return `${Math.round(minutes)}m`
  return `${(minutes / 60).toFixed(1)}h`
}

// ─── Confetti ──────────────────────────────────────────────────────
function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 32 }, (_, i) => ({
    id: i,
    x:        Math.random() * 100,
    delay:    Math.random() * 1.5,
    duration: 1.8 + Math.random() * 1.8,
    color:    ['#C9A84C', '#C44B3A', '#F0EBE0', '#4A8C6A', '#8B6B3D'][i % 5],
    size:     4 + Math.random() * 5,
    rotation: Math.random() * 360,
    shape:    i % 3 === 0 ? 'circle' : i % 3 === 1 ? 'rect' : 'diamond',
    cx:       `${(Math.random() - 0.5) * 160}px`,
    cr:       `${Math.random() * 720 - 360}deg`,
  })), [])

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute', left: `${p.x}%`, top: -10,
          width: p.size,
          height: p.shape === 'rect' ? p.size * 2 : p.size,
          background: p.color, opacity: 0,
          borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'diamond' ? 0 : 2,
          transform: p.shape === 'diamond' ? 'rotate(45deg)' : `rotate(${p.rotation}deg)`,
          '--cx': p.cx, '--cr': p.cr,
          animation: `confettiFall ${p.duration}s ease-in ${p.delay}s both`,
        }} />
      ))}
    </div>
  )
}

const QUALITY_OPTIONS = [
  { id: 'web',     label: 'Web',     desc: 'JPEG 75% · ~1–2 MB/photo' },
  { id: 'high',    label: 'High',    desc: 'JPEG 90% · ~3–5 MB/photo' },
  { id: 'maximum', label: 'Maximum', desc: 'JPEG 97% · ~8–12 MB/photo' },
]

// ─── Main page ─────────────────────────────────────────────────────
export default function Export() {
  const location      = useLocation()
  const rawBatchId    = location.state?.batchId   || null
  const rawSessionId  = location.state?.sessionId || null

  const [summary, setSummary]         = useState(null)
  const [batchId, setBatchId]         = useState(rawBatchId)
  const [sessionId, setSessionId]     = useState(rawSessionId)
  const [quality, setQuality]         = useState('high')
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded]   = useState(false)
  const [error, setError]             = useState(null)
  const [zipping, setZipping]         = useState(false)

  // Whether we have client-side processed blobs ready
  const clientResults = getProcessedResults()
  const hasClientResults = clientResults.length > 0

  useEffect(() => {
    // Prefer client-side results (canvas-processed) over backend batch
    if (hasClientResults) {
      setSummary({
        processed: clientResults.length,
        total:     clientResults.length,
        styles:    [],
        results:   clientResults.map(r => ({
          id:        r.photo.id,
          thumb_url: r.photo.previewUrl,
        })),
        clientSide: true,
      })
      return
    }

    if (!rawBatchId) {
      try {
        const stored = JSON.parse(localStorage.getItem('lumiereExportStats') || 'null')
        if (stored) {
          if (stored.batchId)   setBatchId(stored.batchId)
          if (stored.sessionId) setSessionId(stored.sessionId)
          setSummary({
            processed:  stored.processedCount,
            total:      stored.processedCount,
            styles:     stored.styles || [],
            results:    stored.results || [],
            clientSide: stored.clientSide || false,
          })
        }
      } catch (_) {}
      return
    }

    fetch(`/process-batch/progress/${rawBatchId}`)
      .then(r => {
        if (!r.ok) return null
        const reader  = r.body.getReader()
        const decoder = new TextDecoder()
        return reader.read().then(({ value }) => {
          const text  = decoder.decode(value)
          const match = text.match(/data: (.+)/)
          return match ? JSON.parse(match[1]) : null
        })
      })
      .then(state => {
        if (!state) return
        const results    = state.results || []
        const successful = results.filter(r => !r.error)
        setSummary({
          processed: successful.length,
          total:     state.total,
          styles:    [...new Set(results.map(r => r.lighting).filter(Boolean))],
          results:   successful,
        })
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownload = async () => {
    setDownloading(true)
    setError(null)

    try {
      // ── Client-side ZIP from canvas blobs ─────────────────────────
      if (hasClientResults) {
        setZipping(true)
        const zip = new JSZip()

        for (const { photo, blob } of clientResults) {
          const origName = photo.filename || photo.file?.name || `photo_${photo.id}.jpg`
          const baseName = origName.replace(/\.[^.]+$/, '')
          zip.file(`lumiere_${baseName}_edited.jpg`, blob)
        }

        const content = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
        const a = document.createElement('a')
        a.href     = URL.createObjectURL(content)
        a.download = `lumiere_export_${new Date().toISOString().slice(0, 10)}.zip`
        a.click()
        URL.revokeObjectURL(a.href)
        clearProcessedResults()
        setZipping(false)
        setDownloaded(true)
        return
      }

      // ── Backend ZIP ───────────────────────────────────────────────
      const params = new URLSearchParams({ quality })
      if (batchId)   params.set('batch_id',   batchId)
      if (sessionId) params.set('session_id', sessionId)
      const res = await fetch(`/export?${params}`)
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const a    = document.createElement('a')
      a.href     = URL.createObjectURL(blob)
      a.download = `lumiere_export_${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(a.href)
      setDownloaded(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setDownloading(false)
      setZipping(false)
    }
  }

  const photoCount    = summary?.processed ?? 0
  const minutesSaved  = photoCount * 3
  const hoursSaved    = minutesSaved / 60

  const displayHrs    = useCountUp(hoursSaved,  1400, 1)
  const displayPhotos = useCountUp(photoCount,  800,  0)
  const displayMins   = useCountUp(minutesSaved, 1000, 0)

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 28px 64px', background: '#0A0908' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#8A8070', fontWeight: 500 }}>
          Deliver to client
        </div>
        <div style={{ fontSize: 10, color: '#4A4540', letterSpacing: '0.02em' }}>
          {summary?.clientSide ? 'Canvas-processed · 0.97 JPEG quality · local only' : 'Originals untouched · local only'}
        </div>
      </div>

      {/* ── Hero completion card ────────────────────────────────── */}
      <div style={{
        borderRadius: 16, overflow: 'hidden', position: 'relative',
        background: 'radial-gradient(ellipse 75% 65% at 22% 50%, #2D1A1A 0%, #1A0E0E 40%, #0A0908 100%)',
        border: '1px solid rgba(201,168,76,0.12)',
        padding: '40px 48px', minHeight: 280, marginBottom: 32,
      }}>
        <Confetti />
        <svg width="200" height="16" viewBox="0 0 200 16" style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', color: 'rgba(201,168,76,0.35)', pointerEvents: 'none' }}>
          <path d="M2 8 C 24 2, 48 14, 72 8 C 88 4, 100 12, 112 8 C 136 2, 160 14, 198 8"
            stroke="currentColor" strokeWidth="0.6" fill="none" />
          <circle cx="100" cy="8" r="1.4" fill="currentColor" />
          <circle cx="50"  cy="8" r="0.7" fill="currentColor" />
          <circle cx="150" cy="8" r="0.7" fill="currentColor" />
        </svg>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 40, alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.20em', textTransform: 'uppercase', color: '#8A8070', marginBottom: 8 }}>
              {summary?.clientSide ? 'Canvas · trained style applied' : 'Your wedding edit · complete'}
            </div>
            <div style={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: 18, color: '#F0EBE0', marginBottom: 4 }}>
              You saved
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
              <span className="num gold-text shimmer" style={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, fontSize: 88, lineHeight: 0.95, letterSpacing: '-0.02em' }}>
                {displayHrs}
              </span>
              <span style={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: 32, color: '#F0EBE0' }}>
                hrs
              </span>
            </div>
            <div style={{ display: 'flex', gap: 28 }}>
              {[
                { value: displayPhotos, label: 'PHOTOS PROCESSED' },
                { value: summary?.styles?.length ?? 0, label: summary?.clientSide ? 'CANVAS RUNS' : 'LIGHTING CONDITIONS' },
                { value: formatTime(minutesSaved), label: 'TIME RECLAIMED' },
              ].map(stat => (
                <div key={stat.label}>
                  <div className="num" style={{ fontSize: 20, fontFamily: '"Playfair Display", serif', color: '#F0EBE0' }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4A4540', marginTop: 2 }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {summary?.results?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {summary.results.slice(0, 12).map(r => (
                <div key={r.id} style={{
                  position: 'relative', width: 48, height: 48,
                  borderRadius: 5, overflow: 'hidden',
                  border: '1px solid rgba(201,168,76,0.15)', background: '#1A1712',
                }}>
                  {r.thumb_url && (
                    <img src={r.thumb_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  )}
                  <div style={{ position: 'absolute', bottom: 2, right: 2, width: 7, height: 7, borderRadius: '50%', background: '#4A8C6A', border: '1px solid #0A0908' }} />
                </div>
              ))}
              {summary.results.length > 12 && (
                <div style={{
                  width: 48, height: 48, borderRadius: 5,
                  background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: '#8A8070',
                }}>
                  +{summary.results.length - 12}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Quality + deliver grid ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

        {/* Quality picker (hidden for client-side — quality is fixed at 0.97) */}
        {!hasClientResults ? (
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.20em', textTransform: 'uppercase', color: '#4A4540', marginBottom: 14, fontWeight: 500 }}>
              Export Quality
            </div>
            {QUALITY_OPTIONS.map(opt => {
              const isActive = quality === opt.id
              return (
                <div
                  key={opt.id}
                  onClick={() => setQuality(opt.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '16px 20px', borderRadius: 10, cursor: 'pointer', marginBottom: 8,
                    background: isActive ? 'rgba(201,168,76,0.06)' : '#111009',
                    border: isActive ? '2px solid #C9A84C' : '1px solid rgba(201,168,76,0.15)',
                    transition: 'all 150ms ease',
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    border: isActive ? 'none' : '1.5px solid rgba(201,168,76,0.50)',
                    background: isActive ? '#C9A84C' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 150ms ease',
                  }}>
                    {isActive && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0A0908' }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: 17, color: '#F0EBE0', marginBottom: 2 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: '#8A8070' }}>{opt.desc}</div>
                  </div>
                  {isActive && (
                    <svg viewBox="0 0 14 14" fill="none" width={14} height={14}>
                      <path d="M2.5 7l3 3 6-6" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ padding: '24px 20px', background: '#111009', borderRadius: 10, border: '1px solid rgba(201,168,76,0.12)' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.20em', color: '#4A4540', marginBottom: 12 }}>CANVAS EXPORT SETTINGS</div>
            {[
              { label: 'Quality',    value: 'JPEG 97% (0.97 toBlob)' },
              { label: 'Processing', value: 'Client-side canvas' },
              { label: 'Resolution', value: 'Full natural resolution' },
              { label: 'Colour space', value: 'sRGB' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, marginBottom: 10 }}>
                <span style={{ color: '#4A4540' }}>{row.label}</span>
                <span style={{ color: '#F0EBE0', fontWeight: 500 }}>{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Deliver panel */}
        <div style={{
          background: '#111009', border: '1px solid rgba(201,168,76,0.15)',
          borderRadius: 12, padding: '20px',
        }}>
          <div style={{ fontSize: 9, letterSpacing: '0.20em', textTransform: 'uppercase', color: '#4A4540', marginBottom: 16, fontWeight: 500 }}>
            Package & Deliver
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 20 }}>
            {[
              { label: 'Format',   value: 'JPEG' },
              { label: 'Quality',  value: hasClientResults ? '97% (canvas)' : QUALITY_OPTIONS.find(o => o.id === quality)?.label || 'High' },
              { label: 'Archive',  value: 'ZIP' },
              { label: 'Naming',   value: hasClientResults ? 'lumiere_{name}_edited.jpg' : 'lumiere_export.zip' },
              { label: 'Upload',   value: 'None — local only' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: '#4A4540' }}>{row.label}</span>
                <span style={{ color: '#F0EBE0', fontWeight: 500 }}>{row.value}</span>
              </div>
            ))}
          </div>

          {!summary && !batchId && !hasClientResults && (
            <p style={{ fontSize: 11, color: '#4A4540', marginBottom: 16, lineHeight: 1.5 }}>
              Process photos in the Edit tab first, or download all uploaded photos.
            </p>
          )}

          {error && (
            <div style={{
              fontSize: 11, color: '#C44B3A',
              background: 'rgba(196,75,58,0.08)', border: '1px solid rgba(196,75,58,0.18)',
              borderRadius: 6, padding: '7px 10px', marginBottom: 12,
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{
              width: '100%',
              background: downloading ? '#2A2520' : 'linear-gradient(135deg, #C9A84C 0%, #A8893A 100%)',
              color: downloading ? '#4A4540' : '#1A1200',
              border: 'none', borderRadius: 6,
              padding: '11px 0', fontSize: 10, letterSpacing: '0.10em',
              textTransform: 'uppercase', fontWeight: 600,
              cursor: downloading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'Inter, sans-serif',
              transition: 'background .18s ease',
            }}
            onMouseEnter={e => { if (!downloading) e.currentTarget.style.boxShadow = '0 0 0 1px #C9A84C, 0 0 20px rgba(201,168,76,0.25)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
          >
            {downloaded ? (
              <>
                <svg viewBox="0 0 12 12" fill="none" width={11} height={11}>
                  <path d="M2 6l2.5 2.5 5.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Downloaded!
              </>
            ) : downloading ? (
              <>
                <div style={{ width: 12, height: 12, border: '2px solid rgba(201,168,76,0.20)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spinSlow 0.8s linear infinite' }} />
                {zipping ? 'Zipping…' : 'Preparing…'}
              </>
            ) : (
              <>
                {hasClientResults ? `Download ZIP (${clientResults.length})` : 'Download ZIP'}
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" width={11} height={11}>
                  <path d="M6 2v7M6 9l-3-3M6 9l3-3M1 11h10"/>
                </svg>
              </>
            )}
          </button>

          {downloaded && (
            <p style={{ textAlign: 'center', fontSize: 9, color: '#4A4540', marginTop: 8, letterSpacing: '0.06em' }}>
              Check your downloads folder
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
