import { fetchPosts } from "@/lib/api"

const SITE_URL = "https://thennow.nz"

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function getSummary(description: string) {
  return description.split("\n").filter(Boolean).slice(0, 2).join(" ")
}

export async function GET() {
  const posts = await fetchPosts()
  const items = posts
    .map((post) => {
      const url = `${SITE_URL}/${post.slug}`
      const description = getSummary(post.description)

      return `
        <item>
          <title>${escapeXml(post.name)}</title>
          <link>${url}</link>
          <guid>${url}</guid>
          <description>${escapeXml(description)}</description>
        </item>
      `.trim()
    })
    .join("\n")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>then|now feed</title>
    <link>${SITE_URL}</link>
    <description>New Zealand photographs paired across time.</description>
    ${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  })
}
