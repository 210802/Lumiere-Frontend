import { useState } from 'react'
import { analysePair, averageProfiles } from '../engine/styleAnalyser'
import { saveProfile as persistProfile } from '../store/profileStore'
import { saveStyle, saveThumb } from '../store/styleStorage'
import {
  fileToImageData, generateAIInsights, generateAIDescription,
  computeRadarScores, matchFilmStock, classifyColorGrade,
  extractDominantColors, analyseLighting, computeSharpness, computeDynamicRange,
} from '../engine/deepStyleAnalyser'

const DEMO_PARAMS = [
  { label: 'Exposure',   value: 0.42,  unit: 'EV', min: -3, max: 3 },
  { label: 'Contrast',   value: 0.18,  unit: '',   min: -1, max: 1 },
  { label: 'Warmth',     value: 0.62,  unit: 'K',  min: -1, max: 1 },
  { label: 'Saturation', value: -0.08, unit: '',   min: -1, max: 1 },
  { label: 'Shadows',    value: 0.34,  unit: '',   min: -1, max: 1 },
  { label: 'Highlights', value: -0.22, unit: '',   min: -1, max: 1 },
]

function makePhoto(file) {
  return { id: crypto.randomUUID(), file, url: URL.createObjectURL(file), name: file.name }
}

function matchByFilename(originals, edited) {
  const matched = new Set()
  const pairs   = []
  for (const orig of originals) {
    const base  = orig.name.replace(/\.[^.]+$/, '').toLowerCase()
    const match = edited.find(e =>
      !matched.has(e.id) &&
      e.name.replace(/\.[^.]+$/, '').replace(/_edited?$/i, '').toLowerCase() === base
    )
    if (match) { matched.add(match.id); pairs.push([orig.id, match.id]) }
  }
  return pairs
}

export default function Train() {
  const [originals, setOriginals]       = useState([])
  const [edited, setEdited]             = useState([])
  const [matchedPairs, setMatchedPairs] = useState([])

  const [analysing, setAnalysing]           = useState(false)
  const [analyseProgress, setAnalyseProgress] = useState(0)
  const [learnedProfile, setLearnedProfile] = useState(null)
  const [activePairCount, setActivePairCount] = useState(0)
  const [saved, setSaved]                   = useState(false)
  const [error, setError]                   = useState(null)

  const addPhotos = (setter, files) => {
    const newPhotos = Array.from(files).map(makePhoto)
    setter(prev => {
      const existingNames = new Set(prev.map(p => p.name))
      return [...prev, ...newPhotos.filter(p => !existingNames.has(p.name))]
    })
  }

  const handleMatchPairs = () => {
    setMatchedPairs(matchByFilename(originals, edited))
  }

  const isMatched = (photo, side) =>
    matchedPairs.some(([oId, eId]) => side === 'orig' ? oId === photo.id : eId === photo.id)

  // Build pairs list: matched first, then zip by order if no match
  const getPairsToAnalyse = () => {
    if (matchedPairs.length > 0) {
      return matchedPairs
        .map(([oId, eId]) => [originals.find(p => p.id === oId), edited.find(p => p.id === eId)])
        .filter(([a, b]) => a && b)
    }
    const len = Math.min(originals.length, edited.length)
    return Array.from({ length: len }, (_, i) => [originals[i], edited[i]])
  }

  const runAnalysis = async () => {
    const pairs = getPairsToAnalyse()
    if (!pairs.length) {
      setError('Add at least one original and one edited photo before analysing.')
      return
    }

    setAnalysing(true)
    setAnalyseProgress(0)
    setError(null)
    setSaved(false)

    const results = []
    for (let i = 0; i < pairs.length; i++) {
      const [orig, edit] = pairs[i]
      try {
        const analysis = await analysePair(orig.file, edit.file)
        results.push(analysis)
      } catch (err) {
        console.error(`Skipping pair ${orig.name}:`, err)
      }
      setAnalyseProgress(Math.round(((i + 1) / pairs.length) * 100))
    }

    if (!results.length) {
      setError('Analysis failed — check that photos are valid JPEGs or PNGs (RAW files cannot be analysed in the browser).')
      setAnalysing(false)
      return
    }

    setLearnedProfile(averageProfiles(results))
    setActivePairCount(results.length)
    setAnalysing(false)
  }

  const handleSaveProfile = async (name) => {
    if (!learnedProfile || !name.trim()) return

    const id         = crypto.randomUUID()
    const confidence = Math.min(95, 70 + activePairCount * 2)

    // Pixel analysis from first edited photo
    let imageData     = null
    let analysisCanvas = null
    const firstEdited  = edited[0]
    if (firstEdited?.file) {
      try {
        const result  = await fileToImageData(firstEdited.file, 400)
        imageData     = result.imageData
        analysisCanvas = result.canvas
      } catch {}
    }

    const lighting = imageData ? analyseLighting(imageData) : null

    const params = {
      ...learnedProfile,
      sharpness:           imageData ? computeSharpness(imageData)    : 50,
      dynamicRange:        imageData ? computeDynamicRange(imageData)  : 50,
      dominantColors:      imageData ? extractDominantColors(imageData) : [],
      lightSoftness:       lighting?.softness    ?? 'Mixed',
      rimLightDetected:    lighting?.rimDetected ?? false,
      filmStockMatch:      matchFilmStock(learnedProfile),
      colorGradingProfile: classifyColorGrade(learnedProfile),
      texture:             50,
      vibrance:            0,
      filmicCurve:         false,
      grainIntensity:      learnedProfile.grainIntensity  ?? 0,
      vignetteStrength:    learnedProfile.vignetteStrength ?? 0,
      highlightRollOff:    50,
    }

    const radarScores   = computeRadarScores(params)
    const aiInsights    = generateAIInsights(params)
    const aiDescription = generateAIDescription(params, name.trim())

    // Save full profile to new style library
    saveStyle({
      id,
      name:           name.trim(),
      createdAt:      Date.now(),
      updatedAt:      Date.now(),
      status:         'ready',
      pairCount:      activePairCount,
      confidence,
      currentVersion: 1,
      versions:       [],
      isFavorite:     false,
      usageCount:     0,
      params,
      radarScores,
      aiInsights,
      aiDescription,
    })

    // Save representative thumbnail to IndexedDB
    if (analysisCanvas) {
      try {
        const thumbCanvas   = document.createElement('canvas')
        const maxThumb      = 300
        const scale         = maxThumb / Math.max(analysisCanvas.width, analysisCanvas.height)
        thumbCanvas.width   = Math.round(analysisCanvas.width  * scale)
        thumbCanvas.height  = Math.round(analysisCanvas.height * scale)
        thumbCanvas.getContext('2d').drawImage(analysisCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height)
        await saveThumb(id, thumbCanvas.toDataURL('image/jpeg', 0.82))
      } catch {}
    }

    // Flat profile for Edit-page compatibility (old store)
    persistProfile({
      ...learnedProfile,
      id,
      name:            name.trim(),
      createdAt:       Date.now(),
      pairCount:       activePairCount,
      dominantScene:   'warm tungsten interior',
      confidence,
      customDirection: 'Lifted shadows, pulled blacks, orange skin boost, reduced blue saturation',
    })

    setSaved(true)
  }

  const pairsCount = getPairsToAnalyse().length
  const readPairs  = Math.min(originals.length, 6)

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 24px 48px', background: '#0A0908' }}>

      {/* ── ANALYSIS PROGRESS OVERLAY ─────────────────────────────── */}
      {analysing && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(10,9,8,0.92)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 24,
        }}>
          {/* Pulsing sparkle ring */}
          <div style={{ position: 'relative', width: 80, height: 80 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              border: '1px solid rgba(201,168,76,0.25)',
              animation: 'breathe 2s ease-in-out infinite',
            }} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 32, color: '#C9A84C' }}>✦</span>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: '"Playfair Display"', fontStyle: 'italic',
              fontSize: 22, color: '#F0EBE0', marginBottom: 8,
            }}>
              Reading your style
            </div>
            <div style={{ fontSize: 13, color: '#8A8070' }}>
              Analysing {pairsCount} before/after pair{pairsCount !== 1 ? 's' : ''}
            </div>
          </div>

          <div style={{ width: 320 }}>
            <div style={{
              height: 2, background: 'rgba(201,168,76,0.15)',
              borderRadius: 1, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${analyseProgress}%`,
                background: 'linear-gradient(90deg, #8B6B3D, #C9A84C)',
                borderRadius: 1,
                transition: 'width 400ms ease',
              }} />
            </div>
            <div style={{
              textAlign: 'center', marginTop: 8,
              fontSize: 12, color: '#4A4540',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {analyseProgress}%
              {analyseProgress < 100 && (
                <> · {Math.ceil((pairsCount - Math.floor(analyseProgress / 100 * pairsCount)))} remaining</>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 1: Pair upload grid ───────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', marginBottom: 40 }}>

        <PairColumn
          title="Originals"
          subtitle="Straight from camera"
          photos={originals}
          onAddFiles={files => addPhotos(setOriginals, files)}
          onRemove={id => setOriginals(prev => prev.filter(p => p.id !== id))}
          isMatched={p => isMatched(p, 'orig')}
        />

        {/* Centre: MATCH PAIRS */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <button
              onClick={handleMatchPairs}
              style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'rgba(26,23,18,0.85)',
                border: '1px solid rgba(201,168,76,0.3)',
                backdropFilter: 'blur(12px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 200ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.7)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(201,168,76,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="18" rx="1"/>
                <rect x="14" y="3" width="7" height="18" rx="1"/>
                <path d="M10 8h4M10 12h4M10 16h4" strokeWidth="1"/>
              </svg>
            </button>
            <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#4A4540', textAlign: 'center' }}>
              MATCH<br /><span style={{ color: '#2A2520' }}>by filename</span>
            </div>
          </div>
        </div>

        <PairColumn
          title="Your Edited Set"
          subtitle="Final-look references"
          photos={edited}
          onAddFiles={files => addPhotos(setEdited, files)}
          onRemove={id => setEdited(prev => prev.filter(p => p.id !== id))}
          isMatched={p => isMatched(p, 'edit')}
        />
      </div>

      {/* Wavy divider */}
      <div style={{ textAlign: 'center', color: '#2A2520', fontSize: 20, marginBottom: 36, letterSpacing: 4 }}>〜〜〜</div>

      {/* ── SECTION 2: Params area ────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, marginBottom: 24 }}>

        {/* Left: Style preview + status */}
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.2em', color: '#4A4540', marginBottom: 12 }}>READING STYLE</div>
          <div style={{
            borderRadius: 8, overflow: 'hidden', position: 'relative',
            aspectRatio: '1', background: '#111009',
            border: '1px solid rgba(201,168,76,0.1)',
          }}>
            {originals[0] ? (
              <img src={originals[0].url} alt="style preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: 'radial-gradient(ellipse at 30% 40%, rgba(201,168,76,0.15), transparent 70%)' }} />
            )}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <line x1="33%" y1="0" x2="33%" y2="100%" stroke="rgba(201,168,76,0.12)" strokeWidth="0.5"/>
              <line x1="66%" y1="0" x2="66%" y2="100%" stroke="rgba(201,168,76,0.12)" strokeWidth="0.5"/>
              <line x1="0" y1="33%" x2="100%" y2="33%" stroke="rgba(201,168,76,0.12)" strokeWidth="0.5"/>
              <line x1="0" y1="66%" x2="100%" y2="66%" stroke="rgba(201,168,76,0.12)" strokeWidth="0.5"/>
              <path d="M8 20 L8 8 L20 8" fill="none" stroke="rgba(201,168,76,0.5)" strokeWidth="1.5"/>
              <path d="M8 calc(100% - 20px) L8 calc(100% - 8px) L20 calc(100% - 8px)" fill="none" stroke="rgba(201,168,76,0.5)" strokeWidth="1.5"/>
            </svg>
            <div style={{
              position: 'absolute', left: 0, right: 0, height: 1,
              background: 'rgba(201,168,76,0.15)',
              animation: 'scanLine 5s linear infinite',
            }} />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {[
              { label: matchedPairs.length > 0 ? `${matchedPairs.length} PAIRS MATCHED` : 'AWAITING PAIR', color: matchedPairs.length > 0 ? '#4A8C6A' : 'rgba(201,168,76,0.5)' },
              { label: `${readPairs} OF 6 READ`, color: '#4A8C6A' },
              { label: 'EXIF LOCKED', color: '#4A4540' },
            ].map(pill => (
              <div key={pill.label} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: '#111009', border: '1px solid rgba(201,168,76,0.2)',
                borderRadius: 99, padding: '4px 10px',
                fontSize: 10, letterSpacing: '0.08em', color: '#8A8070',
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: pill.color }} />
                {pill.label}
              </div>
            ))}
          </div>
        </div>

        {/* Right: LearnedProfileCard after analysis, demo params before */}
        {learnedProfile ? (
          <LearnedProfileCard
            profile={learnedProfile}
            pairCount={activePairCount}
            onSave={handleSaveProfile}
            saved={saved}
          />
        ) : (
          <div style={{
            background: '#111009',
            border: '1px solid rgba(201,168,76,0.14)',
            borderRadius: 12, padding: '24px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: '"Playfair Display"', fontStyle: 'italic', fontSize: 20, color: '#F0EBE0', marginBottom: 4 }}>
                  Extracted style parameters
                </div>
                <div style={{ fontSize: 12, color: '#8A8070' }}>
                  Click Analyse Pairs to extract real parameters from your uploads.
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 20 }}>
                <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#4A4540' }}>CONFIDENCE</div>
                <div style={{ fontFamily: '"Playfair Display"', fontSize: 28, color: '#C9A84C', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.min(95, 70 + pairsCount * 2)}%
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 40px' }}>
              {DEMO_PARAMS.map(param => (
                <ReadOnlySlider key={param.label} {...param} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#C44B3A',
          background: 'rgba(196,75,58,0.08)', border: '1px solid rgba(196,75,58,0.20)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16,
        }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" width={14} height={14}>
            <circle cx="8" cy="8" r="7"/><path d="M8 5v3.5M8 10.5v.5"/>
          </svg>
          {error}
        </div>
      )}

      {/* ── SECTION 3: Analyse strip (hidden after profile saved) ──── */}
      {!saved && (
        <div style={{
          background: '#111009',
          border: '1px solid rgba(201,168,76,0.12)',
          borderRadius: 12, padding: '20px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
        }}>
          <div>
            <div style={{ fontFamily: '"Playfair Display"', fontStyle: 'italic', fontSize: 18, color: '#F0EBE0', marginBottom: 4 }}>
              {learnedProfile ? 'Style extracted — name it above to save' : 'Analyse your before/after pairs'}
            </div>
            <div style={{ fontSize: 12, color: '#8A8070' }}>
              {learnedProfile
                ? 'Lumiere stores it locally — you can rename, fork or apply it later.'
                : `${pairsCount} pair${pairsCount !== 1 ? 's' : ''} ready · canvas analysis at 800px for speed`}
            </div>
          </div>
          {!learnedProfile && (
            <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
              <button
                style={{
                  padding: '10px 20px', borderRadius: 8,
                  background: 'transparent', border: '1px solid rgba(201,168,76,0.25)',
                  color: '#8A8070', fontSize: 12, letterSpacing: '0.08em', cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)'; e.currentTarget.style.color = '#C9A84C' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.25)'; e.currentTarget.style.color = '#8A8070' }}
              >
                PREVIEW ON ONE FRAME
              </button>
              <button
                onClick={runAnalysis}
                disabled={pairsCount === 0}
                style={{
                  padding: '10px 24px', borderRadius: 8,
                  background: pairsCount > 0
                    ? 'linear-gradient(135deg, #C9A84C 0%, #A8893A 100%)'
                    : '#1A1712',
                  border: 'none',
                  color: pairsCount > 0 ? '#1A1200' : '#4A4540',
                  fontSize: 12, letterSpacing: '0.10em', fontWeight: 600,
                  cursor: pairsCount > 0 ? 'pointer' : 'not-allowed',
                  transition: 'box-shadow 200ms ease',
                }}
                onMouseEnter={e => { if (pairsCount > 0) e.currentTarget.style.boxShadow = '0 0 20px rgba(201,168,76,0.35)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
              >
                ANALYSE PAIRS
              </button>
            </div>
          )}
        </div>
      )}

      {/* Saved success banner */}
      {saved && (
        <div style={{
          background: 'rgba(74,140,106,0.08)', border: '1px solid rgba(74,140,106,0.25)',
          borderRadius: 10, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#4A8C6A',
        }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" width={15} height={15}>
            <circle cx="8" cy="8" r="7"/><path d="M5 8l2.5 2.5 3.5-4"/>
          </svg>
          Style profile saved — available in the Edit page under <span style={{ color: '#C9A84C', marginLeft: 4 }}>YOUR TRAINED STYLES</span>.
        </div>
      )}
    </div>
  )
}

// ─── Pair column ───────────────────────────────────────────────────
function PairColumn({ title, subtitle, photos, onAddFiles, onRemove, isMatched }) {
  const ref = { current: null }

  const handleDrop = (e) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter(f => /\.(jpe?g|png|cr2|nef|arw|dng)$/i.test(f.name))
    if (files.length) onAddFiles(files)
  }

  return (
    <div style={{ background: '#111009', borderRadius: 12, border: '1px solid rgba(201,168,76,0.12)', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: '"Playfair Display"', fontStyle: 'italic', fontSize: 20, color: '#F0EBE0' }}>
            {title}
          </div>
          <div style={{ fontSize: 12, color: '#8A8070', marginTop: 2 }}>{subtitle}</div>
        </div>
        <div style={{ fontSize: 10, letterSpacing: '0.1em', color: '#4A4540' }}>
          {photos.length} FRAMES
        </div>
      </div>

      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
          {photos.map(photo => (
            <div key={photo.id} style={{ borderRadius: 6, overflow: 'hidden', aspectRatio: '1', position: 'relative' }}>
              <img src={photo.url} alt={photo.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {isMatched(photo) && (
                <div style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg viewBox="0 0 10 10" fill="none" width={9} height={9}>
                    <path d="M2 5l2 2 4-4" stroke="#0A0908" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(transparent, rgba(10,9,8,0.9))',
                padding: '12px 6px 4px', fontSize: 9, color: '#8A8070',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {photo.name.split('.')[0]}
                </span>
                <button
                  onClick={() => onRemove(photo.id)}
                  style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: 'rgba(196,75,58,0.8)', border: 'none',
                    color: '#F0EBE0', fontSize: 8, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginLeft: 4,
                  }}
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => ref.current?.click()}
        style={{
          border: '1px dashed rgba(201,168,76,0.2)',
          borderRadius: 6, padding: '14px',
          textAlign: 'center', fontSize: 12, color: '#4A4540',
          cursor: 'pointer', transition: 'border-color 150ms ease, background 150ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)'; e.currentTarget.style.background = 'rgba(201,168,76,0.03)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.2)'; e.currentTarget.style.background = 'transparent' }}
      >
        <span style={{ color: '#8B6B3D', marginRight: 6 }}>+</span>
        {photos.length === 0 ? 'Drop photos or click to browse' : 'Drop more photos here'}
        <input
          ref={el => { ref.current = el }}
          type="file" multiple accept=".jpg,.jpeg,.png,.cr2,.nef,.arw,.dng"
          style={{ display: 'none' }}
          onChange={e => onAddFiles(e.target.files)}
        />
      </div>
    </div>
  )
}

// ─── Learned profile card — shown after analysis ───────────────────
function LearnedProfileCard({ profile, pairCount, onSave, saved }) {
  const [name, setName] = useState('My Style')

  const params = [
    { label: 'Exposure',    value: profile.exposure    ?? 0, unit: 'EV', scale: 3    },
    { label: 'Shadows',     value: profile.shadows     ?? 0, unit: '',   scale: 100  },
    { label: 'Highlights',  value: profile.highlights  ?? 0, unit: '',   scale: 100  },
    { label: 'Blacks',      value: profile.blacks      ?? 0, unit: '',   scale: 100  },
    { label: 'Temperature', value: profile.temperature ?? 0, unit: 'K',  scale: 2000 },
    { label: 'Saturation',  value: profile.saturation  ?? 0, unit: '',   scale: 100  },
    { label: 'Contrast',    value: profile.contrast    ?? 0, unit: '',   scale: 100  },
    { label: 'Clarity',     value: profile.clarity     ?? 0, unit: '',   scale: 100  },
    { label: 'Orange Sat',  value: profile.hsl?.orange?.sat ?? 0, unit: '', scale: 100 },
    { label: 'Blue Sat',    value: profile.hsl?.blue?.sat   ?? 0, unit: '', scale: 100 },
  ]

  return (
    <div style={{
      background: '#111009',
      border: '1px solid rgba(201,168,76,0.15)',
      borderRadius: 12, padding: 24,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: '"Playfair Display"', fontStyle: 'italic', fontSize: 20, color: '#F0EBE0', marginBottom: 4 }}>
            Extracted style parameters
          </div>
          <div style={{ fontSize: 12, color: '#8A8070' }}>
            Learned from {pairCount} before/after pair{pairCount !== 1 ? 's' : ''} · Read-only
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#4A4540' }}>CONFIDENCE</div>
          <div style={{
            fontFamily: '"Playfair Display"', fontSize: 28,
            color: '#C9A84C', fontVariantNumeric: 'tabular-nums',
          }}>
            {Math.min(95, 70 + pairCount * 2)}%
          </div>
        </div>
      </div>

      {/* Parameter grid — two-tone tracks centred at zero */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 40px', marginBottom: 24 }}>
        {params.map(p => {
          const pct        = (p.value / p.scale) * 50 + 50   // 50% = zero
          const isPositive = p.value >= 0
          const fillWidth  = `${Math.abs(p.value / p.scale) * 50}%`
          const fillLeft   = isPositive ? '50%' : `${pct}%`

          return (
            <div key={p.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: '#8A8070' }}>{p.label}</span>
                <span style={{ fontSize: 12, color: '#C9A84C', fontVariantNumeric: 'tabular-nums' }}>
                  {p.value > 0 ? '+' : ''}
                  {p.label === 'Exposure' ? p.value.toFixed(2) : Math.round(p.value)}
                  {p.unit && <span style={{ fontSize: 10, color: '#4A4540', marginLeft: 2 }}>{p.unit}</span>}
                </span>
              </div>
              <div style={{ height: 2, borderRadius: 1, position: 'relative', background: 'rgba(201,168,76,0.15)' }}>
                {/* Fill from centre */}
                <div style={{
                  position: 'absolute', height: '100%', borderRadius: 1,
                  background: '#C9A84C',
                  left: fillLeft, width: fillWidth,
                }} />
                {/* Centre mark */}
                <div style={{
                  position: 'absolute', left: '50%', top: -2,
                  width: 1, height: 6, background: 'rgba(201,168,76,0.3)',
                }} />
                {/* Thumb */}
                <div style={{
                  position: 'absolute', top: '50%',
                  left: `${pct}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 12, height: 12, borderRadius: '50%',
                  background: '#C9A84C',
                  boxShadow: '0 0 6px rgba(201,168,76,0.5)',
                }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Save strip */}
      {!saved && (
        <div style={{
          borderTop: '1px solid rgba(201,168,76,0.1)',
          paddingTop: 20,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Name this style profile…"
            style={{
              flex: 1, background: '#0A0908',
              border: '1px solid rgba(201,168,76,0.2)',
              borderRadius: 8, padding: '10px 14px',
              fontSize: 13, color: '#F0EBE0', outline: 'none',
              transition: 'border-color 200ms',
            }}
            onFocus={e  => { e.target.style.borderColor = 'rgba(201,168,76,0.5)' }}
            onBlur={e   => { e.target.style.borderColor = 'rgba(201,168,76,0.2)' }}
          />
          <button
            onClick={() => onSave(name)}
            disabled={!name.trim()}
            style={{
              padding: '10px 24px', borderRadius: 8,
              background: name.trim()
                ? 'linear-gradient(135deg, #C9A84C 0%, #A8893A 100%)'
                : '#1A1712',
              border: 'none',
              color: name.trim() ? '#1A1200' : '#4A4540',
              fontSize: 12, letterSpacing: '0.1em', fontWeight: 600,
              cursor: name.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 200ms ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { if (name.trim()) e.currentTarget.style.boxShadow = '0 0 20px rgba(201,168,76,0.35)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
          >
            SAVE STYLE PROFILE
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Read-only slider (demo params) ───────────────────────────────
function ReadOnlySlider({ label, value, unit, min, max }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#8A8070' }}>{label}</span>
        <span className="num" style={{ fontSize: 12, color: '#C9A84C' }}>
          {value > 0 ? '+' : ''}{value.toFixed(2)}
          {unit && <span style={{ fontSize: 10, color: '#4A4540', marginLeft: 3 }}>{unit}</span>}
        </span>
      </div>
      <div style={{
        height: 2, borderRadius: 1, position: 'relative',
        background: `linear-gradient(to right, #C9A84C ${pct}%, rgba(201,168,76,0.18) ${pct}%)`,
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: `${pct}%`,
          transform: 'translate(-50%, -50%)',
          width: 12, height: 12, borderRadius: '50%',
          background: '#C9A84C', boxShadow: '0 0 6px rgba(201,168,76,0.5)',
        }} />
      </div>
    </div>
  )
}
