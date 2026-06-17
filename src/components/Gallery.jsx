import { useState } from 'react'

const SCENE_OPTIONS = [
  { value: 'general',           label: 'General' },
  { value: 'indoor_artificial', label: 'Indoor' },
  { value: 'outdoor_daylight',  label: 'Outdoor' },
  { value: 'night_venue',       label: 'Night Venue' },
  { value: 'golden_hour',       label: 'Golden Hour' },
  { value: 'indoor_flash',      label: 'Flash' },
]

const SCENE_VALUES = new Set(SCENE_OPTIONS.map(o => o.value))

export default function Gallery({ photos, selectedIds, onSelectionChange, onDelete, onSceneChange }) {
  const [hoveredId, setHoveredId] = useState(null)

  const toggleAll = () => {
    if (selectedIds.size === photos.length) onSelectionChange(new Set())
    else onSelectionChange(new Set(photos.map(p => p.id)))
  }

  const toggleOne = (id) => {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    onSelectionChange(next)
  }

  if (!photos.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--text-3)', fontSize: 12 }}>
        No photos uploaded yet.
      </div>
    )
  }

  const allSelected = selectedIds.size === photos.length && photos.length > 0

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button
          onClick={toggleAll}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--text-2)', cursor: 'pointer',
            background: 'none', border: 'none', padding: '4px 0',
          }}
        >
          {allSelected ? (
            <>
              <svg viewBox="0 0 16 16" fill="none" width={13} height={13}>
                <rect x="1" y="1" width="14" height="14" rx="3" fill="var(--gold)" />
                <path d="M4 8l2.5 2.5 5-5" stroke="var(--bg-0)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Deselect all
            </>
          ) : (
            <>
              <svg viewBox="0 0 16 16" fill="none" width={13} height={13}>
                <rect x="1" y="1" width="14" height="14" rx="3" stroke="var(--gold-line-2)" />
              </svg>
              {`Select all (${photos.length})`}
            </>
          )}
        </button>

        {selectedIds.size > 0 && (
          <span style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: '0.06em' }}>
            {selectedIds.size} selected
          </span>
        )}
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 8,
      }}>
        {photos.map((photo) => {
          const isSelected = selectedIds.has(photo.id)
          const isHovered = hoveredId === photo.id
          const sceneValue = SCENE_VALUES.has(photo.lighting) ? photo.lighting : 'general'

          return (
            <div
              key={photo.id}
              onClick={() => toggleOne(photo.id)}
              onMouseEnter={() => setHoveredId(photo.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                position: 'relative',
                borderRadius: 8,
                overflow: 'hidden',
                cursor: 'pointer',
                border: isSelected ? '1.5px solid var(--gold)' : '1.5px solid transparent',
                boxShadow: isSelected ? '0 0 0 1px rgba(201,168,76,0.18)' : 'none',
                transition: 'border-color .18s ease, box-shadow .18s ease',
                background: 'var(--bg-2)',
              }}
            >
              {/* Thumbnail */}
              <div style={{ aspectRatio: '1', background: 'var(--bg-2)', position: 'relative' }}>
                {photo.thumb_url ? (
                  <img
                    src={photo.thumb_url}
                    alt={photo.filename}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                  />
                ) : (
                  <div style={{
                    width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-3)', fontSize: 10,
                  }}>
                    No preview
                  </div>
                )}

                {/* Bottom gradient */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%',
                  background: 'linear-gradient(to top, rgba(10,9,8,0.8) 0%, transparent 100%)',
                  pointerEvents: 'none',
                }} />

                {/* Checkbox */}
                <div style={{
                  position: 'absolute', top: 6, left: 6,
                  opacity: isSelected || isHovered ? 1 : 0,
                  transition: 'opacity .15s ease',
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: 3,
                    background: isSelected ? 'var(--gold)' : 'rgba(0,0,0,0.6)',
                    border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isSelected && (
                      <svg viewBox="0 0 10 10" fill="none" width={9} height={9}>
                        <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="var(--bg-0)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Delete */}
                {onDelete && isHovered && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(photo.id) }}
                    style={{
                      position: 'absolute', top: 6, right: 6,
                      width: 20, height: 20, borderRadius: 4,
                      background: 'rgba(196,75,58,0.85)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: 'none', cursor: 'pointer',
                    }}
                  >
                    <svg viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.4" strokeLinecap="round" width={9} height={9}>
                      <path d="M2 2l6 6M8 2l-6 6" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Info footer */}
              <div style={{ padding: '6px 7px', background: 'var(--bg-1)' }}>
                <p style={{
                  fontSize: 9, color: 'var(--text-2)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  marginBottom: 4, lineHeight: 1,
                }}>
                  {photo.filename}
                </p>
                <select
                  value={sceneValue}
                  onClick={e => e.stopPropagation()}
                  onChange={e => { e.stopPropagation(); onSceneChange?.(photo.id, e.target.value) }}
                  style={{
                    width: '100%', fontSize: 9,
                    background: 'var(--bg-2)', color: 'var(--text-2)',
                    border: '1px solid var(--gold-line)',
                    borderRadius: 3, padding: '2px 4px',
                    cursor: 'pointer', outline: 'none',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  {SCENE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
