import Image from "next/image"

import { ResetScroll } from "@/components/reset-scroll"

interface PagePlateProps {
  title: string
  children: React.ReactNode
}

// The quiet pages take their presence from a photograph.
export function PagePlate({ title, children }: PagePlateProps) {
  return (
    <article className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-6 sm:py-12 lg:grid-cols-[3fr_2fr] lg:items-center lg:gap-12">
      <ResetScroll />
      <Image
        src="/posts/0001-sheep/preview-sheep-4018x2298.jpg"
        alt=""
        width={4018}
        height={2298}
        priority
        sizes="(min-width: 1024px) 60vw, 100vw"
        className="w-full bg-muted"
      />
      <div className="space-y-4">
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
          {title}
        </h1>
        <div className="max-w-prose font-serif text-lg leading-relaxed text-foreground/80 sm:text-xl">
          {children}
        </div>
      </div>
    </article>
  )
}
