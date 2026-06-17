import { useEffect, useRef } from 'react'

// ─── PAISLEY HAIRLINE DIVIDER ──────────────────────────────────────
export function PaisleyDivider({ style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'rgba(201,168,76,0.45)', ...style }}>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.20), transparent)' }} />
      <svg width="42" height="14" viewBox="0 0 42 14" fill="none" aria-hidden="true">
        <path d="M2 7 C 8 1, 14 1, 17 7 C 18.5 10, 21 11, 23 7 C 25 3, 27.5 4, 29 7 C 32 13, 38 13, 40 7"
          stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" fill="none" />
        <circle cx="13" cy="6.2" r="0.8" fill="currentColor" />
        <circle cx="29" cy="7.6" r="0.6" fill="currentColor" />
      </svg>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.20), transparent)' }} />
    </div>
  )
}

// ─── MARCHING-ANTS BORDER (SVG) ────────────────────────────────────
export function MarchingBorder({ radius = 12, color = 'rgba(201,168,76,0.4)', stroke = 1.2, dash = '6 4', breathe = false }) {
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <rect
        x="0.6" y="0.6" width="calc(100% - 1.2px)" height="calc(100% - 1.2px)"
        rx={radius} ry={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={dash}
        style={{
          animation: breathe
            ? 'marchingAnts 8s linear infinite, borderBreath 4s ease-in-out infinite'
            : 'marchingAnts 8s linear infinite',
        }}
      />
    </svg>
  )
}

// ─── COUNT UP ANIMATION ────────────────────────────────────────────
export function CountUp({ to, dur = 1200, decimals = 0, style, className }) {
  const ref = useRef(null)
  useEffect(() => {
    let start = null
    const from = 0
    const step = (ts) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / dur, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      const val = from + (to - from) * ease
      if (ref.current) ref.current.textContent = val.toFixed(decimals)
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [to, dur, decimals])
  return <span ref={ref} style={style} className={className}>{(0).toFixed(decimals)}</span>
}

// ─── SECTION LABEL ─────────────────────────────────────────────────
export function SectionLabel({ children, style }) {
  return (
    <div style={{
      fontSize: 10,
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      color: 'var(--text-2)',
      fontFamily: 'var(--font-ui)',
      fontWeight: 500,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ─── LIGHTING BADGE ────────────────────────────────────────────────
const BADGE_COLORS = {
  general:           { bg: 'rgba(138,128,112,0.18)', text: '#8A8070', border: 'rgba(138,128,112,0.25)' },
  indoor_artificial: { bg: 'rgba(123,143,168,0.18)', text: '#7B8FA8', border: 'rgba(123,143,168,0.25)' },
  outdoor_daylight:  { bg: 'rgba(74,140,106,0.18)', text: '#4A8C6A', border: 'rgba(74,140,106,0.25)' },
  night_venue:       { bg: 'rgba(80,60,100,0.25)',  text: '#9B7EC8', border: 'rgba(155,126,200,0.25)' },
  golden_hour:       { bg: 'rgba(201,168,76,0.18)', text: '#C9A84C', border: 'rgba(201,168,76,0.25)' },
  indoor_flash:      { bg: 'rgba(196,75,58,0.15)',  text: '#C44B3A', border: 'rgba(196,75,58,0.22)' },
}

export function LightingBadge({ value }) {
  const LABELS = {
    general: 'General', indoor_artificial: 'Indoor', outdoor_daylight: 'Outdoor',
    night_venue: 'Night', golden_hour: 'Golden', indoor_flash: 'Flash',
  }
  const c = BADGE_COLORS[value] || BADGE_COLORS.general
  return (
    <span style={{
      fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
      padding: '2px 6px', borderRadius: 4,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      fontWeight: 500,
    }}>
      {LABELS[value] || value}
    </span>
  )
}

// ─── CAMERA ICON (with pulsing light-ray arcs) ────────────────────
export function CameraIcon({ size = 64, className = '', style }) {
  return (
    <svg
      viewBox="0 0 64 56"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
      style={style}
    >
      <path d="M8 18h7l3-5h22l3 5h7a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V21a3 3 0 0 1 3-3z" />
      <circle cx="32" cy="31" r="9" />
      <circle cx="32" cy="31" r="4.5" />
      <g transform="translate(41 31)">
        <path d="M 0 -5 a 2 2 0 0 1 4 -2.8" style={{ animation: 'arcPulse 2s ease-in-out infinite', transformOrigin: '0 0' }} />
        <path d="M 0 0 a 4 4 0 0 1 6 0" style={{ animation: 'arcPulse 2s ease-in-out infinite .3s', transformOrigin: '0 0' }} />
        <path d="M 0 5 a 2 2 0 0 0 4 2.8" style={{ animation: 'arcPulse 2s ease-in-out infinite .6s', transformOrigin: '0 0' }} />
      </g>
    </svg>
  )
}

// ─── NAV ICONS ────────────────────────────────────────────────────
export const NavIcons = {
  Upload: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 16V4M12 4l-5 5M12 4l5 5" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  ),
  Train: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4 L 16.5 9 M 19.5 8.5 L 15.5 13 M 19.5 15.5 L 13 13 M 12 20 L 10.5 14 M 4.5 15.5 L 10 12.5 M 4.5 8.5 L 11 11 M 12 4 L 11 11" />
    </svg>
  ),
  Edit: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 6h11M19 6h1M4 12h1M9 12h11M4 18h13M19 18h1" />
      <circle cx="17" cy="6" r="2" />
      <circle cx="7" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  ),
  Export: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 4v12M12 16l-5-5M12 16l5-5" />
      <path d="M4 20h16" />
    </svg>
  ),
  Library: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
}

// ─── LOGO ─────────────────────────────────────────────────────────
export function LumiereLogo({ compact = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 2 : 4 }}>
      <div style={{
        width: compact ? 28 : 32,
        height: compact ? 28 : 32,
        borderRadius: compact ? 8 : 10,
        background: 'linear-gradient(135deg, #C9A84C 0%, #A8893A 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 12px rgba(201,168,76,0.25)',
      }}>
        <svg viewBox="0 0 24 24" fill="none" width={compact ? 14 : 16} height={compact ? 14 : 16}>
          <circle cx="12" cy="12" r="4" fill="#1A1200" />
          <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"
            stroke="#1A1200" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
      {!compact && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 600, lineHeight: 1 }}>
            Lumiere
          </div>
        </div>
      )}
    </div>
  )
}
