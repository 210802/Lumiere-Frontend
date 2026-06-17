// Client-side canvas processing — applies a StyleProfile to photos at full resolution.
// Up to 3 photos are processed simultaneously; pixel ops run in a dedicated worker
// so the UI thread stays responsive during batch processing.

import { workerManager } from '../workers/workerManager'

const CONCURRENCY = 3

/**
 * Process all photos with the given profile.
 * onProgress(done, total, currentName) is called before and after each photo.
 * Returns Array<{ photo, blob }> in input order, skipping any that failed.
 */
export async function processAllPhotos(photos, profile, onProgress) {
  const results = new Array(photos.length) // pre-allocated to preserve order
  let index = 0
  let done  = 0

  async function processNext() {
    while (index < photos.length) {
      const i     = index++
      const photo = photos[i]
      onProgress(done, photos.length, photo.filename || photo.name || '')

      try {
        const blob = await processOnePhoto(photo, profile)
        results[i] = { photo, blob }
      } catch (err) {
        console.error(`Failed to process ${photo.filename || photo.name}:`, err)
      }

      done++
      onProgress(done, photos.length, photo.filename || photo.name || '')
    }
  }

  // Run up to CONCURRENCY processNext coroutines simultaneously.
  // Canvas loads overlap; worker serialises pixel ops (it's single-threaded).
  await Promise.all(Array.from({ length: CONCURRENCY }, processNext))

  return results.filter(Boolean)
}

async function processOnePhoto(photo, profile) {
  const file = photo.file
  if (!file) throw new Error(`No file object for ${photo.filename || photo.name}`)

  const url = URL.createObjectURL(file)
  const img = new Image()
  await new Promise((resolve, reject) => {
    img.onload  = resolve
    img.onerror = () => reject(new Error(`Image load failed: ${photo.filename || photo.name}`))
    img.src     = url
  })
  URL.revokeObjectURL(url)

  const canvas  = document.createElement('canvas')
  canvas.width  = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d', { alpha: false, colorSpace: 'srgb' })
  ctx.drawImage(img, 0, 0)

  // Send pixel data to worker — zero-copy transfer, UI thread stays free
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const processed = await workerManager.processPhoto(imageData, profile)
  ctx.putImageData(processed, 0, 0)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Export failed')),
      'image/jpeg',
      0.97
    )
  })
}
