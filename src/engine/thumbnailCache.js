// Thumbnail cache — generates 150px (or custom) JPEG thumbnails on first access,
// then serves from an in-memory object-URL cache.
// Prevents loading full-resolution images for filmstrip and gallery cards.

const cache = new Map() // `${photoId}_${maxSize}` → object URL

export async function getThumbnail(photo, maxSize = 150) {
  const key = `${photo.id}_${maxSize}`
  if (cache.has(key)) return cache.get(key)

  // If the backend already gave us a small thumbnail, reuse it without regenerating
  if (photo.thumb_url) {
    cache.set(key, photo.thumb_url)
    return photo.thumb_url
  }

  // Otherwise generate from the File blob or the existing object URL
  const src = photo.file ? URL.createObjectURL(photo.file) : (photo.previewUrl ?? null)
  if (!src) return null

  const img = new Image()
  await new Promise((res, rej) => {
    img.onload  = res
    img.onerror = rej
    img.src     = src
  })
  // Revoke only the temporary URL we created — never the previewUrl (it's managed elsewhere)
  if (photo.file) URL.revokeObjectURL(src)

  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight))
  const tw = Math.round(img.naturalWidth  * scale)
  const th = Math.round(img.naturalHeight * scale)

  const canvas = document.createElement('canvas')
  canvas.width  = tw
  canvas.height = th
  canvas.getContext('2d').drawImage(img, 0, 0, tw, th)

  const blob = await new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', 0.75))
  const url  = URL.createObjectURL(blob)
  cache.set(key, url)
  return url
}

// Call when a photo is removed from the session
export function revokeThumbCache(photoId) {
  for (const [key, url] of cache.entries()) {
    if (key.startsWith(`${photoId}_`)) {
      URL.revokeObjectURL(url)
      cache.delete(key)
    }
  }
}

// Call on unmount / session end
export function clearThumbCache() {
  for (const url of cache.values()) URL.revokeObjectURL(url)
  cache.clear()
}
