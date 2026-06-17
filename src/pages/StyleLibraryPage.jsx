import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  loadAllStyles, deleteStyle, duplicateStyle, toggleFavorite,
  updateStyleName, exportStyleAsJSON, importStyleFromFile, recordUsage, loadThumb,
} from '../store/styleStorage'
import { RadarChart } from '../components/RadarChart'

// ── Shared button styles ──────────────────────────────────────────────

const goldBtn = {
  background: 'linear-gradient(135deg,#C9A84C,#A8893A)',
  border: 'none', color: '#1A1200',
  padding: '9px 18px', borderRadius: 8,
  fontSize: 11, letterSpacing: '0.1em', fontWeight: 600, cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
}

const ghostBtn = {
  background: 'transparent', border: '1px solid rgba(201,168,76,0.25)',
  color: '#8A8070', padding: '9px 18px', borderRadius: 8,
  fontSize: 11, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
}

const iconBtn = {
  width: 34, height: 34, borderRadius: 8,
  background: '#1A1712', border: '1px solid rgba(201,168,76,0.12)',
  color: '#8A8070', fontSize: 13, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'Inter, sans-serif',
}

// ── Main page ─────────────────────────────────────────────────────────

export function StyleLibraryPage() {
  const navigate = useNavigate()
  const [styles, setStyles]           = useState([])
  const [search, setSearch]           = useState('')
  const [sortBy, setSortBy]           = useState('date')  // date | name | usage | confidence
  const [filterFav, setFilterFav]     = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [compareIds, setCompareIds]   = useState([])
  const [comparing, setComparing]     = useState(false)
  const importRef = useRef(null)

  const refresh = () => setStyles(loadAllStyles())

  useEffect(() => { refresh() }, [])

  const filtered = styles
    .filter(s => !filterFav || s.isFavorite)
    .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.aiDescription ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'date')       return (b.createdAt ?? 0) - (a.createdAt ?? 0)
      if (sortBy === 'name')       return a.name.localeCompare(b.name)
      if (sortBy === 'usage')      return (b.usageCount ?? 0) - (a.usageCount ?? 0)
      if (sortBy === 'confidence') return (b.confidence ?? 0) - (a.confidence ?? 0)
      return 0
    })

  const handleApply = (style) => {
    recordUsage(style.id)
    refresh()
    navigate('/edit')
  }

  return (
    <div style={{ padding: '28px', minHeight: '100vh', background: '#0A0908', overflowY: 'auto', height: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: 30, color: '#F0EBE0' }}>
            My Trained Styles
          </div>
          <div style={{ fontSize: 13, color: '#8A8070', marginTop: 4 }}>
            {styles.length} style{styles.length !== 1 ? 's' : ''} in your library
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              await importStyleFromFile(f)
              refresh()
              e.target.value = ''
            }}
          />
          <button onClick={() => importRef.current?.click()} style={ghostBtn}>↑ Import</button>
          <button
            onClick={() => { setComparing(p => !p); setCompareIds([]) }}
            style={comparing ? goldBtn : ghostBtn}
          >
            {comparing ? 'Cancel Compare' : '⇄ Compare'}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search styles…"
          style={{
            flex: 1, minWidth: 180, background: '#111009',
            border: '1px solid rgba(201,168,76,0.2)',
            borderRadius: 8, padding: '9px 14px', fontSize: 13, color: '#F0EBE0', outline: 'none',
            fontFamily: 'Inter, sans-serif',
          }}
        />
        {['date', 'name', 'usage', 'confidence'].map(s => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            style={{
              padding: '7px 14px', borderRadius: 99, fontSize: 10, cursor: 'pointer',
              background: sortBy === s ? 'rgba(201,168,76,0.15)' : 'transparent',
              border: `1px solid ${sortBy === s ? 'rgba(201,168,76,0.4)' : 'rgba(201,168,76,0.12)'}`,
              color: sortBy === s ? '#C9A84C' : '#4A4540',
              fontFamily: 'Inter, sans-serif',
              transition: 'all 150ms ease',
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <button
          onClick={() => setFilterFav(p => !p)}
          style={{
            padding: '7px 14px', borderRadius: 99, fontSize: 10, cursor: 'pointer',
            background: filterFav ? 'rgba(201,168,76,0.15)' : 'transparent',
            border: `1px solid ${filterFav ? 'rgba(201,168,76,0.4)' : 'rgba(201,168,76,0.12)'}`,
            color: filterFav ? '#C9A84C' : '#4A4540',
            fontFamily: 'Inter, sans-serif',
            transition: 'all 150ms ease',
          }}
        >
          {filterFav ? '★ Favorites' : '☆ Favorites'}
        </button>
      </div>

      {/* Compare hint */}
      {comparing && (
        <div style={{
          marginBottom: 20, padding: '12px 16px', borderRadius: 8,
          background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)',
          fontSize: 12, color: '#8A8070',
        }}>
          Select 2 styles to compare · {compareIds.length}/2 selected
          {compareIds.length === 1 && ' — select one more'}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#4A4540' }}>
          <div style={{ fontSize: 48, marginBottom: 16, color: 'rgba(201,168,76,0.2)' }}>✦</div>
          <div style={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: 20, color: '#8A8070', marginBottom: 8 }}>
            {styles.length === 0 ? 'No styles yet' : 'No matches'}
          </div>
          <div style={{ fontSize: 13, color: '#4A4540' }}>
            {styles.length === 0
              ? 'Train your first style on the Train page'
              : 'Try a different search term or clear the filter'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 20 }}>
          {filtered.map(style => (
            <StyleCard
              key={style.id}
              style={style}
              comparing={comparing}
              selectedForCompare={compareIds.includes(style.id)}
              onToggleCompare={() => setCompareIds(prev =>
                prev.includes(style.id)
                  ? prev.filter(id => id !== style.id)
                  : prev.length < 2 ? [...prev, style.id] : prev
              )}
              onDelete={() => setDeleteTarget(style)}
              onDuplicate={() => { duplicateStyle(style.id); refresh() }}
              onToggleFav={() => { toggleFavorite(style.id); refresh() }}
              onExport={() => exportStyleAsJSON(style)}
              onRename={name => { updateStyleName(style.id, name); refresh() }}
              onApply={() => handleApply(style)}
            />
          ))}
        </div>
      )}

      {/* Side-by-side compare panel */}
      {comparing && compareIds.length === 2 && (
        <StyleComparePanel
          styleA={styles.find(s => s.id === compareIds[0])}
          styleB={styles.find(s => s.id === compareIds[1])}
          onClose={() => { setComparing(false); setCompareIds([]) }}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteModal
          styleName={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => { deleteStyle(deleteTarget.id); refresh(); setDeleteTarget(null) }}
        />
      )}
    </div>
  )
}

// ── Style card ────────────────────────────────────────────────────────

function StyleCard({
  style, comparing, selectedForCompare, onToggleCompare,
  onDelete, onDuplicate, onToggleFav, onExport, onRename, onApply,
}) {
  const [thumb, setThumb]       = useState(null)
  const [editing, setEditing]   = useState(false)
  const [nameVal, setNameVal]   = useState(style.name)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    loadThumb(style.id).then(url => { if (url) setThumb(url) })
  }, [style.id])

  const dominantColors = style.params?.dominantColors ?? []

  return (
    <div style={{
      background: '#111009', borderRadius: 14, overflow: 'hidden',
      border: `1px solid ${selectedForCompare ? '#C9A84C' : 'rgba(201,168,76,0.12)'}`,
      boxShadow: selectedForCompare
        ? '0 0 0 2px rgba(201,168,76,0.3)'
        : '0 2px 12px rgba(0,0,0,0.3)',
      transition: 'all 200ms ease',
    }}>

      {/* Thumbnail area */}
      <div
        style={{ position: 'relative', height: 156, background: '#0A0908', cursor: comparing ? 'pointer' : 'default' }}
        onClick={comparing ? onToggleCompare : undefined}
      >
        {thumb ? (
          <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'radial-gradient(ellipse at 40% 50%, rgba(201,168,76,0.1), transparent 70%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 36, color: 'rgba(201,168,76,0.2)' }}>✦</span>
          </div>
        )}

        {/* Status badge */}
        <div style={{
          position: 'absolute', top: 10, left: 10, borderRadius: 99, padding: '3px 10px',
          background: style.status === 'ready' ? 'rgba(74,140,106,0.9)' : 'rgba(201,168,76,0.9)',
          fontSize: 9, letterSpacing: '0.1em',
          color: style.status === 'ready' ? '#F0EBE0' : '#1A1200',
        }}>
          {style.status === 'ready' ? '● READY' : '◌ PROCESSING'}
        </div>

        {/* Favorite star */}
        <button
          onClick={e => { e.stopPropagation(); onToggleFav() }}
          style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(10,9,8,0.7)', border: 'none', borderRadius: '50%',
            width: 32, height: 32, cursor: 'pointer', fontSize: 16,
            color: style.isFavorite ? '#C9A84C' : '#4A4540',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {style.isFavorite ? '★' : '☆'}
        </button>

        {/* Compare selected overlay */}
        {comparing && selectedForCompare && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(201,168,76,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: '#C9A84C', color: '#0A0908',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 700,
            }}>✓</div>
          </div>
        )}

        {/* Dominant color swatches */}
        {dominantColors.length > 0 && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', height: 4 }}>
            {dominantColors.slice(0, 5).map((c, i) => (
              <div key={i} style={{ flex: 1, background: c }} />
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '16px 16px 10px' }}>
        {editing ? (
          <input
            autoFocus
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={() => { onRename(nameVal); setEditing(false) }}
            onKeyDown={e => { if (e.key === 'Enter') { onRename(nameVal); setEditing(false) } }}
            style={{
              background: 'transparent', border: 'none',
              borderBottom: '1px solid rgba(201,168,76,0.5)',
              color: '#F0EBE0', fontSize: 16, fontWeight: 500,
              width: '100%', outline: 'none', marginBottom: 8, padding: '2px 0',
              fontFamily: 'Inter, sans-serif',
            }}
          />
        ) : (
          <div
            onDoubleClick={() => setEditing(true)}
            style={{ fontSize: 16, fontWeight: 500, color: '#F0EBE0', marginBottom: 4, cursor: 'text' }}
          >
            {style.name}
          </div>
        )}

        <div style={{ fontSize: 12, color: '#8A8070', lineHeight: 1.55, marginBottom: 12 }}>
          {style.aiDescription || 'No description — retrain to generate insights.'}
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          {[
            { label: 'PAIRS',      value: style.pairCount ?? 0 },
            { label: 'CONFIDENCE', value: `${style.confidence ?? 70}%`, gold: true },
            { label: 'USES',       value: style.usageCount ?? 0 },
            { label: 'VERSION',    value: `v${style.currentVersion ?? 1}` },
          ].map(m => (
            <div key={m.label}>
              <div style={{ color: '#4A4540', marginBottom: 2, fontSize: 9, letterSpacing: '0.08em' }}>{m.label}</div>
              <span style={{
                color: m.gold ? '#C9A84C' : '#F0EBE0',
                fontSize: m.gold ? 14 : 12,
                fontWeight: m.gold ? 500 : 400,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {m.value}
              </span>
            </div>
          ))}
        </div>

        {/* Radar chart */}
        {style.radarScores && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
            <RadarChart scores={style.radarScores} size={130} />
          </div>
        )}

        {/* Film stock label */}
        <div style={{ fontSize: 10, color: '#8B6B3D', letterSpacing: '0.06em', textAlign: 'center', marginTop: 2 }}>
          {style.params?.filmStockMatch ?? 'Digital Clean'}
        </div>

        {/* AI insights expand */}
        {style.aiInsights?.length > 0 && (
          <>
            <button
              onClick={() => setExpanded(p => !p)}
              style={{
                background: 'transparent', border: 'none', color: '#4A4540',
                fontSize: 10, cursor: 'pointer', padding: '8px 0 2px', width: '100%',
                textAlign: 'left', fontFamily: 'Inter, sans-serif', transition: 'color 150ms',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#8A8070'}
              onMouseLeave={e => e.currentTarget.style.color = '#4A4540'}
            >
              {expanded ? '▲ Hide insights' : '▼ View style insights'}
            </button>
            {expanded && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5, animation: 'fade 200ms ease' }}>
                {style.aiInsights.map((ins, i) => (
                  <div key={i} style={{ display: 'flex', gap: 7, fontSize: 11, color: '#8A8070', lineHeight: 1.5 }}>
                    <span style={{ color: '#8B6B3D', flexShrink: 0 }}>◆</span>
                    {ins}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 16px', flexWrap: 'wrap' }}>
        <button
          onClick={onApply}
          style={{ ...goldBtn, flex: 1, fontSize: 11, padding: '8px 10px' }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 16px rgba(201,168,76,0.3)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
        >
          Apply Style
        </button>
        <button onClick={() => setEditing(true)} style={iconBtn} title="Rename">✎</button>
        <button onClick={onDuplicate} style={iconBtn} title="Duplicate">⧉</button>
        <button onClick={onExport} style={iconBtn} title="Export JSON">↓</button>
        <button onClick={onDelete} style={{ ...iconBtn, color: '#C44B3A' }} title="Delete">✕</button>
      </div>
    </div>
  )
}

// ── Delete confirmation modal ─────────────────────────────────────────

function DeleteModal({ styleName, onCancel, onConfirm }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(10,9,8,0.88)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#111009', borderRadius: 14, padding: 32,
        maxWidth: 400, width: '90%',
        border: '1px solid rgba(196,75,58,0.3)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        animation: 'fade 200ms ease',
      }}>
        <div style={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: 22, color: '#F0EBE0', marginBottom: 8 }}>
          Delete Style?
        </div>
        <div style={{ fontSize: 13, color: '#8A8070', marginBottom: 6 }}>
          <span style={{ color: '#F0EBE0', fontWeight: 500 }}>{styleName}</span>
        </div>
        <div style={{ fontSize: 12, color: '#4A4540', marginBottom: 28, lineHeight: 1.65 }}>
          This action cannot be undone. All training data, embeddings, and cached previews will be permanently removed.
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onCancel} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '11px', borderRadius: 8, border: 'none',
              background: '#C44B3A', color: '#F0EBE0',
              fontSize: 12, letterSpacing: '0.08em', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Delete Style
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Side-by-side compare panel ────────────────────────────────────────

const COMPARE_PARAMS = [
  'exposure', 'contrast', 'saturation', 'temperature',
  'shadows', 'highlights', 'sharpness', 'dynamicRange',
]

function StyleComparePanel({ styleA, styleB, onClose }) {
  if (!styleA || !styleB) return null
  const [thumbA, setThumbA] = useState(null)
  const [thumbB, setThumbB] = useState(null)

  useEffect(() => {
    loadThumb(styleA.id).then(url => { if (url) setThumbA(url) })
    loadThumb(styleB.id).then(url => { if (url) setThumbB(url) })
  }, [styleA.id, styleB.id])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(10,9,8,0.92)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      animation: 'fade 200ms ease',
    }}>
      <div style={{
        background: '#111009', borderRadius: 16, padding: 32,
        maxWidth: 880, width: '100%', maxHeight: '88vh', overflowY: 'auto',
        border: '1px solid rgba(201,168,76,0.15)',
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(201,168,76,0.2) transparent',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: 22, color: '#F0EBE0' }}>
            Style Comparison
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#8A8070', fontSize: 22, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          {[
            { style: styleA, thumb: thumbA },
            { style: styleB, thumb: thumbB },
          ].map(({ style, thumb }, idx) => (
            <div key={idx}>
              {/* Thumbnail */}
              <div style={{
                height: 120, borderRadius: 8, overflow: 'hidden',
                background: '#0A0908', marginBottom: 12,
              }}>
                {thumb
                  ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: 'rgba(201,168,76,0.2)', fontSize: 28 }}>✦</span>
                    </div>
                }
              </div>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#C9A84C', marginBottom: 2 }}>{style.name}</div>
              <div style={{ fontSize: 11, color: '#4A4540', marginBottom: 16, fontVariantNumeric: 'tabular-nums' }}>
                {style.pairCount ?? 0} pairs · v{style.currentVersion ?? 1} · {style.confidence ?? 70}% confidence
              </div>

              {style.radarScores && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  <RadarChart scores={style.radarScores} size={160} />
                </div>
              )}

              {/* Color palette */}
              {(style.params?.dominantColors ?? []).length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                  {style.params.dominantColors.slice(0, 5).map((c, ci) => (
                    <div key={ci} style={{ flex: 1, height: 28, borderRadius: 4, background: c }} />
                  ))}
                </div>
              )}

              {/* Parameter comparison */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {COMPARE_PARAMS.map(p => {
                  const aV = styleA.params?.[p] ?? 0
                  const bV = styleB.params?.[p] ?? 0
                  const val = idx === 0 ? aV : bV
                  const isHigher = idx === 0 ? aV > bV : bV > aV
                  const differs  = Math.abs(aV - bV) > 5
                  return (
                    <div
                      key={p}
                      style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: 12, padding: '4px 0',
                        borderBottom: '1px solid rgba(201,168,76,0.05)',
                      }}
                    >
                      <span style={{ color: '#8A8070', textTransform: 'capitalize' }}>{p}</span>
                      <span style={{
                        color: differs ? (isHigher ? '#C9A84C' : '#C44B3A') : '#8A8070',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {typeof val === 'number'
                          ? (val > 0 ? '+' : '') + (p === 'exposure' ? val.toFixed(2) : Math.round(val))
                          : val}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Film & grade */}
              <div style={{
                marginTop: 12, padding: '8px 10px',
                background: 'rgba(201,168,76,0.04)', borderRadius: 6,
                fontSize: 11, color: '#8B6B3D',
              }}>
                {style.params?.filmStockMatch ?? 'Digital Clean'}
                {' · '}
                {style.params?.colorGradingProfile ?? 'Neutral Balanced'}
              </div>
            </div>
          ))}
        </div>

        {/* AI insights comparison */}
        {(styleA.aiInsights?.length > 0 || styleB.aiInsights?.length > 0) && (
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid rgba(201,168,76,0.08)' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#4A4540', marginBottom: 14 }}>
              AI STYLE INSIGHTS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {[styleA, styleB].map((s, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {(s.aiInsights ?? []).slice(0, 4).map((ins, j) => (
                    <div key={j} style={{ display: 'flex', gap: 6, fontSize: 11, color: '#8A8070', lineHeight: 1.5 }}>
                      <span style={{ color: '#8B6B3D', flexShrink: 0 }}>◆</span>
                      {ins}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
