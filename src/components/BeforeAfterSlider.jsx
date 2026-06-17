import { useState, useRef, useCallback, useEffect } from 'react'

// Conservative values — display preview only, not actual edits
function buildFilterString(preset) {
  if (!preset) return 'none'
  const e = preset.exposure   ?? 0
  const c = preset.contrast   ?? 0
  const s = preset.saturation ?? 0
  const w = preset.warmth     ?? 0
  const brightness = (1 + e * 0.25).toFixed(3)
  const contrast   = (1 + c * 0.20).toFixed(3)
  const saturate   = (1 + s * 0.40).toFixed(3)
  const sepia      = w > 0 ? (w * 0.15).toFixed(3) : '0'
  const hueRotate  = w !== 0 ? `hue-rotate(${(-w * 6).toFixed(1)}deg)` : ''
  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturate}) sepia(${sepia}) ${hueRotate}`.trim()
}

export default function BeforeAfterSlider({ beforeSrc, afterSrc, preset, photoId, filterOverride }) {
  const [position, setPosition] = useState(50)
  const isDragging = useRef(false)
  const containerRef = useRef(null)

  // Reset to centre whenever the photo or the processed result changes
  useEffect(() => {
    setPosition(50)
  }, [beforeSrc, afterSrc])

  const handleMouseDown = useCallback((e) => {
    e.preventDefault()
    isDragging.current = true
  }, [])

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
      setPosition((x / rect.width) * 100)
    }
    const handleMouseUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Simulation: no real "after" yet but a preset/direction is active
  const afterDisplaySrc = afterSrc || (preset || filterOverride ? beforeSrc : null)
  // filterOverride wins (live direction preview), then fall back to preset, then none
  const afterFilter     = filterOverride ?? (afterSrc ? 'none' : buildFilterString(preset))
  const isSimulation    = !afterSrc && !!(preset || filterOverride)

  // ── Empty state ────────────────────────────────────────────────
  if (!beforeSrc) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#4A4540', fontSize: 13,
        fontStyle: 'italic', fontFamily: '"Playfair Display", serif',
      }}>
        No photo selected
      </div>
    )
  }

  // ── No after/preset — show before only ────────────────────────
  if (!afterDisplaySrc) {
    return (
      // Outer: position:relative for overlay, no rendering properties
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* Image container — NO border-radius, NO background, NO border */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'transparent' }}>
          <img
            key={`before-${photoId}`}
            data-editor-image="before"
            src={beforeSrc}
            alt="before"
            decoding="sync"
            draggable={false}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'contain',
              objectPosition: 'center',
              // NOTHING ELSE — no filter, no transform, no imageRendering override
            }}
          />
        </div>
        {/* Rounded-corner overlay — on top of image, never under it */}
        <RoundedOverlay />
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 6,
          background: 'rgba(10,9,8,0.70)', borderRadius: 4, padding: '3px 10px',
          fontSize: 11, letterSpacing: '0.08em', color: '#8A8070',
          pointerEvents: 'none', fontFamily: 'Inter, sans-serif',
        }}>
          Select a preset to preview
        </div>
      </div>
    )
  }

  // ── Full before/after slider ───────────────────────────────────
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Image container — no border-radius, transparent bg, cursor only */}
      <div
        ref={containerRef}
        style={{
          position: 'absolute', inset: 0,
          background: 'transparent',
          overflow: 'hidden',
          cursor: 'col-resize',
          userSelect: 'none',
        }}
        onMouseDown={handleMouseDown}
      >
        {/* ── BEFORE ── absolutely no CSS effects on this image */}
        <img
          key={`before-${photoId}`}
          data-editor-image="before"
          src={beforeSrc}
          alt="before"
          decoding="sync"
          draggable={false}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'contain',
            objectPosition: 'center',
            // NOTHING ELSE
          }}
        />

        {/* ── AFTER ── clip the container, filter on the img inside */}
        <div style={{
          position: 'absolute', inset: 0,
          clipPath: `inset(0 0 0 ${position}%)`,
        }}>
          <img
            key={`after-${photoId}-${preset?.id ?? 'raw'}`}
            data-editor-image="after"
            src={afterDisplaySrc}
            alt="after"
            decoding="sync"
            draggable={false}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'contain',
              objectPosition: 'center',
              filter: afterFilter,
              transition: 'filter 300ms ease',
            }}
          />
        </div>

        {/* Divider line */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${position}%`, width: 1,
          background: 'rgba(201,168,76,0.9)',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
        }} />

        {/* Drag handle — backdrop-filter only on this element, not the image */}
        <div
          style={{
            position: 'absolute',
            left: `${position}%`, top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 38, height: 38, borderRadius: '50%',
            background: 'rgba(18,15,10,0.82)',
            border: '1px solid rgba(201,168,76,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'col-resize', zIndex: 10,
            userSelect: 'none',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M5 4L2 8L5 12M11 4L14 8L11 12" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Labels */}
        <div style={{
          position: 'absolute', top: 12, left: 12,
          background: 'rgba(10,9,8,0.70)', backdropFilter: 'blur(4px)',
          borderRadius: 4, padding: '3px 10px',
          fontSize: 11, letterSpacing: '0.08em', color: '#F0EBE0',
          pointerEvents: 'none',
        }}>BEFORE</div>
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(10,9,8,0.70)', backdropFilter: 'blur(4px)',
          borderRadius: 4, padding: '3px 10px',
          fontSize: 11, letterSpacing: '0.08em', color: '#C9A84C',
          pointerEvents: 'none',
        }}>{isSimulation ? 'PREVIEW' : 'AFTER'}</div>
      </div>

      {/* Rounded-corner overlay — sits on top, image is unaffected */}
      <RoundedOverlay />
    </div>
  )
}

// Border radius via an overlay — never applied to the image container itself
function RoundedOverlay() {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 5,
      borderRadius: 8,
      boxShadow: 'inset 0 0 0 1px rgba(201,168,76,0.12)',
      pointerEvents: 'none',
    }} />
  )
}
