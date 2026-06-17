import { useLocation, useNavigate } from 'react-router-dom'

const STEP_META = {
  '/upload': { step: 1, title: 'Import & detect',  subtitle: 'Bring in the raw shoot, set the scene',       cta: 'CONTINUE TO TRAIN', next: '/train' },
  '/train':  { step: 2, title: 'Match your pairs', subtitle: 'Show the engine your edited photos',           cta: 'CONTINUE TO EDIT',  next: '/edit'  },
  '/edit':   { step: 3, title: 'Apply the look',   subtitle: 'Choose a preset and batch process',            cta: 'CONTINUE TO EXPORT',next: '/export' },
  '/export': { step: 4, title: 'Export & deliver', subtitle: 'Package and send to client',                   cta: null,                next: null     },
}

export default function TopBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const meta = STEP_META[pathname] || STEP_META['/upload']

  return (
    <nav style={{
      height: 56,
      display: 'flex',
      alignItems: 'center',
      paddingLeft: 16,
      paddingRight: 20,
      background: '#0A0908',
      borderBottom: '1px solid rgba(201,168,76,0.10)',
      flexShrink: 0,
      position: 'relative',
      zIndex: 10,
    }}>

      {/* LEFT: Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 160, flexShrink: 0 }}>
        <span style={{
          fontFamily: '"Playfair Display", serif',
          fontSize: 24, color: '#C9A84C', fontStyle: 'italic', lineHeight: 1,
          userSelect: 'none',
        }}>ℒ</span>
        <div>
          <div style={{ fontSize: 12, letterSpacing: '0.22em', color: '#8A8070', fontWeight: 500, lineHeight: 1 }}>
            Studio de 
          </div>
          <div style={{ fontSize: 8, letterSpacing: '0.32em', color: '#4A4540', marginTop: 2, lineHeight: 1 }}>
            Lumière Créative
          </div>
        </div>
      </div>

      {/* CENTER: Step title */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.16em', color: '#4A4540', marginBottom: 1, fontWeight: 500 }}>
          STEP {meta.step} OF 4
        </div>
        <div style={{
          fontFamily: '"Playfair Display", serif',
          fontSize: 20, fontStyle: 'italic',
          color: '#F0EBE0', letterSpacing: '-0.01em', lineHeight: 1.1,
        }}>
          {meta.title}
        </div>
        <div style={{ fontSize: 11, color: '#8A8070', marginTop: 2, letterSpacing: '0.01em' }}>
          {meta.subtitle}
        </div>
      </div>

      {/* RIGHT: CTA */}
      <div style={{ width: 160, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
        {meta.cta && meta.next && (
          <button
            onClick={() => navigate(meta.next)}
            style={{
              background: 'linear-gradient(135deg, #C9A84C 0%, #A8893A 100%)',
              color: '#1A1200',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 10,
              letterSpacing: '0.10em',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 7,
              transition: 'box-shadow 200ms ease, filter 150ms ease',
              boxShadow: 'inset 0 1px 0 rgba(255,236,180,0.25)',
              fontFamily: 'Inter, sans-serif',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = '0 0 0 1px #C9A84C, 0 0 20px rgba(201,168,76,0.30)'
              e.currentTarget.style.filter = 'brightness(1.06)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,236,180,0.25)'
              e.currentTarget.style.filter = 'none'
            }}
          >
            {meta.cta}
            <svg viewBox="0 0 10 10" fill="none" width={9} height={9}>
              <path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </nav>
  )
}
