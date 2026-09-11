/**
 * Downscale an image file to a PNG data URL, capped at `maxSize` on the long
 * edge. Used to embed the logo directly into PDFs (deterministic, no network).
 * SVGs are rasterised the same way.
 */
export async function toScaledPngDataUrl(file: File, maxSize = 600): Promise<string> {
  const dataUrl = await readAsDataUrl(file)
  const img = await loadImage(dataUrl)
  // Some browsers report 0 for naturalWidth/Height on an SVG with no explicit
  // width/height/viewBox-derived size — fall back to maxSize rather than
  // producing a 0×0 (unusable) canvas.
  const srcW = img.naturalWidth || img.width || maxSize
  const srcH = img.naturalHeight || img.height || maxSize
  const scale = Math.min(1, maxSize / Math.max(srcW, srcH))
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/png')
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'))
    img.src = src
  })
}
