import { fetchPosts } from "@/lib/api"
import { OSMExperimentMap } from "@/components/osm-experiment-map"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export default async function OSMExperimentsPage() {
  const posts = await fetchPosts()

  return (
    <>
      <SiteHeader />
      <main className="pb-16 pt-24 sm:pt-28">
        <section className="container space-y-8 px-4 sm:px-6">
          <div className="space-y-5 pt-2">
            <h1 className="max-w-4xl text-4xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              OSM Noise Experiments
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
              These options keep the standard OpenStreetMap raster tiles and
              only soften the rendered image. They can reduce color noise, but
              they cannot truly remove POIs, icons, or labels the way a custom
              vector style can.
            </p>
          </div>

          <div className="grid gap-10">
            <OSMExperimentMap
              posts={posts}
              title="Default OSM"
              variant="default"
            />
            <OSMExperimentMap
              posts={posts}
              title="Muted OSM"
              variant="muted"
            />
            <OSMExperimentMap
              posts={posts}
              title="Paper OSM"
              variant="paper"
            />
            <OSMExperimentMap
              posts={posts}
              title="Monochrome OSM"
              variant="mono"
            />
          </div>
        </section>
      </main>
      <SiteFooter className="pb-8" />
    </>
  )
}
