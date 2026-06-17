// Pixel processing worker — all canvas pixel ops run here, off the UI thread

self.onmessage = (e) => {
  const { type, id, imageData, profile, maxSize } = e.data
  try {
    if (type === 'PROCESS_PHOTO') {
      const result = processImageData(imageData, profile)
      self.postMessage(
        { type: 'DONE', id, buffer: result.data.buffer, width: result.width, height: result.height },
        [result.data.buffer]
      )
    } else if (type === 'GENERATE_THUMB') {
      const result = generateThumbnail(imageData, maxSize)
      self.postMessage(
        { type: 'DONE', id, buffer: result.data.buffer, width: result.width, height: result.height },
        [result.data.buffer]
      )
    }
  } catch (err) {
    self.postMessage({ type: 'ERROR', id, error: String(err) })
  }
}

function processImageData(imageData, profile) {
  const src  = imageData.data
  const data = new Uint8ClampedArray(src)
  const w    = imageData.width
  const h    = imageData.height

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
    let r = data[i], g = data[i + 1], b = data[i + 2]
    const lum = r * 0.2126 + g * 0.7152 + b * 0.0722

    r = Math.min(255, r * exposureMult)
    g = Math.min(255, g * exposureMult)
    b = Math.min(255, b * exposureMult)

    if (lum < 80) {
      const sw = 1 - lum / 80
      r = Math.min(255, r + shadowBoost * sw)
      g = Math.min(255, g + shadowBoost * sw)
      b = Math.min(255, b + shadowBoost * sw)
    }
    if (lum < 40) {
      const bw = 1 - lum / 40
      r = Math.max(0, r + blackPull * bw)
      g = Math.max(0, g + blackPull * bw)
      b = Math.max(0, b + blackPull * bw)
    }
    if (lum > 180) {
      const hw = (lum - 180) / 75
      r = Math.max(0, r + highlightPull * hw)
      g = Math.max(0, g + highlightPull * hw)
      b = Math.max(0, b + highlightPull * hw)
    }
    if (lum > 220) {
      r = Math.min(255, r + whiteBoost)
      g = Math.min(255, g + whiteBoost)
      b = Math.min(255, b + whiteBoost)
    }

    if (contrast !== 0) {
      r = Math.min(255, Math.max(0, contrastFact * (r - 128) + 128))
      g = Math.min(255, Math.max(0, contrastFact * (g - 128) + 128))
      b = Math.min(255, Math.max(0, contrastFact * (b - 128) + 128))
    }

    r = Math.min(255, r + warmR)
    b = Math.min(255, b + warmB)

    if (saturation !== 0) {
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b
      const f    = 1 + saturation / 100
      r = Math.min(255, Math.max(0, gray + (r - gray) * f))
      g = Math.min(255, Math.max(0, gray + (g - gray) * f))
      b = Math.min(255, Math.max(0, gray + (b - gray) * f))
    }

    if (r > 140 && g > 70 && g < 190 && b < 110 && r > g && r > b) {
      const ow = Math.min(1, (r - b) / 150)
      if (orangeSat !== 0) {
        const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b
        const of_  = 1 + orangeSat / 100
        r = Math.min(255, Math.max(0, gray + (r - gray) * of_))
        g = Math.min(255, Math.max(0, gray + (g - gray) * of_))
        b = Math.min(255, Math.max(0, gray + (b - gray) * of_))
      }
      if (orangeLum !== 0) {
        const lb = (orangeLum / 100) * 20 * ow
        r = Math.min(255, r + lb)
        g = Math.min(255, g + lb * 0.8)
        b = Math.min(255, b + lb * 0.3)
      }
    }

    if (b > r + 20 && b > g + 10 && blueSat !== 0) {
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b
      const bf   = 1 + blueSat / 100
      r = Math.min(255, Math.max(0, gray + (r - gray) * bf))
      g = Math.min(255, Math.max(0, gray + (g - gray) * bf))
      b = Math.min(255, Math.max(0, gray + (b - gray) * bf))
    }

    data[i] = Math.round(r); data[i + 1] = Math.round(g); data[i + 2] = Math.round(b)
  }

  return new ImageData(data, w, h)
}

// Nearest-neighbour downscale — fast, runs in worker
function generateThumbnail(imageData, maxSize) {
  const scale = Math.min(1, maxSize / Math.max(imageData.width, imageData.height))
  const tw  = Math.round(imageData.width  * scale)
  const th  = Math.round(imageData.height * scale)
  const src = imageData.data
  const dst = new Uint8ClampedArray(tw * th * 4)

  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const sx = Math.round(x / scale)
      const sy = Math.round(y / scale)
      const si = (sy * imageData.width + sx) * 4
      const di = (y * tw + x) * 4
      dst[di]     = src[si]
      dst[di + 1] = src[si + 1]
      dst[di + 2] = src[si + 2]
      dst[di + 3] = src[si + 3]
    }
  }
  return new ImageData(dst, tw, th)
}
