import { Metadata } from "next"

import { fetchPosts } from "@/lib/api"
import { sourceHref, splitSources } from "@/lib/sources"
import { PlaceRow } from "@/components/place-row"

export const metadata: Metadata = {
  title: "Sources",
}

export default async function LinksPage() {
  const posts = await fetchPosts()
  const sources = posts
    .filter((post) => !post.isSample)
    .flatMap((post) =>
      splitSources(post.description)
        .filter(({ isSource }) => isSource)
        .map(({ text }) => ({ source: text, post }))
    )

  return (
    <>
      <h1 className="font-serif text-4xl tracking-tight">Sources</h1>
      <p className="mt-4 max-w-prose leading-relaxed text-foreground/80">
        The sources cited in these stories.
      </p>
      <ul className="mt-8 space-y-6">
        {sources.map(({ source, post }) => (
          <li
            key={source}
            data-testid="source"
            className="border-t border-border/70 pt-4 [overflow-wrap:anywhere]"
          >
            <a
              href={sourceHref(source)}
              className="font-medium underline underline-offset-4"
            >
              {source}
            </a>
            <div className="-mx-2 mt-2">
              <PlaceRow place={post} />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
