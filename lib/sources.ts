// Source addresses are written bare in the story captions.
const SOURCE_PATTERN =
  /(\b[\w-]+(?:\.[\w-]+)*\.(?:nz|com|org|net)\b(?:\/\S*)?)/

export function splitSources(description: string) {
  return description.split(SOURCE_PATTERN).map((text, index) => ({
    text,
    isSource: index % 2 === 1,
  }))
}

export function sourceHref(source: string) {
  return `https://${source}`
}
