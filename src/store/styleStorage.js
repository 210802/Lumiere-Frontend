// Style library storage — localStorage for profile metadata, IndexedDB for thumbnails.
// Separate from profileStore.js (which serves the Edit page's flat-format profiles).

const STYLES_KEY = 'lumiere_styles_v2'
const THUMBS_DB  = 'lumiere_thumbs'

// ── localStorage ─────────────────────────────────────────────────────

export function saveStyle(style) {
  const all = loadAllStyles()
  const idx = all.findIndex(s => s.id === style.id)
  if (idx >= 0) all[idx] = style; else all.unshift(style)
  localStorage.setItem(STYLES_KEY, JSON.stringify(all))
}

export function loadAllStyles() {
  try {
    return JSON.parse(localStorage.getItem(STYLES_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function deleteStyle(id) {
  const filtered = loadAllStyles().filter(s => s.id !== id)
  localStorage.setItem(STYLES_KEY, JSON.stringify(filtered))
  deleteThumb(id).catch(() => {})
}

export function duplicateStyle(id) {
  const orig = loadAllStyles().find(s => s.id === id)
  if (!orig) return null
  const copy = {
    ...orig,
    id: crypto.randomUUID(),
    name: `${orig.name} (Copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    versions: [],
    currentVersion: 1,
    usageCount: 0,
  }
  saveStyle(copy)
  return copy
}

export function updateStyleName(id, name) {
  const all = loadAllStyles()
  const s = all.find(s => s.id === id)
  if (s) { s.name = name; s.updatedAt = Date.now() }
  localStorage.setItem(STYLES_KEY, JSON.stringify(all))
}

export function toggleFavorite(id) {
  const all = loadAllStyles()
  const s = all.find(s => s.id === id)
  if (s) s.isFavorite = !s.isFavorite
  localStorage.setItem(STYLES_KEY, JSON.stringify(all))
}

export function recordUsage(id) {
  const all = loadAllStyles()
  const s = all.find(s => s.id === id)
  if (s) { s.lastUsedAt = Date.now(); s.usageCount = (s.usageCount ?? 0) + 1 }
  localStorage.setItem(STYLES_KEY, JSON.stringify(all))
}

export function exportStyleAsJSON(style) {
  const blob = new Blob([JSON.stringify(style, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `lumiere_style_${style.name.replace(/\s+/g, '_')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importStyleFromFile(file) {
  const style     = JSON.parse(await file.text())
  style.id        = crypto.randomUUID()
  style.name      = `${style.name} (Imported)`
  style.createdAt = Date.now()
  style.updatedAt = Date.now()
  saveStyle(style)
  return style
}

// Versioning — call before re-training to preserve old params
export function addVersion(existing, newParams) {
  return {
    ...existing,
    params: newParams,
    currentVersion: (existing.currentVersion ?? 1) + 1,
    updatedAt: Date.now(),
    versions: [
      ...(existing.versions ?? []),
      {
        version:   existing.currentVersion ?? 1,
        createdAt: Date.now(),
        pairCount: existing.pairCount,
        params:    existing.params,
        label:     `v${existing.currentVersion ?? 1}`,
      },
    ],
  }
}

// ── IndexedDB — thumbnails stored as data URLs ──────────────────────

function getThumbsDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(THUMBS_DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore('thumbnails')
    req.onsuccess       = () => resolve(req.result)
    req.onerror         = () => reject(req.error)
  })
}

export async function saveThumb(id, dataUrl) {
  const db = await getThumbsDB()
  return new Promise((resolve) => {
    const tx = db.transaction('thumbnails', 'readwrite')
    tx.objectStore('thumbnails').put(dataUrl, id)
    tx.oncomplete = resolve
  })
}

export async function loadThumb(id) {
  const db = await getThumbsDB()
  return new Promise((resolve) => {
    const req = db.transaction('thumbnails', 'readonly')
      .objectStore('thumbnails')
      .get(id)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror   = () => resolve(null)
  })
}

async function deleteThumb(id) {
  const db = await getThumbsDB()
  return new Promise((resolve) => {
    db.transaction('thumbnails', 'readwrite').objectStore('thumbnails').delete(id)
    resolve()
  })
}
