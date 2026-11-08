import type { Gray } from "@/lib/rephoto/align"

// Browser helpers: read pixels out of images for the aligner, and draw the archive photograph's
// edges as a see-through guide. Nothing here touches the photograph that gets saved.

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = "async"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load ${src}`))
    image.src = src
  })
}

export function toGray(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, width: number): Gray {
  const height = Math.max(1, Math.round((sourceHeight / sourceWidth) * width))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) {
    throw new Error("No 2D canvas")
  }
  context.imageSmoothingQuality = "high"
  context.drawImage(source, 0, 0, width, height)
  const { data } = context.getImageData(0, 0, width, height)
  const gray = new Float32Array(width * height)
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
    gray[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]
  }

  return { data: gray, width, height }
}

// White lines where the archive photograph has its strongest edges, transparent elsewhere.
export function edgeOverlay(image: HTMLImageElement, width = 900) {
  const gray = toGray(image, image.naturalWidth, image.naturalHeight, width)
  const { height } = gray
  const smooth = new Float32Array(gray.data.length)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += gray.data[(y + dy) * width + x + dx]
      smooth[y * width + x] = sum / 9
    }
  }
  const magnitude = new Float32Array(gray.data.length)
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const at = y * width + x
      const gx = smooth[at + 1] - smooth[at - 1]
      const gy = smooth[at + width] - smooth[at - width]
      magnitude[at] = Math.hypot(gx, gy)
    }
  }
  // The strongest few percent of edges: enough to line up by, not enough to hide the view.
  const sorted = Float32Array.from(magnitude).sort()
  const low = sorted[Math.floor(sorted.length * 0.88)] || 1
  const high = sorted[Math.floor(sorted.length * 0.97)] || low + 1

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("No 2D canvas")
  }
  const output = context.createImageData(width, height)
  for (let i = 0, j = 0; i < magnitude.length; i++, j += 4) {
    const alpha = Math.max(0, Math.min(1, (magnitude[i] - low) / (high - low)))
    output.data[j] = 255
    output.data[j + 1] = 255
    output.data[j + 2] = 255
    output.data[j + 3] = Math.round(alpha * 255)
  }
  context.putImageData(output, 0, 0)

  return canvas.toDataURL("image/png")
}

export function dataUrlToFile(dataUrl: string, name: string) {
  const [head, body] = dataUrl.split(",")
  const type = /data:([^;]+)/.exec(head)?.[1] ?? "image/jpeg"
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], name, { type })
}
