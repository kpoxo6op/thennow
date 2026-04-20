export type BasemapConfig = {
  attribution: string
  id: string
  label: string
  tileUrl: string
}

const stadiaApiKey = process.env.NEXT_PUBLIC_STADIA_API_KEY?.trim()

export const stadiaAlidadeSmooth: BasemapConfig = {
  attribution:
    '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  id: "stadia",
  label: "Stadia Alidade Smooth",
  tileUrl: "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png",
}

export const openStreetMapStandard: BasemapConfig = {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  id: "osm",
  label: "OpenStreetMap Standard",
  tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
}

function isLocalHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local")
  )
}

export function getRuntimeBasemapConfig(hostname: string): BasemapConfig {
  if (stadiaApiKey) {
    return {
      ...stadiaAlidadeSmooth,
      tileUrl: `${stadiaAlidadeSmooth.tileUrl}?api_key=${stadiaApiKey}`,
    }
  }

  if (isLocalHost(hostname)) {
    return stadiaAlidadeSmooth
  }

  return openStreetMapStandard
}
