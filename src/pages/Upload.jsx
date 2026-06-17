import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const ACCEPTED = 'image/*,.cr2,.nef,.arw,.dng'

const LIGHTING_COLORS = {
  'general':           '#8A8070',
  'indoor_artificial': '#7B8FA8',
  'outdoor_daylight':  '#4A8C6A',
  'night_venue':       '#9B7EC8',
  'golden_hour':       '#C9A84C',
  'indoor_flash':      '#C44B3A',
}
const LIGHTING_LABELS = {
  general:           'General',
  indoor_artificial: 'Indoor',
  outdoor_daylight:  'Outdoor',
  night_venue:       'Night',
  golden_hour:       'Golden Hour',
  indoor_flash:      'Flash',
}

const SCENE_OPTIONS = [
  { value: 'general',           label: 'General',     color: '#8A8070' },
  { value: 'indoor_artificial', label: 'Indoor',      color: '#7B8FA8' },
  { value: 'outdoor_daylight',  label: 'Outdoor',     color: '#4A8C6A' },
  { value: 'night_venue',       label: 'Night Venue', color: '#9B7EC8' },
  { value: 'golden_hour',       label: 'Golden Hour', color: '#C9A84C' },
  { value: 'indoor_flash',      label: 'Flash',       color: '#C44B3A' },
]

function countByLighting(photos) {
  const counts = {}
  photos.forEach(p => {
    const key = p.lighting || p.scene || 'general'
    counts[key] = (counts[key] || 0) + 1
  })
  return counts
}

function getImageDimensions(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = reject
    img.src = url
  })
}

async function validateFiles(files) {
  const accepted = [], rejected = [], warnings = []
  for (const file of files) {
    if (file.size < 50_000) {
      rejected.push({ file, reason: `Too small (${Math.round(file.size / 1024)}KB). Minimum 50KB — originals only.` })
      continue
    }
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      try {
        const dims = await getImageDimensions(url)
        URL.revokeObjectURL(url)
        const longEdge  = Math.max(dims.width, dims.height)
        const shortEdge = Math.min(dims.width, dims.height)
        if (longEdge < 800 || shortEdge < 600) {
          rejected.push({ file, reason: `Too low-res: ${dims.width}×${dims.height}px. Minimum 800×600px.` })
          continue
        }
        const bytesPerPixel = file.size / (dims.width * dims.height)
        if (bytesPerPixel < 0.15 && file.type === 'image/jpeg') {
          warnings.push({ file, message: `Appears heavily compressed. Import from camera for best results.` })
        }
      } catch {
        URL.revokeObjectURL(url)
      }
    }
    accepted.push(file)
  }
  return { accepted, rejected, warnings }
}

export default function Upload() {
  const [photos, setPhotos]               = useState([])
  const [selectedIds, setSelectedIds]     = useState(new Set())
  const [isDragging, setIsDragging]       = useState(false)
  const [uploading, setUploading]         = useState(false)
  const [error, setError]                 = useState(null)
  const [pendingValidation, setPendingValidation] = useState(null)
  const inputRef          = useRef(null)
  const sessionStartedRef = useRef(false)
  const sessionIdRef      = useRef(null)
  const navigate          = useNavigate()

  const hasPhotos = photos.length > 0

  const processAccepted = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles.length) return
    setUploading(true)
    setError(null)

    // Immediately show local previews
    const tempPhotos = acceptedFiles.map(file => ({
      id: crypto.randomUUID(),
      _tempId: true,
      file,
      previewUrl: URL.createObjectURL(file),
      filename: file.name,
      format: file.name.split('.').pop()?.toUpperCase() || 'JPG',
      size: file.size,
      lighting: 'general',
    }))
    setPhotos(prev => {
      const existingNames = new Set(prev.map(p => p.filename))
      return [...prev, ...tempPhotos.filter(t => !existingNames.has(t.filename))]
    })

    // Clear backend workspace at the start of each new upload session and assign a session ID
    if (!sessionStartedRef.current) {
      sessionStartedRef.current = true
      sessionIdRef.current = crypto.randomUUID().replace(/-/g, '')
      await fetch('https://lumiere-backend-xscg.onrender.com/workspace/clear', { method: 'DELETE' }).catch(() => {})
    }

    // Upload to backend for metadata
    const form = new FormData()
    acceptedFiles.forEach(f => form.append('files', f))
    try {
      const res = await fetch('https://lumiere-backend-xscg.onrender.com/upload', { method: 'POST', body: form })
      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`)
      const data = await res.json()
      if (data.errors?.length) {
        setError(`${data.errors.length} file(s) skipped`)
      }
      // Merge backend metadata, preserve local previewUrl
      setPhotos(prev => prev.map(p => {
        if (!p._tempId) return p
        const srv = data.uploaded.find(s => s.filename === p.filename)
        if (!srv) return p
        return { ...srv, previewUrl: p.previewUrl, file: p.file }
      }))
    } catch (err) {
      setError(err.message)
      setPhotos(prev => prev.filter(p => !p._tempId))
    } finally {
      setUploading(false)
    }
  }, [])

  const uploadFiles = useCallback(async (files) => {
    if (!files.length) return
    setError(null)
    const fileArray = Array.from(files)
    const result = await validateFiles(fileArray)
    if (result.rejected.length > 0 || result.warnings.length > 0) {
      setPendingValidation(result)
      return
    }
    processAccepted(result.accepted)
  }, [processAccepted])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
      .filter(f => /\.(jpe?g|png|cr2|nef|arw|dng)$/i.test(f.name))
    uploadFiles(files)
  }, [uploadFiles])

  const handleDelete = useCallback((id) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === id)
      if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl)
      if (photo && !photo._tempId) {
        fetch(`https://lumiere-backend-xscg.onrender.com/photos/${photo.id}`, { method: 'DELETE' }).catch(() => {})
      }
      return prev.filter(p => p.id !== id)
    })
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
  }, [])

  const toggleOne = (id) => {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedIds(next)
  }

  const handleProceed = () => {
    const ids = selectedIds.size > 0 ? selectedIds : new Set(photos.map(p => p.id))
    // Pass photos with previewUrls to Edit page
    const selectedPhotos = photos.filter(p => ids.has(p.id))
    navigate('/edit', { state: { selectedIds: [...ids], photos: selectedPhotos, sessionId: sessionIdRef.current } })
  }

  const lightingCounts = countByLighting(photos)

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#0A0908', display: 'flex', flexDirection: 'column' }}>

      {/* Validation modal */}
      {pendingValidation && (
        <ImportValidationModal
          result={pendingValidation}
          onAccept={() => {
            const accepted = pendingValidation.accepted
            setPendingValidation(null)
            processAccepted(accepted)
          }}
          onDismiss={() => setPendingValidation(null)}
        />
      )}

      {/* Drop zone */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        style={{
          margin: '16px 20px 0',
          height: hasPhotos ? 64 : 'calc(100vh - 56px - 32px - 60px)',
          minHeight: hasPhotos ? 64 : 360,
          borderRadius: 12,
          background: '#111009',
          position: 'relative',
          overflow: 'hidden',
          cursor: uploading ? 'default' : 'pointer',
          transition: 'height 280ms ease-out',
          flexShrink: 0,
        }}
      >
        {/* Marching-ants border */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <rect
            x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)"
            rx="11" ry="11" fill="none"
            stroke={isDragging ? 'rgba(201,168,76,0.70)' : 'rgba(201,168,76,0.35)'}
            strokeWidth="1" strokeDasharray="8 5"
            style={{ animation: 'marchingAnts 12s linear infinite' }}
          />
        </svg>

        {hasPhotos ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            {uploading ? (
              <>
                <div style={{ width: 14, height: 14, border: '2px solid rgba(201,168,76,0.20)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spinSlow 0.8s linear infinite' }} />
                <span style={{ fontSize: 13, color: '#C9A84C' }}>Uploading…</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="#4A4540" strokeWidth="1.2" strokeLinecap="round" width={18} height={18}>
                  <path d="M9 6l3-3 3 3M12 3v10" />
                </svg>
                <span style={{ fontSize: 13, color: '#4A4540' }}>Drop more frames here</span>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Breathing radial glow */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse 55% 45% at 50% 58%, rgba(201,168,76,0.09) 0%, transparent 65%)',
              animation: 'breathe 4s ease-in-out infinite',
              pointerEvents: 'none',
            }} />

            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
            }}>
              {uploading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 48, height: 48, border: '2px solid rgba(201,168,76,0.18)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spinSlow 0.9s linear infinite' }} />
                  <span style={{ fontSize: 13, color: '#C9A84C', letterSpacing: '0.08em' }}>Uploading…</span>
                </div>
              ) : (
                <>
                  {/* Camera + light rays */}
                  <div style={{ position: 'relative', width: 56, height: 56 }}>
                    <svg viewBox="0 0 64 56" fill="none" stroke="#C9A84C" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
                      width={48} height={48} style={{ opacity: isDragging ? 1 : 0.75 }}>
                      <path d="M8 18h7l3-5h22l3 5h7a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V21a3 3 0 0 1 3-3z" />
                      <circle cx="32" cy="31" r="9" />
                      <circle cx="32" cy="31" r="4.5" />
                    </svg>
                    {[-35, 0, 35].map((deg, i) => (
                      <div key={i} style={{
                        position: 'absolute', top: '42%', left: '60%',
                        width: 9, height: 1.5,
                        background: 'rgba(201,168,76,0.75)', borderRadius: 2,
                        transformOrigin: '0 50%',
                        transform: `rotate(${deg}deg) translateX(4px)`,
                        animation: `rayPulse 2s ease-in-out ${i * 0.35}s infinite`,
                      }} />
                    ))}
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontFamily: '"Playfair Display", serif',
                      fontSize: 26, fontStyle: 'italic',
                      color: isDragging ? '#C9A84C' : '#F0EBE0',
                      marginBottom: 8, transition: 'color .2s ease',
                    }}>
                      {isDragging ? 'Drop to upload' : 'Drop your shoot to begin'}
                    </div>
                    <div style={{ fontSize: 13, color: '#8A8070' }}>
                      or{' '}
                      <span style={{ color: '#C9A84C', borderBottom: '1px solid rgba(201,168,76,0.4)', cursor: 'pointer' }}>
                        browse from your library
                      </span>
                    </div>
                  </div>

                  {/* Feature pills */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    {['RAW SUPPORTED', 'LOCAL · NEVER UPLOADED', 'FULL RESOLUTION ONLY', 'ZERO RECOMPRESSION'].map((text, i, arr) => (
                      <span key={text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 9, letterSpacing: '0.10em', color: '#4A4540' }}>{text}</span>
                        {i < arr.length - 1 && <span style={{ color: '#8B6B3D', fontSize: 7 }}>◆</span>}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          style={{ display: 'none' }}
          onChange={e => uploadFiles(e.target.files)}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{
          margin: '8px 20px 0',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11, color: '#C44B3A',
          background: 'rgba(196,75,58,0.08)', border: '1px solid rgba(196,75,58,0.20)',
          borderRadius: 6, padding: '8px 12px',
        }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" width={13} height={13}>
            <circle cx="8" cy="8" r="7" /><path d="M8 5v3.5M8 10.5v.5" />
          </svg>
          {error}
        </div>
      )}

      {/* Post-upload stats */}
      {hasPhotos && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '14px 20px 6px' }}>
            <span style={{
              fontFamily: '"Playfair Display", serif',
              fontSize: 36, color: '#C9A84C',
              fontVariantNumeric: 'tabular-nums', lineHeight: 1,
            }}>
              {photos.length}
            </span>
            <span style={{ fontSize: 14, color: '#8A8070' }}>
              frame{photos.length !== 1 ? 's' : ''} detected
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
              {selectedIds.size > 0 && selectedIds.size < photos.length && (
                <span style={{ fontSize: 11, color: '#C9A84C' }}>{selectedIds.size} selected</span>
              )}
              <button
                onClick={() => {
                  if (selectedIds.size === photos.length) setSelectedIds(new Set())
                  else setSelectedIds(new Set(photos.map(p => p.id)))
                }}
                style={{
                  fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: '#4A4540', cursor: 'pointer',
                  background: 'none', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 4,
                  padding: '4px 8px',
                }}
              >
                {selectedIds.size === photos.length ? 'Deselect all' : 'Select all'}
              </button>
              <button
                onClick={handleProceed}
                style={{
                  background: 'linear-gradient(135deg, #C9A84C 0%, #A8893A 100%)',
                  color: '#1A1200', border: 'none', borderRadius: 6,
                  padding: '7px 16px', fontSize: 10, letterSpacing: '0.10em',
                  fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                EDIT PHOTOS
                <svg viewBox="0 0 10 10" fill="none" width={9} height={9}>
                  <path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Lighting summary pills */}
          {Object.keys(lightingCounts).length > 0 && (
            <div style={{ display: 'flex', gap: 6, padding: '0 20px 12px', flexWrap: 'wrap' }}>
              {Object.entries(lightingCounts).map(([type, count]) => (
                <div key={type} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 99, padding: '4px 10px',
                  fontSize: 10, letterSpacing: '0.08em', color: '#F0EBE0',
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: LIGHTING_COLORS[type] || '#8A8070', flexShrink: 0 }} />
                  {LIGHTING_LABELS[type] || type.toUpperCase()} {count}
                </div>
              ))}
            </div>
          )}

          {/* Photo grid */}
          <div style={{
            padding: '0 20px 32px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 10,
          }}>
            {photos.map((photo, i) => (
              <div key={photo.id} style={{ animation: `slideUp 260ms ease-out ${i * 40}ms both` }}>
                <PhotoCard
                  photo={photo}
                  selected={selectedIds.has(photo.id)}
                  onSelect={toggleOne}
                  onDelete={handleDelete}
                />
              </div>
            ))}

            {/* Add more card */}
            <div
              onClick={() => inputRef.current?.click()}
              style={{
                borderRadius: 10, aspectRatio: '4/3',
                border: '1px solid rgba(201,168,76,0.20)',
                background: '#111009', position: 'relative', overflow: 'hidden',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', gap: 2,
                transition: 'border-color .18s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(201,168,76,0.50)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(201,168,76,0.20)'}
            >
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                <rect x="1" y="1" width="calc(100% - 2)" height="calc(100% - 2)" rx="9"
                  fill="none" stroke="rgba(201,168,76,0.30)" strokeWidth="1" strokeDasharray="6 4"
                  style={{ animation: 'marchingAnts 14s linear infinite' }} />
              </svg>
              <span style={{ fontFamily: '"Playfair Display", serif', fontSize: 24, color: '#C9A84C' }}>+</span>
              <span style={{ fontSize: 9, letterSpacing: '0.12em', color: '#4A4540', textTransform: 'uppercase', marginTop: 2 }}>
                Add more
              </span>
            </div>
          </div>
        </>
      )}

      {/* Format strip (empty state only) */}
      {!hasPhotos && (
        <div style={{
          marginTop: 'auto', height: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
          padding: '0 20px',
          borderTop: '1px solid rgba(201,168,76,0.06)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {['CR2', 'NEF', 'ARW', 'DNG', 'JPG (full res)', 'PNG'].map((fmt, i, arr) => (
                <span key={fmt} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9, letterSpacing: '0.14em', color: '#4A4540' }}>{fmt}</span>
                  {i < arr.length - 1 && <span style={{ fontSize: 7, color: '#8B6B3D', opacity: 0.5 }}>◆</span>}
                </span>
              ))}
            </div>
            <span style={{ fontSize: 9, color: '#2A2520', letterSpacing: '0.04em' }}>
              Minimum 800×600px · 50KB · Originals only — no social downloads or thumbnails
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Photo card ────────────────────────────────────────────────────
function PhotoCard({ photo, selected, onSelect, onDelete }) {
  const [hovered, setHovered]             = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dropdownOpen, setDropdownOpen]   = useState(false)
  const [dropdownPos, setDropdownPos]     = useState({ top: 0, right: 0 })
  const [scene, setScene]                 = useState(photo.lighting || photo.scene || 'general')
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!dropdownOpen) return
    const close = () => setDropdownOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [dropdownOpen])

  const selectedOpt = SCENE_OPTIONS.find(o => o.value === scene) || SCENE_OPTIONS[0]
  const ext = (photo.filename || photo.name || '').split('.').pop()?.toUpperCase() || 'JPG'
  const thumbSrc = photo.previewUrl || photo.thumb_url

  const handleDropdownToggle = (e) => {
    e.stopPropagation()
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setDropdownOpen(prev => !prev)
  }

  const handleSceneChange = (value) => {
    setScene(value)
    setDropdownOpen(false)
    // Sync to backend if photo has a real ID
    if (photo.id && !photo._tempId) {
      fetch(`https://lumiere-backend-xscg.onrender.com/photos/${photo.id}/scene`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lighting: value }),
      }).catch(() => {})
    }
  }

  return (
    <div
      style={{
        borderRadius: 10, overflow: 'hidden', position: 'relative',
        background: '#111009', aspectRatio: '4/3',
        transform: hovered && !confirmDelete ? 'translateY(-3px)' : 'none',
        boxShadow: hovered
          ? '0 12px 32px rgba(0,0,0,0.55)'
          : selected
            ? '0 0 0 2px #C9A84C, 0 4px 16px rgba(0,0,0,0.4)'
            : '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'all 200ms ease',
        border: selected ? '2px solid #C9A84C' : '1px solid rgba(201,168,76,0.08)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmDelete(false) }}
    >
      {/* Thumbnail — use local previewUrl first for quality */}
      {thumbSrc ? (
        <img
          src={thumbSrc}
          alt={photo.filename}
          decoding="async"
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4A4540', fontSize: 11 }}>
          {photo._tempId ? (
            <div style={{ width: 20, height: 20, border: '2px solid rgba(201,168,76,0.20)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spinSlow 0.8s linear infinite' }} />
          ) : 'No preview'}
        </div>
      )}

      {/* Footer gradient */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
        background: 'linear-gradient(to top, rgba(10,9,8,0.95) 0%, rgba(10,9,8,0.6) 55%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Format badge top-left */}
      <div style={{
        position: 'absolute', top: 7, left: 7,
        background: 'rgba(10,9,8,0.70)', borderRadius: 3, padding: '2px 5px',
        fontSize: 9, color: '#8A8070', letterSpacing: '0.08em',
        backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.07)',
      }}>
        {ext}
      </div>

      {/* Delete button — top-right on hover */}
      {hovered && !confirmDelete && (
        <button
          onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
          style={{
            position: 'absolute', top: 7, right: 7,
            width: 22, height: 22, borderRadius: '50%',
            background: 'rgba(196,75,58,0.85)', border: '1px solid rgba(196,75,58,0.5)',
            color: '#F0EBE0', fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)', animation: 'fadeIn 150ms ease',
          }}
        >
          ✕
        </button>
      )}

      {/* Selection ring — top-right when not hovering */}
      {!hovered && (
        <button
          onClick={e => { e.stopPropagation(); onSelect(photo.id) }}
          style={{
            position: 'absolute', top: 7, right: 7,
            width: 20, height: 20, borderRadius: '50%',
            background: selected ? '#C9A84C' : 'rgba(255,255,255,0.10)',
            border: selected ? 'none' : '1.5px solid rgba(255,255,255,0.22)',
            backdropFilter: 'blur(2px)',
            color: selected ? '#0A0908' : 'transparent',
            fontSize: 10, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 180ms ease',
            animation: selected ? 'checkPop .2s ease-out' : 'none',
          }}
        >
          {selected && (
            <svg viewBox="0 0 10 10" fill="none" width={9} height={9}>
              <path d="M2 5l2.2 2.2 3.8-4.2" stroke="#0A0908" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      )}

      {/* Delete confirm overlay */}
      {confirmDelete && (
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(10,9,8,0.88)', backdropFilter: 'blur(4px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
            animation: 'fadeIn 150ms ease',
          }}
          onClick={e => e.stopPropagation()}
        >
          <span style={{ fontSize: 12, color: '#F0EBE0' }}>Remove photo?</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={e => { e.stopPropagation(); onDelete(photo.id) }}
              style={{ padding: '6px 16px', borderRadius: 5, border: 'none', background: '#C44B3A', color: '#F0EBE0', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}
            >
              Remove
            </button>
            <button
              onClick={e => { e.stopPropagation(); setConfirmDelete(false) }}
              style={{ padding: '6px 16px', borderRadius: 5, border: '1px solid rgba(201,168,76,0.25)', background: 'transparent', color: '#8A8070', fontSize: 11, cursor: 'pointer' }}
            >
              Keep
            </button>
          </div>
        </div>
      )}

      {/* Card footer: filename + scene selector */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontSize: 10, color: '#8A8070',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50%',
          }}>
            {photo.filename || photo.name}
          </span>

          {/* Scene selector */}
          <div style={{ position: 'relative' }}>
            <button
              ref={triggerRef}
              onClick={handleDropdownToggle}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(201,168,76,0.2)',
                borderRadius: 99, padding: '3px 8px',
                cursor: 'pointer', fontSize: 10,
                color: '#F0EBE0', letterSpacing: '0.06em',
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: selectedOpt.color, flexShrink: 0 }} />
              {selectedOpt.label.toUpperCase()}
              <span style={{ color: '#4A4540', marginLeft: 2, fontSize: 8 }}>▾</span>
            </button>

            {dropdownOpen && (
              <div
                onMouseDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'fixed', top: dropdownPos.top, right: dropdownPos.right, zIndex: 9999,
                  background: '#1A1712',
                  border: '1px solid rgba(201,168,76,0.2)',
                  borderRadius: 8, overflow: 'hidden',
                  minWidth: 140,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                }}
              >
                {SCENE_OPTIONS.map(opt => (
                  <div
                    key={opt.value}
                    onClick={() => handleSceneChange(opt.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', cursor: 'pointer',
                      background: scene === opt.value ? 'rgba(201,168,76,0.08)' : 'transparent',
                      fontSize: 11, color: scene === opt.value ? '#C9A84C' : '#8A8070',
                      transition: 'background 120ms ease',
                    }}
                    onMouseEnter={e => { if (scene !== opt.value) e.currentTarget.style.background = 'rgba(201,168,76,0.04)' }}
                    onMouseLeave={e => { if (scene !== opt.value) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: opt.color }} />
                    {opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Import validation modal ───────────────────────────────────────
function ImportValidationModal({ result, onAccept, onDismiss }) {
  const { accepted, rejected, warnings } = result
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,9,8,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#111009',
        border: '1px solid rgba(201,168,76,0.2)',
        borderRadius: 16, padding: '32px 36px',
        maxWidth: 520, width: '90%',
        maxHeight: '88vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
      }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: '"Playfair Display"', fontStyle: 'italic', fontSize: 22, color: '#F0EBE0', marginBottom: 6 }}>
            Import quality check
          </div>
          <div style={{ fontSize: 13, color: '#8A8070', lineHeight: 1.6 }}>
            Lumiere preserves your files exactly as imported. Only full-resolution originals are accepted.
          </div>
        </div>

        {rejected.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.1em', color: '#C44B3A', marginBottom: 8 }}>
              ✕ {rejected.length} FILE{rejected.length > 1 ? 'S' : ''} REJECTED
            </div>
            <div style={{ background: 'rgba(196,75,58,0.06)', border: '1px solid rgba(196,75,58,0.2)', borderRadius: 8, overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
              {rejected.map(({ file, reason }) => (
                <div key={file.name} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(196,75,58,0.1)', fontSize: 12 }}>
                  <div style={{ color: '#F0EBE0', marginBottom: 3, fontWeight: 500 }}>{file.name}</div>
                  <div style={{ color: '#C44B3A', fontSize: 11 }}>{reason}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.1em', color: '#C9A84C', marginBottom: 8 }}>
              ⚠ {warnings.length} WARNING{warnings.length > 1 ? 'S' : ''}
            </div>
            <div style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 8, overflow: 'hidden' }}>
              {warnings.map(({ file, message }) => (
                <div key={file.name} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(201,168,76,0.08)', fontSize: 11, color: '#8A8070', lineHeight: 1.5 }}>
                  <span style={{ color: '#C9A84C', fontWeight: 500 }}>{file.name}: </span>
                  {message}
                </div>
              ))}
            </div>
          </div>
        )}

        {accepted.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 24, padding: '10px 14px',
            background: 'rgba(74,140,106,0.08)', border: '1px solid rgba(74,140,106,0.2)',
            borderRadius: 8, fontSize: 12,
          }}>
            <span style={{ color: '#4A8C6A', fontSize: 14 }}>✓</span>
            <span style={{ color: '#8A8070' }}>
              <span style={{ color: '#F0EBE0', fontWeight: 500 }}>{accepted.length} file{accepted.length > 1 ? 's' : ''} </span>
              ready to import at full quality
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onDismiss}
            style={{
              padding: '10px 20px', borderRadius: 8,
              background: 'transparent', border: '1px solid rgba(201,168,76,0.2)',
              color: '#8A8070', fontSize: 12, cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)'; e.currentTarget.style.color = '#C9A84C' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.2)'; e.currentTarget.style.color = '#8A8070' }}
          >
            Cancel
          </button>
          {accepted.length > 0 && (
            <button
              onClick={onAccept}
              style={{
                padding: '10px 24px', borderRadius: 8,
                background: 'linear-gradient(135deg, #C9A84C 0%, #A8893A 100%)',
                border: 'none', color: '#1A1200',
                fontSize: 12, letterSpacing: '0.08em', fontWeight: 600, cursor: 'pointer',
                transition: 'box-shadow 200ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 20px rgba(201,168,76,0.3)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
            >
              Import {accepted.length} file{accepted.length > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
