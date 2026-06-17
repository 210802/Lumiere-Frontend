// Deep style analysis — derives AI insights, film stock match, lighting fingerprint,
// radar scores, and dominant colours from pixel data. Pure functions, no API calls.

// ── AI Insights ───────────────────────────────────────────────────────

export function generateAIInsights(params) {
  const i = []
  if (params.temperature > 200)    i.push('This style prefers warm highlights with a golden-amber cast.')
  if (params.temperature < -200)   i.push('Consistent cool-blue grading, typical of editorial fashion work.')
  if (params.shadows > 20)         i.push('Shadow detail consistently lifted, preserving texture in dark areas.')
  if (params.blackPoint < -15 && params.shadows > 15)
    i.push('Classic S-curve: lifted shadows with crushed blacks for depth without flatness.')
  if (params.grainIntensity > 15)  i.push('Visible grain suggests a deliberate analog film aesthetic.')
  if (params.dynamicRange > 75)    i.push('High dynamic range — detail maintained across highlights and shadows.')
  if (params.vignetteStrength > 20) i.push('Vignette consistently applied to draw focus toward the subject.')
  if (params.hsl?.orange?.sat > 15) i.push('Orange channel boost consistently enhances warm skin tones.')
  if (params.hsl?.blue?.sat < -10)  i.push('Blue saturation suppressed — cool tones subordinate to warm hues.')
  if (params.symmetryScore > 70)    i.push('Composition strongly favours centred, symmetrical framing.')
  if (params.rimLightDetected)      i.push('Rim lighting frequently detected — adds subject dimensionality.')
  if (params.filmStockMatch && params.filmStockMatch !== 'Digital Clean')
    i.push(`Colour science resembles ${params.filmStockMatch} characteristics.`)
  if (params.colorGradingProfile === 'Warm Cinematic')
    i.push('Aesthetic aligns with high-end commercial and luxury brand photography.')
  return i.slice(0, 6)
}

export function generateAIDescription(params, name) {
  const warmth = params.temperature > 100 ? 'warm' : params.temperature < -100 ? 'cool' : 'neutral'
  const drama  = params.contrast > 20 ? 'high-contrast' : params.contrast < -10 ? 'flat and muted' : 'balanced'
  const skin   = params.hsl?.orange?.sat > 10 ? 'with enhanced skin tones' : ''
  const film   = params.grainIntensity > 10 ? `and a ${(params.filmStockMatch ?? 'filmic').toLowerCase()} character` : ''
  const grade  = params.colorGradingProfile ?? 'Neutral Balanced'
  const light  = params.lightSoftness ?? 'mixed'
  return `${name} is a ${warmth}-toned, ${drama} style ${skin} ${film}. ${grade} aesthetic with ${light.toLowerCase()} lighting.`
    .replace(/\s{2,}/g, ' ').trim()
}

// ── Radar scores (0–100 for each axis) ───────────────────────────────

export function computeRadarScores(params) {
  const cl = (v, mn, mx) => Math.max(mn, Math.min(mx, v))
  return {
    contrast:      cl(50 + (params.contrast   ?? 0) * 0.5, 0, 100),
    saturation:    cl(50 + (params.saturation ?? 0) * 0.5, 0, 100),
    sharpness:     cl(params.sharpness     ?? 50, 0, 100),
    dynamicRange:  cl(params.dynamicRange  ?? 50, 0, 100),
    warmth:        cl(50 + (params.temperature ?? 0) / 40, 0, 100),
    vibrance:      cl(50 + (params.vibrance   ?? 0) * 0.5, 0, 100),
    texture:       cl(params.texture       ?? 40, 0, 100),
    cinematicFeel: cl(
      (params.filmicCurve     ? 20 : 0) +
      (params.grainIntensity > 10 ? 15 : 0) +
      (params.vignetteStrength > 10 ? 15 : 0) +
      ((params.dynamicRange ?? 50) * 0.3) +
      ((params.highlightRollOff ?? 50) * 0.2),
      0, 100
    ),
  }
}

// ── Film stock fingerprint ────────────────────────────────────────────

export function matchFilmStock(params) {
  const w = params.temperature ?? 0
  const s = params.saturation  ?? 0
  const c = params.contrast    ?? 0
  if (w > 200 && s > 10 && c > 15)  return 'Kodak Portra 400 Inspired'
  if (w < -100 && s < 0  && c > 20) return 'Fuji Velvia Inspired'
  if (w > 100  && s < 5  && c < 10) return 'Kodak Vision3 Inspired'
  if (w < -200 && s < -5)           return 'Fuji Provia Inspired'
  if (c > 25   && s > 15)           return 'Kodak Ektar Inspired'
  return 'Digital Clean'
}

export function classifyColorGrade(params) {
  const w = params.temperature ?? 0
  const s = params.saturation  ?? 0
  if (w > 200  && s > 10)  return 'Warm Cinematic'
  if (w < -100 && s > 10)  return 'Cool Editorial'
  if (s < -10)              return 'Desaturated Moody'
  if (w > 100  && s > 20)  return 'Vibrant Natural'
  return 'Neutral Balanced'
}

// ── Pixel-level visual analysis ────────────────────────────────────────

// Sample dominant colours from pixel data (5 representative values)
export function extractDominantColors(imageData) {
  const d     = imageData.data
  const total = imageData.data.length / 4
  const step  = Math.max(1, Math.floor(total / 500))
  const hexes = []

  for (let i = 0; i < 500 && i * step * 4 + 2 < d.length; i++) {
    const idx = i * step * 4
    const r = d[idx], g = d[idx + 1], b = d[idx + 2]
    hexes.push(
      '#' +
      r.toString(16).padStart(2, '0') +
      g.toString(16).padStart(2, '0') +
      b.toString(16).padStart(2, '0')
    )
  }

  // Sort by luminance and take 5 spread-out samples
  const sorted = hexes.sort()
  const spacing = Math.max(1, Math.floor(sorted.length / 5))
  return Array.from({ length: 5 }, (_, i) => sorted[Math.min(i * spacing, sorted.length - 1)])
}

// 3×3 zone lighting analysis
export function analyseLighting(imageData) {
  const d = imageData.data
  const w = imageData.width
  const h = imageData.height
  const zones  = new Array(9).fill(0)
  const counts = new Array(9).fill(0)

  // Sample every 4th pixel for speed
  for (let y = 0; y < h; y += 4) {
    for (let x = 0; x < w; x += 4) {
      const idx = (y * w + x) * 4
      const lum = d[idx] * 0.2126 + d[idx + 1] * 0.7152 + d[idx + 2] * 0.0722
      const zx  = Math.min(2, Math.floor(x / w * 3))
      const zy  = Math.min(2, Math.floor(y / h * 3))
      zones[zy * 3 + zx]  += lum
      counts[zy * 3 + zx] += 1
    }
  }

  const avg  = zones.map((z, i) => counts[i] > 0 ? z / counts[i] : 0)
  const maxZ = avg.indexOf(Math.max(...avg))
  const minV = Math.min(...avg)
  const maxV = Math.max(...avg)

  const DIRS = ['Top-Left','Top','Top-Right','Left','Frontal','Right','Bottom-Left','Bottom','Bottom-Right']

  // White balance from R/B ratio
  let totalR = 0, totalB = 0, cnt = 0
  for (let i = 0; i < d.length; i += 16) {
    totalR += d[i]
    totalB += d[i + 2]
    cnt++
  }
  const rb = totalR / (totalB + 1)

  // Rim: corners brighter than centre
  const cornerAvg = (avg[0] + avg[2] + avg[6] + avg[8]) / 4

  return {
    direction:    DIRS[maxZ] ?? 'Mixed',
    ratio:        Math.min(minV > 0 ? maxV / minV : 4, 8),
    softness:     avg.reduce((s, v) => s + (v - maxV / 2) ** 2, 0) / avg.length < 1000 ? 'Soft' : 'Hard',
    colorTemp:    rb > 1.3 ? 3200 : rb > 1.1 ? 4500 : rb > 0.9 ? 5500 : 7000,
    rimDetected:  cornerAvg > avg[4] * 1.4,
  }
}

// Laplacian-based sharpness metric (0–100)
export function computeSharpness(imageData) {
  const d    = imageData.data
  const w    = imageData.width
  const h    = imageData.height
  const lum  = (i) => d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722
  const step = 4
  let total  = 0
  let cnt    = 0

  for (let y = step; y < h - step; y += step) {
    for (let x = step; x < w - step; x += step) {
      const c = lum((y * w + x) * 4)
      const t = lum(((y - step) * w + x) * 4)
      const b = lum(((y + step) * w + x) * 4)
      total += Math.abs(2 * c - t - b)
      cnt++
    }
  }

  return cnt > 0 ? Math.min(100, (total / cnt) * 2) : 50
}

// Luminance range as dynamic range score (0–100)
export function computeDynamicRange(imageData) {
  const d = imageData.data
  let mn  = 255
  let mx  = 0

  for (let i = 0; i < d.length; i += 4) {
    const lum = d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722
    if (lum < mn) mn = lum
    if (lum > mx) mx = lum
  }

  return ((mx - mn) / 255) * 100
}

// Helper: load a File → scaled ImageData (reusable across Train + future contexts)
export async function fileToImageData(file, maxDim = 400) {
  const url = URL.createObjectURL(file)
  const img = new Image()
  await new Promise((res, rej) => {
    img.onload  = res
    img.onerror = rej
    img.src     = url
  })
  URL.revokeObjectURL(url)

  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
  const w     = Math.round(img.naturalWidth  * scale)
  const h     = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width  = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)
  return { imageData: ctx.getImageData(0, 0, w, h), canvas, ctx }
}
