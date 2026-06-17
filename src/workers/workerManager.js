// Singleton wrapper for the pixel processing worker.
// Exposes a Promise-based API; buffers are zero-copy transferred.

class WorkerManager {
  constructor() {
    this._worker  = null
    this._pending = new Map() // id → { resolve, reject }
  }

  _init() {
    if (this._worker) return
    this._worker = new Worker(
      new URL('./processor.worker.js', import.meta.url)
      // classic script — no imports needed inside the worker
    )
    this._worker.onmessage = (e) => {
      const { id, type, buffer, width, height, error } = e.data
      const p = this._pending.get(id)
      if (!p) return
      this._pending.delete(id)
      if (type === 'ERROR') {
        p.reject(new Error(error))
      } else {
        p.resolve({ buffer, width, height })
      }
    }
    this._worker.onerror = () => {
      for (const [, p] of this._pending) p.reject(new Error('Worker crashed'))
      this._pending.clear()
    }
  }

  _send(message, transfer = []) {
    this._init()
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject })
      this._worker.postMessage({ ...message, id }, transfer)
    })
  }

  async processPhoto(imageData, profile) {
    const cloned = new Uint8ClampedArray(imageData.data)
    const { buffer, width, height } = await this._send(
      {
        type: 'PROCESS_PHOTO',
        imageData: { data: cloned, width: imageData.width, height: imageData.height },
        profile,
      },
      [cloned.buffer]
    )
    return new ImageData(new Uint8ClampedArray(buffer), width, height)
  }

  async generateThumbnail(imageData, maxSize) {
    const cloned = new Uint8ClampedArray(imageData.data)
    const { buffer, width, height } = await this._send(
      {
        type: 'GENERATE_THUMB',
        imageData: { data: cloned, width: imageData.width, height: imageData.height },
        maxSize,
      },
      [cloned.buffer]
    )
    return new ImageData(new Uint8ClampedArray(buffer), width, height)
  }
}

export const workerManager = new WorkerManager()
