// LocalStorage persistence + CSS filter + canvas pixel processing for style profiles

const STORAGE_KEY = 'lumiere_style_profiles'

export function saveProfile(profile) {
  const existing = loadProfiles()
  const updated  = [profile, ...existing.filter(p => p.id !== profile.id)]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

export function loadProfiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function deleteProfile(id) {
  const existing = loadProfiles()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.filter(p => p.id !== id)))
}

// Conservative CSS filter for live preview — display only, not actual edits
export function profileToCSSFilter(profile) {
  const e  = profile.exposure    ?? 0
  const c  = profile.contrast    ?? 0
  const s  = profile.saturation  ?? 0
  const w  = profile.temperature ?? 0
  const sh = profile.shadows     ?? 0

  const brightness = (1 + e * 0.25 + sh * 0.001).toFixed(3)
  const contrast   = (1 + c * 0.003).toFixed(3)
  const saturate   = (1 + s * 0.008).toFixed(3)
  const sepia      = w > 0 ? Math.min(w / 2000 * 0.2, 0.2).toFixed(3) : '0'
  const hueRotate  = w !== 0 ? `hue-rotate(${(-w / 2000 * 8).toFixed(1)}deg)` : ''

  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturate}) sepia(${sepia}) ${hueRotate}`.trim()
}

// Returns an object compatible with BeforeAfterSlider's buildFilterString
// which reads: exposure (-3..+3), contrast (-1..+1), saturation (-1..+1), warmth (-1..+1)
export function profileToPresetShape(profile) {
  return {
    id:         profile.id,
    name:       profile.name,
    exposure:   profile.exposure   ?? 0,
    contrast:   (profile.contrast  ?? 0) / 100,
    saturation: (profile.saturation ?? 0) / 100,
    warmth:     (profile.temperature ?? 0) / 2000,
  }
}

// Apply profile to canvas pixel data at full natural resolution
export function applyProfileToCanvas(ctx, width, height, profile) {
  const imageData = ctx.getImageData(0, 0, width, height)
  const data      = imageData.data

  const exposure    = profile.exposure    ?? 0
  const contrast    = profile.contrast    ?? 0
  const saturation  = profile.saturation  ?? 0
  const temperature = profile.temperature ?? 0
  const shadows     = profile.shadows     ?? 0
  const highlights  = profile.highlights  ?? 0
  const blacks      = profile.blacks      ?? 0
  const whites      = profile.whites      ?? 0
  const orangeSat   = profile.hsl?.orange?.sat ?? 0
  const orangeLum   = profile.hsl?.orange?.lum ?? 0
  const blueSat     = profile.hsl?.blue?.sat   ?? 0

  const exposureMult  = Math.pow(2, exposure * 0.5)
  const contrastFact  = contrast !== 0
    ? (259 * (contrast * 1.27 + 255)) / (255 * (259 - contrast * 1.27))
    : 1
  const warmR         = temperature > 0 ?  (temperature / 2000) * 25 : 0
  const warmB         = temperature < 0 ? -(temperature / 2000) * 25 : 0
  const shadowBoost   = (shadows    / 100) * 30
  const highlightPull = (highlights / 100) * 20
  const blackPull     = (blacks     / 100) * 15
  const whiteBoost    = (whites     / 100) * 10

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]

    const lum = r * 0.2126 + g * 0.7152 + b * 0.0722

    // Exposure
    r = Math.min(255, r * exposureMult)
    g = Math.min(255, g * exposureMult)
    b = Math.min(255, b * exposureMult)

    // Shadows — lift dark areas
    if (lum < 80) {
      const w = 1 - lum / 80
      r = Math.min(255, r + shadowBoost * w)
      g = Math.min(255, g + shadowBoost * w)
      b = Math.min(255, b + shadowBoost * w)
    }

    // Blacks — deepen deepest tones
    if (lum < 40) {
      const w = 1 - lum / 40
      r = Math.max(0, r + blackPull * w)
      g = Math.max(0, g + blackPull * w)
      b = Math.max(0, b + blackPull * w)
    }

    // Highlights
    if (lum > 180) {
      const w = (lum - 180) / 75
      r = Math.max(0, r + highlightPull * w)
      g = Math.max(0, g + highlightPull * w)
      b = Math.max(0, b + highlightPull * w)
    }

    // Whites
    if (lum > 220) {
      r = Math.min(255, r + whiteBoost)
      g = Math.min(255, g + whiteBoost)
      b = Math.min(255, b + whiteBoost)
    }

    // Contrast
    if (contrast !== 0) {
      r = Math.min(255, Math.max(0, contrastFact * (r - 128) + 128))
      g = Math.min(255, Math.max(0, contrastFact * (g - 128) + 128))
      b = Math.min(255, Math.max(0, contrastFact * (b - 128) + 128))
    }

    // Temperature
    r = Math.min(255, r + warmR)
    b = Math.min(255, b + warmB)

    // Saturation
    if (saturation !== 0) {
      const gray   = 0.2126 * r + 0.7152 * g + 0.0722 * b
      const factor = 1 + saturation / 100
      r = Math.min(255, Math.max(0, gray + (r - gray) * factor))
      g = Math.min(255, Math.max(0, gray + (g - gray) * factor))
      b = Math.min(255, Math.max(0, gray + (b - gray) * factor))
    }

    // Orange channel (skin tones)
    if (r > 140 && g > 70 && g < 190 && b < 110 && r > g && r > b) {
      const orangeWeight = Math.min(1, (r - b) / 150)
      if (orangeSat !== 0) {
        const gray    = 0.2126 * r + 0.7152 * g + 0.0722 * b
        const oFactor = 1 + orangeSat / 100
        r = Math.min(255, Math.max(0, gray + (r - gray) * oFactor))
        g = Math.min(255, Math.max(0, gray + (g - gray) * oFactor))
        b = Math.min(255, Math.max(0, gray + (b - gray) * oFactor))
      }
      if (orangeLum !== 0) {
        const lBoost = (orangeLum / 100) * 20 * orangeWeight
        r = Math.min(255, r + lBoost)
        g = Math.min(255, g + lBoost * 0.8)
        b = Math.min(255, b + lBoost * 0.3)
      }
    }

    // Blue channel (desaturate cool tones)
    if (b > r + 20 && b > g + 10) {
      if (blueSat !== 0) {
        const gray    = 0.2126 * r + 0.7152 * g + 0.0722 * b
        const bFactor = 1 + blueSat / 100
        r = Math.min(255, Math.max(0, gray + (r - gray) * bFactor))
        g = Math.min(255, Math.max(0, gray + (g - gray) * bFactor))
        b = Math.min(255, Math.max(0, gray + (b - gray) * bFactor))
      }
    }

    data[i]     = Math.round(r)
    data[i + 1] = Math.round(g)
    data[i + 2] = Math.round(b)
  }

  ctx.putImageData(imageData, 0, 0)
}
