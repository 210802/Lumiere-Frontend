import { useState, useEffect, useRef, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BeforeAfterSlider from '../components/BeforeAfterSlider'
import { loadProfiles, profileToPresetShape, profileToCSSFilter } from '../store/profileStore'
import { processAllPhotos } from '../engine/processingEngine'
import { setProcessedResults } from '../store/processedStore'
import { getThumbnail, revokeThumbCache } from '../engine/thumbnailCache'
import { parseDirection, mergeProfileWithDelta } from '../engine/directionParser'

// ─── Preset data ───────────────────────────────────────────────────

const WEDDING_PRESETS = {
  'MANDAP': [
    { id: 'golden-mandap',  name: 'Golden Mandap',  desc: 'Late afternoon sun',  exposure: 0.3,  warmth: 0.6,  contrast: 0.1,  saturation: 0    },
    { id: 'pheras-fire',    name: 'Pheras by Fire', desc: 'Warm key, low ISO',   exposure: 0.1,  warmth: 0.8,  contrast: 0.2,  saturation: 0    },
    { id: 'temple-light',   name: 'Temple Light',   desc: 'Brass + lamp',        exposure: 0.2,  warmth: 0.5,  contrast: 0.15, saturation: -0.1 },
    { id: 'rituals-still',  name: 'Rituals Still',  desc: 'Object, calm',        exposure: 0.0,  warmth: 0.3,  contrast: 0.1,  saturation: -0.05},
  ],
  'SANGEET': [
    { id: 'sangeet-stage',  name: 'Sangeet Stage',  desc: 'Coloured LED',        exposure: 0.15, warmth: 0.2,  contrast: 0.3,  saturation: 0.1  },
    { id: 'sufi-night',     name: 'Sufi Night',     desc: 'Stage spot, smoke',   exposure: -0.1, warmth: 0.1,  contrast: 0.4,  saturation: -0.1 },
    { id: 'mehndi-detail',  name: 'Mehndi Detail',  desc: 'Macro, sienna',       exposure: 0.2,  warmth: 0.5,  contrast: 0.0,  saturation: 0.1  },
    { id: 'dance-floor',    name: 'Dance Floor',    desc: 'Strobe, motion',      exposure: 0.3,  warmth: 0.0,  contrast: 0.5,  saturation: 0.05 },
  ],
  'RECEPTION': [
    { id: 'warm-reception', name: 'Warm Reception', desc: 'Tungsten + flash',    exposure: 0.34, warmth: 0.62, contrast: 0.18, saturation: -0.08},
    { id: 'dramatic-night', name: 'Dramatic Night', desc: 'Cinematic teal',      exposure: -0.2, warmth: -0.3, contrast: 0.6,  saturation: 0.1  },
    { id: 'reception-bg',   name: 'Reception BG',   desc: 'Bokeh, warm',         exposure: 0.1,  warmth: 0.4,  contrast: 0.1,  saturation: 0    },
    { id: 'cake-toasts',    name: 'Cake & Toasts',  desc: 'Mixed tungsten',      exposure: 0.2,  warmth: 0.3,  contrast: 0.15, saturation: -0.05},
    { id: 'rooftop-dusk',   name: 'Rooftop Dusk',   desc: 'Magic hour',          exposure: 0.1,  warmth: 0.7,  contrast: 0.2,  saturation: 0    },
  ],
  'PORTRAITS': [
    { id: 'couple-portrait',name: 'Couple Portrait',desc: 'Soft skin, soft bg',  exposure: 0.2,  warmth: 0.3,  contrast: 0.1,  saturation: -0.05},
    { id: 'bride-prep',     name: 'Bride Prep',     desc: 'Window light',        exposure: 0.3,  warmth: 0.2,  contrast: 0.05, saturation: 0    },
    { id: 'groom-portrait', name: 'Groom Portrait', desc: 'Hard light, sharp',   exposure: 0.1,  warmth: 0.1,  contrast: 0.3,  saturation: -0.1 },
    { id: 'family-formal',  name: 'Family Formal',  desc: 'Even, balanced',      exposure: 0.15, warmth: 0.2,  contrast: 0.1,  saturation: -0.05},
    { id: 'vidaai-soft',    name: 'Vidaai Soft',    desc: 'Muted, emotional',    exposure: 0.0,  warmth: 0.1,  contrast: -0.1, saturation: -0.15},
    { id: 'haldi-noon',     name: 'Haldi at Noon',  desc: 'Daylight, marigold',  exposure: 0.0,  warmth: 0.6,  contrast: 0.1,  saturation: 0.1  },
    { id: 'baraat-street',  name: 'Baraat Street',  desc: 'Daylight, mid-tone',  exposure: 0.05, warmth: 0.2,  contrast: 0.15, saturation: 0    },
  ],
}

const GENERAL_PRESETS = {
  'NATURAL LIGHT': [
    { id: 'golden-hour',    name: 'Golden Hour',    desc: 'Warm, directional',   exposure: 0.2,  warmth: 0.7,  contrast: 0.15, saturation: 0    },
    { id: 'overcast-soft',  name: 'Overcast Soft',  desc: 'Even, diffused',      exposure: 0.3,  warmth: 0.0,  contrast: -0.1, saturation: -0.05},
    { id: 'window-natural', name: 'Window Natural', desc: 'Side light, clean',   exposure: 0.25, warmth: 0.1,  contrast: 0.1,  saturation: 0    },
    { id: 'blue-hour',      name: 'Blue Hour',      desc: 'Cool, dusk',          exposure: 0.4,  warmth: -0.4, contrast: 0.2,  saturation: 0.05 },
  ],
  'INDOOR / EVENT': [
    { id: 'tungsten-warm',  name: 'Tungsten Warm',  desc: 'Lamp, amber cast',    exposure: 0.2,  warmth: 0.7,  contrast: 0.15, saturation: -0.05},
    { id: 'conference-led', name: 'Conference LED', desc: 'Flat, neutral',       exposure: 0.3,  warmth: 0.0,  contrast: 0.1,  saturation: 0    },
    { id: 'stage-spot',     name: 'Stage Spot',     desc: 'High contrast drama', exposure: 0.0,  warmth: 0.1,  contrast: 0.5,  saturation: 0.05 },
    { id: 'restaurant-low', name: 'Restaurant Low', desc: 'Low light, moody',    exposure: 0.5,  warmth: 0.4,  contrast: 0.2,  saturation: -0.1 },
  ],
  'PORTRAITS': [
    { id: 'gen-portrait',   name: 'Clean Portrait', desc: 'Natural, balanced',   exposure: 0.2,  warmth: 0.2,  contrast: 0.1,  saturation: -0.05},
    { id: 'street-candid',  name: 'Street Candid',  desc: 'Gritty, real',        exposure: 0.1,  warmth: -0.1, contrast: 0.3,  saturation: 0    },
    { id: 'studio-clean',   name: 'Studio Clean',   desc: 'White bg, precise',   exposure: 0.0,  warmth: 0.0,  contrast: 0.2,  saturation: -0.1 },
  ],
  'NATURE / TRAVEL': [
    { id: 'landscape-wide', name: 'Landscape Wide', desc: 'Vivid, expansive',    exposure: 0.1,  warmth: 0.1,  contrast: 0.2,  saturation: 0.1  },
    { id: 'forest-mist',    name: 'Forest Mist',    desc: 'Cool, moody greens',  exposure: 0.2,  warmth: -0.3, contrast: 0.15, saturation: 0.05 },
    { id: 'travel-warm',    name: 'Travel Warm',    desc: 'Film, nostalgic',     exposure: 0.1,  warmth: 0.5,  contrast: 0.1,  saturation: -0.05},
  ],
}

// Pill label → direction phrase
const PILL_ACTIONS = {
  '+ more film':  'more film grain',
  '+ less haze':  'less haze',
  '+ lift faces': 'lift faces',
  '+ mute reds':  'mute reds, less colour',
  '+ warmer':     'warmer',
}

export default function Edit() {
  const location = useLocation()
  const navigate  = useNavigate()

  const [editMode, setEditMode]             = useState('wedding')
  const [photos, setPhotos]                 = useState([])
  const [selectedPreset, setSelectedPreset] = useState(null)
  const [selectedProfile, setSelectedProfile] = useState('')
  const [profiles, setProfiles]             = useState([])
  const [customPrompt, setCustomPrompt]     = useState('')

  const [savedProfiles, setSavedProfiles]           = useState([])
  const [activeTrainedProfile, setActiveTrainedProfile] = useState(null)

  // Custom Direction state
  const [directionDelta, setDirectionDelta]       = useState(null)
  const [isDirectionApplied, setIsDirectionApplied] = useState(false)
  const [livePreviewFilter, setLivePreviewFilter] = useState(null)
  const debounceRef = useRef(null)

  const [batchId, setBatchId]       = useState(null)
  const [progress, setProgress]     = useState(null)
  const [processing, setProcessing] = useState(false)
  const processingStartRef          = useRef(null)

  const [previewPhoto, setPreviewPhoto] = useState(null)

  const previewResult = useMemo(() => {
    if (!previewPhoto || !progress?.results?.length) return null
    const match = progress.results.find(r => r.id === previewPhoto.id)
    return match?.thumb_url || null
  }, [previewPhoto, progress])

  const sseRef    = useRef(null)
  const sessionId = location.state?.sessionId || null

  useEffect(() => {
    const navPhotos = location.state?.photos || []
    setPhotos(navPhotos)
    if (navPhotos.length > 0) setPreviewPhoto(navPhotos[0])
    fetch('/styles').then(r => r.json()).then(d => setProfiles(d.profiles || [])).catch(() => {})
    setSavedProfiles(loadProfiles())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => sseRef.current?.close(), [])
  useEffect(() => () => clearTimeout(debounceRef.current), [])

  // Reset direction whenever the selected photo changes
  useEffect(() => {
    setCustomPrompt('')
    setDirectionDelta(null)
    setIsDirectionApplied(false)
    setLivePreviewFilter(null)
  }, [previewPhoto?.id])

  // Effective profile: base trained style + applied direction delta
  const effectiveProfile = useMemo(() => {
    if (activeTrainedProfile && isDirectionApplied && directionDelta?.humanReadable?.length > 0) {
      return mergeProfileWithDelta(activeTrainedProfile, directionDelta)
    }
    return activeTrainedProfile
  }, [activeTrainedProfile, isDirectionApplied, directionDelta])

  const allPresetsFlat     = Object.values(editMode === 'wedding' ? WEDDING_PRESETS : GENERAL_PRESETS).flat()
  const activePresetObj    = allPresetsFlat.find(p => p.id === selectedPreset) || null
  const activePresetGroups = editMode === 'wedding' ? WEDDING_PRESETS : GENERAL_PRESETS

  const sliderPreset = useMemo(() => {
    if (activeTrainedProfile) return profileToPresetShape(activeTrainedProfile)
    return activePresetObj
  }, [activeTrainedProfile, activePresetObj])

  // ── Direction parsing (debounced 300ms) ──────────────────────────
  const handleDirectionChange = (val) => {
    setCustomPrompt(val)
    setIsDirectionApplied(false)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const d = parseDirection(val)
      setDirectionDelta(d)
      if (d.humanReadable?.length > 0 && activeTrainedProfile) {
        setLivePreviewFilter(profileToCSSFilter(mergeProfileWithDelta(activeTrainedProfile, d)))
      } else {
        setLivePreviewFilter(null)
      }
    }, 300)
  }

  const handleApplyDirection = () => {
    if (!directionDelta?.humanReadable?.length) return
    setIsDirectionApplied(true)
  }

  const resetDirection = () => {
    setCustomPrompt('')
    setDirectionDelta(null)
    setIsDirectionApplied(false)
    setLivePreviewFilter(null)
  }

  const handlePillClick = (label) => {
    const phrase = PILL_ACTIONS[label] ?? label.slice(2)
    const newVal  = customPrompt ? `${customPrompt}, ${phrase}` : phrase
    setCustomPrompt(newVal)
    setIsDirectionApplied(false)
    const d = parseDirection(newVal)
    setDirectionDelta(d)
    if (d.humanReadable?.length > 0 && activeTrainedProfile) {
      setLivePreviewFilter(profileToCSSFilter(mergeProfileWithDelta(activeTrainedProfile, d)))
    }
  }

  // ── Batch processing ─────────────────────────────────────────────
  const startBatch = async () => {
    if (!photos.length) return

    if (effectiveProfile) {
      setProcessing(true)
      setProgress(null)
      processingStartRef.current = Date.now()

      try {
        const results = await processAllPhotos(
          photos,
          effectiveProfile,
          (done, total, name) => setProgress({ done, total, name, status: done === total ? 'done' : 'processing' })
        )
        setProcessedResults(results)
        setProgress({
          status:  'done',
          done:    results.length,
          total:   results.length,
          results: results.map(r => ({ id: r.photo.id })),
        })
        setLivePreviewFilter(null) // processed result is now authoritative
        try {
          localStorage.setItem('lumiereExportStats', JSON.stringify({
            batchId:        null,
            sessionId,
            processedCount: results.length,
            styles:         [effectiveProfile.name],
            results:        results.map(r => ({ id: r.photo.id })),
            clientSide:     true,
          }))
        } catch (_) {}
      } catch (err) {
        console.error('Client-side processing failed:', err)
      } finally {
        setProcessing(false)
      }
      return
    }

    // Backend processing for built-in presets
    const ids = location.state?.selectedIds || photos.map(p => p.id)
    setProcessing(true)
    setProgress(null)
    setBatchId(null)
    processingStartRef.current = Date.now()

    const form = new FormData()
    form.append('file_ids', ids.join(','))
    if (selectedPreset)        form.append('preset_id',     selectedPreset)
    if (selectedProfile)       form.append('profile_name',  selectedProfile)
    if (customPrompt.trim())   form.append('custom_prompt', customPrompt)
    if (sessionId)             form.append('session_id',    sessionId)

    try {
      const res = await fetch('https://lumiere-backend-xscg.onrender.com/process-batch', { method: 'POST', body: form })
      if (!res.ok) throw new Error('Failed to start batch')
      const data = await res.json()
      setBatchId(data.batch_id)
      startSSE(data.batch_id)
    } catch (err) {
      setProcessing(false)
      console.error(err)
    }
  }

  const startSSE = (bid) => {
    sseRef.current?.close()
    const es = new EventSource(`/process-batch/progress/${bid}`)
    sseRef.current = es
    es.onmessage = (e) => {
      const state = JSON.parse(e.data)
      setProgress(state)
      if (state.status === 'done') {
        setProcessing(false)
        es.close()
        const successful = (state.results || []).filter(r => !r.error)
        try {
          localStorage.setItem('lumiereExportStats', JSON.stringify({
            batchId: bid, sessionId,
            processedCount: successful.length,
            styles: [...new Set(successful.map(r => r.lighting).filter(Boolean))],
            results: successful,
          }))
        } catch (_) {}
      }
    }
    es.onerror = () => { setProcessing(false); es.close() }
  }

  const handleExport = () => navigate('https://lumiere-backend-xscg.onrender.com/export', { state: { batchId, sessionId } })

  const handleDeleteFromFilmstrip = (id) => {
    revokeThumbCache(id)
    const remaining = photos.filter(p => p.id !== id)
    setPhotos(remaining)
    if (previewPhoto?.id === id) setPreviewPhoto(remaining[0] || null)
  }

  const canApply = !processing && photos.length > 0 &&
    (!!selectedPreset || !!selectedProfile || !!customPrompt.trim() || !!activeTrainedProfile)

  const handleModeChange = (m) => { setEditMode(m); setSelectedPreset(null) }

  const handleSelectPreset = (id) => {
    setSelectedPreset(prev => prev === id ? null : id)
    setActiveTrainedProfile(null)
  }

  const handleSelectTrainedProfile = (profile) => {
    setActiveTrainedProfile(prev => prev?.id === profile.id ? null : profile)
    setSelectedPreset(null)
    resetDirection()
  }

  const hasDirection = directionDelta?.humanReadable?.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#0A0908' }}>

      {/* Processing overlay — full screen, shown during batch */}
      {processing && (
        <ProcessingOverlay
          done={progress?.done || 0}
          total={progress?.total || photos.length}
          currentName={progress?.name || ''}
          startTime={processingStartRef.current}
          onCancel={() => { setProcessing(false); sseRef.current?.close() }}
        />
      )}

      {/* Three-panel row */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── LEFT RAIL: preset picker (290px) ─────────────────────── */}
        <div style={{
          width: 290, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          borderRight: '1px solid rgba(201,168,76,0.08)',
          background: '#0A0908',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <ModeSwitch mode={editMode} onChange={handleModeChange} />

          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 48, scrollbarWidth: 'thin', scrollbarColor: 'rgba(201,168,76,0.2) transparent' }}>

            {savedProfiles.length > 0 && (
              <div>
                <div style={{ padding: '16px 16px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 8, color: '#C9A84C' }}>✦</span>
                  <span style={{ fontSize: 9, letterSpacing: '0.18em', color: '#C9A84C', fontWeight: 500 }}>YOUR TRAINED STYLES</span>
                </div>

                {savedProfiles.map(profile => {
                  const isActive = activeTrainedProfile?.id === profile.id
                  return (
                    <div
                      key={profile.id}
                      onClick={() => handleSelectTrainedProfile(profile)}
                      style={{
                        padding: '10px 16px', cursor: 'pointer',
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        borderLeft: isActive ? '3px solid #C9A84C' : '3px solid transparent',
                        background: isActive ? 'rgba(201,168,76,0.08)' : 'transparent',
                        transition: 'all 150ms ease',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(201,168,76,0.04)' }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{ color: isActive ? '#C9A84C' : '#8B6B3D', fontSize: 14, marginTop: 1, flexShrink: 0 }}>✦</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: isActive ? '#C9A84C' : '#F0EBE0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {profile.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#4A4540', marginTop: 2 }}>
                          Learned · {profile.pairCount} pair{profile.pairCount !== 1 ? 's' : ''}
                        </div>
                        <div style={{ fontSize: 10, color: '#8B6B3D', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {[
                            profile.exposure   ? `exp ${profile.exposure > 0 ? '+' : ''}${profile.exposure.toFixed(1)}`           : null,
                            profile.shadows    ? `shad ${profile.shadows > 0 ? '+' : ''}${Math.round(profile.shadows)}`           : null,
                            profile.temperature ? `temp ${profile.temperature > 0 ? '+' : ''}${Math.round(profile.temperature)}K` : null,
                          ].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      {isActive && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C', marginTop: 5, flexShrink: 0 }} />}
                    </div>
                  )
                })}

                <div style={{ height: 1, background: 'rgba(201,168,76,0.08)', margin: '8px 0' }} />
              </div>
            )}

            <div style={{ fontSize: 9, letterSpacing: '0.18em', color: '#4A4540', padding: '12px 16px 4px', fontWeight: 500 }}>
              STYLE PRESETS
            </div>

            {Object.entries(activePresetGroups).map(([group, items]) => (
              <div key={`${editMode}-${group}`} style={{ animation: 'fade 200ms ease' }}>
                <div style={{ padding: '10px 16px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 7, color: '#8B6B3D' }}>◆</span>
                  <span style={{ fontSize: 8, letterSpacing: '0.18em', color: '#8B6B3D', fontWeight: 500, textTransform: 'uppercase' }}>
                    {group}
                  </span>
                </div>
                {items.map(preset => (
                  <PresetItem
                    key={preset.id}
                    preset={preset}
                    isActive={selectedPreset === preset.id}
                    onClick={() => handleSelectPreset(preset.id)}
                  />
                ))}
              </div>
            ))}
          </div>

          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 48,
            background: 'linear-gradient(transparent, #0A0908)',
            pointerEvents: 'none',
          }} />
        </div>

        {/* ── CENTRE: preview + filmstrip ──────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Done banner — only shown after processing completes */}
          {progress?.status === 'done' && (
            <div style={{
              padding: '8px 16px', borderBottom: '1px solid rgba(201,168,76,0.08)',
              background: '#111009', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#4A8C6A' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4A8C6A' }} />
                {effectiveProfile
                  ? `Canvas complete · ${progress.results?.length || 0} photos processed at 0.97 quality`
                  : `Batch complete · ${progress.results?.length || 0} photos processed`}
              </div>
            </div>
          )}

          {/* Preview */}
          <div style={{ flex: 1, overflow: 'hidden', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: 16, color: '#F0EBE0' }}>
                  Preview
                </span>
                {previewPhoto && (
                  <span style={{ fontSize: 10, color: '#4A4540' }}>{previewPhoto.filename || previewPhoto.name}</span>
                )}
              </div>
              {(activePresetObj || activeTrainedProfile) && (
                <span style={{
                  fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: '#C9A84C', padding: '2px 8px',
                  background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.20)',
                  borderRadius: 3,
                }}>
                  {activeTrainedProfile
                    ? `✦ ${activeTrainedProfile.name}${isDirectionApplied ? ' + Direction' : ''}`
                    : activePresetObj.name}
                </span>
              )}
            </div>

            {photos.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: 12, color: '#4A4540', marginBottom: 6 }}>No photos in this session.</p>
                <a href="/upload" style={{ fontSize: 11, color: '#C9A84C', textDecoration: 'none' }}>Go to Import →</a>
              </div>
            ) : (
              <div style={{ flex: 1, minHeight: 0 }}>
                <BeforeAfterSlider
                  beforeSrc={previewPhoto?.previewUrl || previewPhoto?.thumb_url}
                  afterSrc={previewResult}
                  preset={sliderPreset}
                  photoId={previewPhoto?.id}
                  filterOverride={livePreviewFilter}
                />
              </div>
            )}
          </div>

          {/* Filmstrip */}
          {photos.length > 0 && (
            <div style={{
              height: 92, flexShrink: 0,
              borderTop: '1px solid rgba(201,168,76,0.08)',
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', overflowX: 'auto',
              scrollbarWidth: 'thin', scrollbarColor: 'rgba(201,168,76,0.2) transparent',
            }}>
              {photos.map(photo => {
                const processed = progress?.results?.find(r => r.id === photo.id)
                return (
                  <FilmstripCard
                    key={photo.id}
                    photo={photo}
                    isActive={previewPhoto?.id === photo.id}
                    processed={!!processed}
                    onSelect={() => setPreviewPhoto(photo)}
                    onDelete={() => handleDeleteFromFilmstrip(photo.id)}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT RAIL: adjustments (320px) ──────────────────────── */}
        <div style={{
          width: 320, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          borderLeft: '1px solid rgba(201,168,76,0.08)',
          background: '#0A0908',
          overflowY: 'auto',
          scrollbarWidth: 'thin', scrollbarColor: 'rgba(201,168,76,0.2) #1A1712',
        }}>
          {/* Server-side saved style profile */}
          {profiles.length > 0 && (
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
              <div style={{ fontSize: 9, letterSpacing: '0.18em', color: '#4A4540', marginBottom: 8, fontWeight: 500 }}>
                SAVED STYLE
              </div>
              <select
                value={selectedProfile}
                onChange={e => setSelectedProfile(e.target.value)}
                style={{
                  width: '100%', fontSize: 11,
                  background: '#111009', color: '#F0EBE0',
                  border: '1px solid rgba(201,168,76,0.15)',
                  borderRadius: 6, padding: '7px 10px',
                  cursor: 'pointer', outline: 'none',
                  fontFamily: 'Inter, sans-serif', appearance: 'none',
                }}
              >
                <option value="">None — use preset only</option>
                {profiles.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
          )}

          {/* Custom Direction */}
          <CustomDirectionPanel
            customPrompt={customPrompt}
            directionDelta={directionDelta}
            isDirectionApplied={isDirectionApplied}
            activeTrainedProfile={activeTrainedProfile}
            photoCount={photos.length}
            onTextChange={handleDirectionChange}
            onApply={handleApplyDirection}
            onReset={resetDirection}
            onPill={handlePillClick}
          />

          {/* Fine-tune sliders */}
          <div style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.18em', color: '#4A4540', marginBottom: 14, fontWeight: 500 }}>
              FINE-TUNE
            </div>
            {activeTrainedProfile ? (
              <>
                <AnimatedSlider label="Exposure"    value={effectiveProfile?.exposure   ?? 0}                     unit="EV" min={-3} max={3}  readOnly />
                <AnimatedSlider label="Temperature" value={(effectiveProfile?.temperature ?? 0) / 2000}            unit="K"  min={-1} max={1}  readOnly />
                <AnimatedSlider label="Contrast"    value={(effectiveProfile?.contrast   ?? 0) / 100}              unit=""   min={-1} max={1}  readOnly />
                <AnimatedSlider label="Saturation"  value={(effectiveProfile?.saturation ?? 0) / 100}              unit=""   min={-1} max={1}  readOnly />
                <AnimatedSlider label="Shadows"     value={(effectiveProfile?.shadows    ?? 0) / 100}              unit=""   min={-1} max={1}  readOnly />
              </>
            ) : (
              <>
                <AnimatedSlider label="Exposure"    value={activePresetObj?.exposure   ?? 0}    unit="EV" min={-3} max={3}  readOnly />
                <AnimatedSlider label="Warmth"      value={activePresetObj?.warmth     ?? 0}    unit="K"  min={-1} max={1}  readOnly />
                <AnimatedSlider label="Contrast"    value={activePresetObj?.contrast   ?? 0}    unit=""   min={-1} max={1}  readOnly />
                <AnimatedSlider label="Saturation"  value={activePresetObj?.saturation ?? 0}    unit=""   min={-1} max={1}  readOnly />
                <AnimatedSlider label="Shadows"     value={0}                                   unit="EV" min={-3} max={3}  readOnly />
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── BOTTOM ACTION BAR ────────────────────────────────────── */}
      <div style={{
        height: 56, flexShrink: 0,
        background: '#0A0908', borderTop: '1px solid rgba(201,168,76,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px',
      }}>
        <span style={{ fontSize: 10, color: '#4A4540', letterSpacing: '0.08em' }}>
          {photos.length} FRAMES
          {progress?.status === 'done'
            ? ` · ${progress.results?.length || 0} PROCESSED`
            : processing
              ? ' · PROCESSING…'
              : canApply
                ? effectiveProfile
                  ? ' · CANVAS READY'
                  : ' · READY TO PROCESS'
                : ' · SELECT A PRESET'}
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          {progress?.status === 'done' && (
            <button
              onClick={handleExport}
              style={{
                padding: '8px 16px', borderRadius: 6,
                border: '1px solid rgba(201,168,76,0.30)',
                background: 'transparent', color: '#8A8070',
                fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                transition: 'border-color .18s ease, color .18s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.60)'; e.currentTarget.style.color = '#F0EBE0' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.30)'; e.currentTarget.style.color = '#8A8070' }}
            >
              Export
            </button>
          )}
          <button
            onClick={startBatch}
            disabled={!canApply}
            style={{
              background: canApply ? 'linear-gradient(135deg, #C9A84C 0%, #A8893A 100%)' : '#2A2520',
              color: canApply ? '#1A1200' : '#4A4540',
              border: 'none', borderRadius: 6,
              padding: '8px 20px',
              fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase',
              fontWeight: 600, cursor: canApply ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: 'Inter, sans-serif',
              transition: 'background .18s ease',
            }}
          >
            Process All →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Processing overlay ────────────────────────────────────────────
function ProcessingOverlay({ done, total, currentName, startTime, onCancel }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  const pct      = total > 0 ? Math.round((done / total) * 100) : 0
  const elapsed  = now - (startTime || now)
  const eta      = done > 0 && done < total
    ? Math.round(((total - done) / done) * elapsed / 1000)
    : null

  const circumference = 2 * Math.PI * 44

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(10,9,8,0.92)', backdropFilter: 'blur(12px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 28,
    }}>
      {/* Circular progress ring */}
      <div style={{ position: 'relative', width: 100, height: 100 }}>
        <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(201,168,76,0.1)" strokeWidth="2" />
          <circle
            cx="50" cy="50" r="44" fill="none"
            stroke="#C9A84C" strokeWidth="2"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct / 100)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 400ms ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: '"Playfair Display", serif', fontSize: 22,
          color: '#C9A84C', fontVariantNumeric: 'tabular-nums',
        }}>
          {pct}%
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: 20, color: '#F0EBE0', marginBottom: 6 }}>
          Processing your shoot
        </div>
        <div style={{ fontSize: 13, color: '#8A8070' }}>
          {done} of {total} photos{currentName ? ` · ${currentName}` : ''}
        </div>
        {eta !== null && (
          <div style={{ fontSize: 12, color: '#4A4540', marginTop: 4 }}>~{eta}s remaining</div>
        )}
      </div>

      <button
        onClick={onCancel}
        style={{
          padding: '8px 20px', borderRadius: 8,
          background: 'transparent', border: '1px solid rgba(201,168,76,0.2)',
          color: '#4A4540', fontSize: 12, cursor: 'pointer',
          transition: 'all 150ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.45)'; e.currentTarget.style.color = '#8A8070' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.2)'; e.currentTarget.style.color = '#4A4540' }}
      >
        Cancel
      </button>
    </div>
  )
}

// ─── Custom Direction panel ────────────────────────────────────────
function CustomDirectionPanel({
  customPrompt, directionDelta, isDirectionApplied,
  activeTrainedProfile, photoCount,
  onTextChange, onApply, onReset, onPill,
}) {
  const hasChanges  = directionDelta?.humanReadable?.length > 0
  const onlyTrainedProfileActive = !!activeTrainedProfile

  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.18em', color: '#4A4540', marginBottom: 10, fontWeight: 500 }}>
        CUSTOM DIRECTION
      </div>

      {/* Textarea */}
      <div style={{ position: 'relative' }}>
        <textarea
          value={customPrompt}
          onChange={e => onTextChange(e.target.value)}
          placeholder={'Type any adjustment in plain English…\n\ne.g. "more exposed and clear, warmer"\n"lift shadows slightly, more film grain"\n"softer, muted colours, dreamy"'}
          rows={5}
          style={{
            width: '100%', background: '#0D0B09',
            border: `1px solid ${hasChanges ? 'rgba(201,168,76,0.45)' : 'rgba(201,168,76,0.15)'}`,
            borderRadius: 8, padding: '10px 12px',
            fontSize: 13, color: '#F0EBE0', lineHeight: 1.7,
            resize: 'none', outline: 'none',
            fontFamily: 'Inter, sans-serif',
            transition: 'border-color 200ms ease',
            boxSizing: 'border-box',
          }}
        />
        {customPrompt && !isDirectionApplied && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            width: 6, height: 6, borderRadius: '50%',
            background: hasChanges ? '#C9A84C' : '#4A4540',
          }} />
        )}
      </div>

      {/* Detected changes card */}
      {hasChanges && !isDirectionApplied && (
        <div style={{
          marginTop: 8,
          background: 'rgba(201,168,76,0.04)',
          border: '1px solid rgba(201,168,76,0.12)',
          borderRadius: 8, padding: '10px 12px',
          animation: 'fade 200ms ease',
        }}>
          <div style={{ fontSize: 9, letterSpacing: '0.1em', color: '#8B6B3D', marginBottom: 6 }}>
            DETECTED CHANGES
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {directionDelta.humanReadable.map((change, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#C9A84C' }}>
                <span style={{ color: '#8B6B3D', fontSize: 8 }}>◆</span>
                {change}
              </div>
            ))}
          </div>
          {onlyTrainedProfileActive && (
            <div style={{ fontSize: 10, color: '#4A4540', marginTop: 6, fontStyle: 'italic' }}>
              Preview updating live on the AFTER side →
            </div>
          )}
        </div>
      )}

      {/* Applied confirmation */}
      {isDirectionApplied && (
        <div style={{
          marginTop: 8, padding: '8px 12px',
          background: 'rgba(74,140,106,0.08)',
          border: '1px solid rgba(74,140,106,0.2)',
          borderRadius: 8, fontSize: 11, color: '#4A8C6A',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>✓</span> Modifications applied to this photo
        </div>
      )}

      {/* Apply / Reset buttons */}
      {onlyTrainedProfileActive && (
        <>
          <button
            onClick={onApply}
            disabled={!hasChanges || isDirectionApplied}
            style={{
              width: '100%', marginTop: 10,
              padding: '11px', borderRadius: 8, border: 'none',
              background: hasChanges && !isDirectionApplied
                ? 'linear-gradient(135deg, #C9A84C 0%, #A8893A 100%)'
                : '#1A1712',
              color: hasChanges && !isDirectionApplied ? '#1A1200' : '#4A4540',
              fontSize: 12, letterSpacing: '0.1em', fontWeight: 600,
              cursor: hasChanges && !isDirectionApplied ? 'pointer' : 'not-allowed',
              transition: 'all 200ms ease',
              fontFamily: 'Inter, sans-serif',
            }}
            onMouseEnter={e => { if (hasChanges && !isDirectionApplied) e.currentTarget.style.boxShadow = '0 0 20px rgba(201,168,76,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
          >
            {isDirectionApplied ? '✓ APPLIED' : '✦ APPLY MODIFICATIONS'}
          </button>
          {isDirectionApplied && (
            <button
              onClick={onReset}
              style={{
                width: '100%', marginTop: 6,
                padding: '8px', background: 'transparent', border: 'none',
                color: '#4A4540', fontSize: 11, cursor: 'pointer',
                transition: 'color 150ms', fontFamily: 'Inter, sans-serif',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#8A8070'}
              onMouseLeave={e => e.currentTarget.style.color = '#4A4540'}
            >
              Reset to trained style
            </button>
          )}
        </>
      )}

      {/* Status line + quick pills */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(201,168,76,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#C9A84C', fontSize: 11 }}>⬡</span>
          <span style={{ fontSize: 10, letterSpacing: '0.08em', color: '#8A8070', textTransform: 'uppercase' }}>Skin Protect On</span>
        </div>
        <span style={{ fontSize: 10, color: '#4A4540' }}>{photoCount} frames</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
        {Object.keys(PILL_ACTIONS).map(pill => (
          <button
            key={pill}
            onClick={() => onPill(pill)}
            style={{
              fontSize: 10, padding: '4px 9px', borderRadius: 99,
              background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.18)',
              color: '#8A8070', cursor: 'pointer', transition: 'all 150ms ease',
              fontFamily: 'Inter, sans-serif',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.40)'; e.currentTarget.style.color = '#F0EBE0' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.18)'; e.currentTarget.style.color = '#8A8070' }}
          >
            {pill}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Mode switch ───────────────────────────────────────────────────
function ModeSwitch({ mode, onChange }) {
  return (
    <div style={{ padding: '12px 12px 0' }}>
      <div style={{
        display: 'flex', background: '#0A0908',
        border: '1px solid rgba(201,168,76,0.15)',
        borderRadius: 99, padding: 3, gap: 2,
      }}>
        {['wedding', 'general'].map(m => (
          <button
            key={m}
            onClick={() => onChange(m)}
            style={{
              flex: 1, padding: '7px 10px',
              borderRadius: 99, border: 'none', cursor: 'pointer',
              fontSize: 10, letterSpacing: '0.08em', fontWeight: 500,
              transition: 'all 200ms ease',
              background: mode === m ? 'linear-gradient(135deg, #C9A84C 0%, #A8893A 100%)' : 'transparent',
              color: mode === m ? '#1A1200' : '#4A4540',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {m === 'wedding' ? '♦ WEDDING' : '⬡ GENERAL'}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Preset item ───────────────────────────────────────────────────
function PresetItem({ preset, isActive, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 16px', cursor: 'pointer',
        display: 'flex', alignItems: 'flex-start', gap: 10,
        borderLeft: `3px solid ${isActive ? '#C9A84C' : 'transparent'}`,
        background: isActive ? 'rgba(201,168,76,0.07)' : 'transparent',
        transition: 'all 150ms ease',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(201,168,76,0.04)' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: isActive ? 500 : 400,
          color: isActive ? '#C9A84C' : '#F0EBE0',
          lineHeight: 1.2, marginBottom: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {preset.name}
        </div>
        <div style={{ fontSize: 10, color: '#4A4540', lineHeight: 1.3 }}>{preset.desc}</div>
      </div>
      {isActive && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C', flexShrink: 0, marginTop: 6 }} />}
    </div>
  )
}

// ─── Filmstrip card — uses 150px thumbnail, not full-res URL ──────
function FilmstripCard({ photo, isActive, processed, onSelect, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const [thumbUrl, setThumbUrl] = useState(photo.thumb_url || null)

  useEffect(() => {
    let cancelled = false
    getThumbnail(photo, 150).then(url => { if (!cancelled && url) setThumbUrl(url) })
    return () => { cancelled = true }
  }, [photo.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{ position: 'relative', flexShrink: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        onClick={onSelect}
        style={{
          width: 68, height: 68, borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
          border: isActive ? '2px solid #C9A84C' : '1px solid rgba(201,168,76,0.12)',
          transform: isActive ? 'scale(1.06)' : 'scale(1)',
          boxShadow: isActive ? '0 0 12px rgba(201,168,76,0.30)' : 'none',
          transition: 'all 180ms ease',
        }}
      >
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#1A1712' }} />
        )}
      </div>
      {processed && (
        <div style={{
          position: 'absolute', bottom: 3, right: 3,
          width: 8, height: 8, borderRadius: '50%',
          background: '#4A8C6A', border: '1px solid #0A0908',
        }} />
      )}
      {hovered && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{
            position: 'absolute', top: -6, right: -6,
            width: 18, height: 18, borderRadius: '50%',
            background: '#C44B3A', border: 'none',
            color: '#F0EBE0', fontSize: 9, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fade 120ms ease', zIndex: 10,
          }}
        >✕</button>
      )}
    </div>
  )
}

// ─── Animated slider — tweens to new value over 400ms ─────────────
function AnimatedSlider({ label, value: targetValue, unit, min, max, readOnly }) {
  const displayRef = useRef(targetValue)
  const [renderVal, setRenderVal] = useState(targetValue)
  const animRef    = useRef(null)

  useEffect(() => {
    const start    = displayRef.current
    const end      = targetValue
    if (start === end) return

    const duration  = 400
    const startTime = performance.now()
    cancelAnimationFrame(animRef.current)

    function step(now) {
      const t      = Math.min((now - startTime) / duration, 1)
      const eased  = 1 - Math.pow(1 - t, 3) // ease-out cubic
      const val    = start + (end - start) * eased
      displayRef.current = val
      setRenderVal(val)
      if (t < 1) animRef.current = requestAnimationFrame(step)
      else displayRef.current = end
    }
    animRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animRef.current)
  }, [targetValue])

  const pct = ((renderVal - min) / (max - min)) * 100

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#8A8070' }}>{label}</span>
        <span className="num" style={{ fontSize: 12, color: '#C9A84C', fontVariantNumeric: 'tabular-nums' }}>
          {renderVal > 0 ? '+' : ''}{label === 'Exposure' ? renderVal.toFixed(2) : Math.round(renderVal)}
          {unit && <span style={{ fontSize: 10, color: '#4A4540', marginLeft: 3 }}>{unit}</span>}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={0.001}
        value={renderVal}
        onChange={() => {}} // controlled — readOnly in current usage
        readOnly={readOnly}
        style={{
          width: '100%', height: 2, cursor: readOnly ? 'default' : 'pointer',
          background: `linear-gradient(to right, #C9A84C ${pct}%, rgba(201,168,76,0.18) ${pct}%)`,
          opacity: readOnly ? 0.7 : 1,
        }}
      />
    </div>
  )
}
