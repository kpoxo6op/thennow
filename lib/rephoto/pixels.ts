import type { Gray } from "@/lib/rephoto/line-check"

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = "async"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load ${src}`))
    image.src = src
  })
}

// Grey pixels of a picture at a given size, made off to the side.
export async function grayOf(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  width: number,
  height: number
): Promise<Gray | null> {
  width = Math.round(width)
  height = Math.round(height)
  if (width < 16 || height < 16) return null
  const bitmap = await createImageBitmap(source, {
    resizeWidth: width,
    resizeHeight: height,
    resizeQuality: "medium",
  })
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) {
    bitmap.close()
    return null
  }
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  const { data } = context.getImageData(0, 0, width, height)
  canvas.width = 0
  canvas.height = 0
  const gray = new Float32Array(width * height)
  for (let i = 0, j = 0; i < gray.length; i++, j += 4)
    gray[i] =
      (0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]) / 255
  return { width, height, data: gray }
}
