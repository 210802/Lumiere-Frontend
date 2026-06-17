// Pixel-level style analysis engine — learns edit recipe from before/after pairs

async function getImageData(file) {
  const url = URL.createObjectURL(file)
  const img = new Image()

  await new Promise((resolve, reject) => {
    img.onload  = () => resolve()
    img.onerror = () => reject(new Error(`Failed to load ${file.name}`))
    img.src = url
  })

  const scale = Math.min(1, 800 / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.round(img.naturalWidth  * scale)
  const h = Math.round(img.naturalHeight * scale)

  const canvas = document.createElement('canvas')
  canvas.width  = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb' })
  ctx.drawImage(img, 0, 0, w, h)

  URL.revokeObjectURL(url)
  return ctx.getImageData(0, 0, w, h)
}

function samplePixels(raw, edited, count) {
  const samples = []
  const step = Math.floor(raw.data.length / 4 / count)

  for (let i = 0; i < count; i++) {
    const idx = (i * step) * 4
    if (idx + 3 >= raw.data.length) break

    const rawX  = (idx / 4) % raw.width
    const rawY  = Math.floor((idx / 4) / raw.width)
    const editX = Math.round(rawX * (edited.width  / raw.width))
    const editY = Math.round(rawY * (edited.height / raw.height))
    const editIdx = (editY * edited.width + editX) * 4

    if (editIdx + 3 >= edited.data.length) continue

    samples.push({
      rawR:  raw.data[idx],
      rawG:  raw.data[idx + 1],
      rawB:  raw.data[idx + 2],
      editR: edited.data[editIdx],
      editG: edited.data[editIdx + 1],
      editB: edited.data[editIdx + 2],
    })
  }
  return samples
}

function computeAverageDeltas(samples) {
  let totalLumDelta = 0
  let totalR = 0, totalG = 0, totalB = 0
  let shadowCount = 0, shadowDelta = 0
  let highlightCount = 0, highlightDelta = 0
  let midtoneCount = 0, midtoneDelta = 0
  const warmthDeltas    = []
  const orangeSatDeltas = []
  const blueSatDeltas   = []

  for (const s of samples) {
    const rawLum  = s.rawR  * 0.2126 + s.rawG  * 0.7152 + s.rawB  * 0.0722
    const editLum = s.editR * 0.2126 + s.editG * 0.7152 + s.editB * 0.0722
    const lumDelta = editLum - rawLum

    totalLumDelta += lumDelta
    totalR += (s.editR - s.rawR)
    totalG += (s.editG - s.rawG)
    totalB += (s.editB - s.rawB)

    if      (rawLum < 80)  { shadowDelta    += lumDelta; shadowCount++    }
    else if (rawLum > 180) { highlightDelta += lumDelta; highlightCount++ }
    else                   { midtoneDelta   += lumDelta; midtoneCount++   }

    warmthDeltas.push((s.editR - s.editB) - (s.rawR - s.rawB))

    if (s.rawR > 150 && s.rawG > 80 && s.rawG < 180 && s.rawB < 100) {
      const rawOrangeSat  = (s.rawR  - s.rawB)  / (s.rawR  + 0.001)
      const editOrangeSat = (s.editR - s.editB) / (s.editR + 0.001)
      orangeSatDeltas.push(editOrangeSat - rawOrangeSat)
    }

    if (s.rawB > s.rawR + 30 && s.rawB > s.rawG + 10) {
      const rawBlueSat  = (s.rawB  - s.rawR)  / (s.rawB  + 0.001)
      const editBlueSat = (s.editB - s.editR) / (s.editB + 0.001)
      blueSatDeltas.push(editBlueSat - rawBlueSat)
    }
  }

  const n   = samples.length
  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

  return {
    avgLuminanceDelta: totalLumDelta / n,
    avgRedDelta:       totalR / n,
    avgGreenDelta:     totalG / n,
    avgBlueDelta:      totalB / n,
    shadowLiftDelta:   shadowCount    ? shadowDelta    / shadowCount    : 0,
    highlightDelta:    highlightCount ? highlightDelta / highlightCount : 0,
    midtoneDelta:      midtoneCount   ? midtoneDelta   / midtoneCount   : 0,
    warmthDelta:       avg(warmthDeltas),
    orangeSatDelta:    avg(orangeSatDeltas),
    blueSatDelta:      avg(blueSatDeltas),
  }
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}

function mapDeltasToParams(d) {
  const exposure    = d.avgLuminanceDelta / 8
  const shadows     = (d.shadowLiftDelta / 255) * 200
  const highlights  = (d.highlightDelta  / 255) * 200
  const blacks      = shadows < 0
    ? shadows * 0.5
    : -(Math.abs(d.shadowLiftDelta) / 255) * 100
  const whites      = (d.highlightDelta / 255) * 100
  const temperature = d.warmthDelta * 1000
  const tint        = d.avgGreenDelta - (d.avgRedDelta + d.avgBlueDelta) / 2
  const saturation  = (d.orangeSatDelta + Math.abs(d.blueSatDelta)) * 50
  const contrast    = (d.midtoneDelta / 255) * 100

  return {
    exposure:    clamp(exposure,    -3,    3),
    highlights:  clamp(highlights, -100, 100),
    shadows:     clamp(shadows,    -100, 100),
    whites:      clamp(whites,     -100, 100),
    blacks:      clamp(blacks,     -100, 100),
    temperature: clamp(temperature, -2000, 2000),
    tint:        clamp(tint,       -100, 100),
    saturation:  clamp(saturation, -100, 100),
    vibrance:    clamp(saturation * 0.7, -100, 100),
    contrast:    clamp(contrast,   -100, 100),
    clarity:     10,
    dehaze:      5,
    hsl: {
      red:    { hue: 0,  sat: clamp(d.orangeSatDelta * 30, -100, 100),  lum: 0 },
      orange: {
        hue: -8,
        sat: clamp(d.orangeSatDelta * 60, -100, 100),
        lum: clamp(d.orangeSatDelta * 40, -100, 100),
      },
      yellow: { hue: 0, sat: 0,                                          lum: 0 },
      green:  { hue: 0, sat: 0,                                          lum: 0 },
      blue:   { hue: 0, sat: clamp(d.blueSatDelta * 60, -100, 100),      lum: 0 },
      purple: { hue: 0, sat: 0,                                          lum: 0 },
    },
  }
}

// Analyse a single before/after pair — returns delta as partial StyleProfile
export async function analysePair(rawFile, editedFile) {
  const [rawData, editedData] = await Promise.all([
    getImageData(rawFile),
    getImageData(editedFile),
  ])

  const samples  = samplePixels(rawData, editedData, 1000)
  const avgDelta = computeAverageDeltas(samples)
  return mapDeltasToParams(avgDelta)
}

function averageHSL(vals) {
  const valid = vals.filter(Boolean)
  if (!valid.length) return { hue: 0, sat: 0, lum: 0 }
  return {
    hue: valid.reduce((a, b) => a + (b?.hue ?? 0), 0) / valid.length,
    sat: valid.reduce((a, b) => a + (b?.sat ?? 0), 0) / valid.length,
    lum: valid.reduce((a, b) => a + (b?.lum ?? 0), 0) / valid.length,
  }
}

// Average multiple pair analyses into one profile
export function averageProfiles(partials) {
  if (!partials.length) return {}

  const keys = [
    'exposure', 'highlights', 'shadows', 'whites', 'blacks',
    'temperature', 'tint', 'saturation', 'vibrance',
    'contrast', 'clarity', 'dehaze',
  ]

  const result = {}
  for (const key of keys) {
    const values = partials.map(p => p[key]).filter(v => v !== undefined)
    if (values.length) result[key] = values.reduce((a, b) => a + b, 0) / values.length
  }

  result.hsl = {
    red:    averageHSL(partials.map(p => p.hsl?.red)),
    orange: averageHSL(partials.map(p => p.hsl?.orange)),
    yellow: averageHSL(partials.map(p => p.hsl?.yellow)),
    green:  averageHSL(partials.map(p => p.hsl?.green)),
    blue:   averageHSL(partials.map(p => p.hsl?.blue)),
    purple: averageHSL(partials.map(p => p.hsl?.purple)),
  }

  return result
}
