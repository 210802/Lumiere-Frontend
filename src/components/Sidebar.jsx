import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { NavIcons } from './LumiereShared'

const STEPS = [
  { Icon: NavIcons.Upload,   label: 'Import',  path: '/upload',  step: 1 },
  { Icon: NavIcons.Train,    label: 'Train',   path: '/train',   step: 2 },
  { Icon: NavIcons.Edit,     label: 'Edit',    path: '/edit',    step: 3 },
  { Icon: NavIcons.Export,   label: 'Export',  path: '/export',  step: 4 },
]

const EXTRA_LINKS = [
  { Icon: NavIcons.Library, label: 'Library', path: '/library' },
]

export default function Sidebar() {
  const [expanded, setExpanded] = useState(false)
  const location = useLocation()
  const currentStep = STEPS.findIndex(s => s.path === location.pathname) + 1

  return (
    <div
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        position: 'fixed',
        left: 0,
        top: 56,
        bottom: 0,
        width: expanded ? 180 : 52,
        background: '#0A0908',
        borderRight: '1px solid rgba(201,168,76,0.08)',
        transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '0 8px',
        gap: 4,
      }}
    >
      {STEPS.map(({ Icon, label, path, step }) => {
        const isActive   = currentStep === step
        const isComplete = currentStep > step

        return (
          <Link key={path} to={path} style={{ textDecoration: 'none', width: '100%' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 8px',
                borderRadius: 10,
                borderLeft: isActive ? '2px solid #C9A84C' : '2px solid transparent',
                background: isActive ? 'rgba(201,168,76,0.10)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 150ms ease, border-color 150ms ease',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = 'rgba(201,168,76,0.05)'
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = 'transparent'
              }}
            >
              <div style={{ flexShrink: 0, width: 20, display: 'flex', justifyContent: 'center' }}>
                <Icon
                  width={18}
                  height={18}
                  style={{
                    color: isActive ? '#C9A84C' : isComplete ? '#8B6B3D' : '#4A4540',
                    flexShrink: 0,
                  }}
                />
              </div>
              <span style={{
                fontSize: 12,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? '#C9A84C' : isComplete ? '#8A8070' : '#4A4540',
                opacity: expanded ? 1 : 0,
                transition: 'opacity 180ms ease',
                transitionDelay: expanded ? '80ms' : '0ms',
                letterSpacing: '0.04em',
              }}>
                {label}
              </span>
            </div>
          </Link>
        )
      })}

      {/* Divider */}
      <div style={{ width: '100%', height: 1, background: 'rgba(201,168,76,0.07)', margin: '4px 0' }} />

      {EXTRA_LINKS.map(({ Icon, label, path }) => {
        const isActive = location.pathname === path
        return (
          <Link key={path} to={path} style={{ textDecoration: 'none', width: '100%' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 8px',
                borderRadius: 10,
                borderLeft: isActive ? '2px solid #C9A84C' : '2px solid transparent',
                background: isActive ? 'rgba(201,168,76,0.10)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 150ms ease, border-color 150ms ease',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(201,168,76,0.05)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ flexShrink: 0, width: 20, display: 'flex', justifyContent: 'center' }}>
                <Icon width={18} height={18} style={{ color: isActive ? '#C9A84C' : '#4A4540', flexShrink: 0 }} />
              </div>
              <span style={{
                fontSize: 12,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? '#C9A84C' : '#4A4540',
                opacity: expanded ? 1 : 0,
                transition: 'opacity 180ms ease',
                transitionDelay: expanded ? '80ms' : '0ms',
                letterSpacing: '0.04em',
              }}>
                {label}
              </span>
            </div>
          </Link>
        )
      })}

      {/* Version label */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontSize: 9,
        color: '#2A2520',
        letterSpacing: '0.05em',
      }}>
        v2.6
      </div>
    </div>
  )
}
