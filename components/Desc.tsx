// Desc.tsx
import React from "react"

import { cn } from "@/lib/utils"

interface DescProps {
  description: string
  className?: string
}

type Section = {
  year?: string
  lines: string[]
}

const YEAR_LINE = /^\d{4}$/
export const SOURCE_LINE = /^[\w-]+(\.[\w-]+)+(\/\S*)?$/

export function toSections(description: string) {
  const sections: Section[] = []

  description
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      if (YEAR_LINE.test(line)) {
        sections.push({ year: line, lines: [] })
        return
      }

      if (sections.length === 0) {
        sections.push({ lines: [] })
      }

      sections[sections.length - 1].lines.push(line)
    })

  return sections
}

const Desc: React.FC<DescProps> = ({ description, className }) => {
  const sections = toSections(description)

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-12 gap-y-8",
        sections.length > 1 && "md:grid-cols-2",
        className
      )}
    >
      {sections.map((section, index) => (
        <section key={index} className="max-w-prose space-y-3">
          {section.year ? (
            <h2 className="font-serif text-2xl text-muted-foreground">
              {section.year}
            </h2>
          ) : null}
          {section.lines.map((line, lineIndex) =>
            SOURCE_LINE.test(line) ? (
              <a
                key={lineIndex}
                href={`https://${line}`}
                target="_blank"
                rel="noreferrer"
                className="block break-words text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
              >
                {line}
              </a>
            ) : (
              <p key={lineIndex} className="font-serif text-lg leading-relaxed sm:text-xl">
                {line}
              </p>
            )
          )}
        </section>
      ))}
    </div>
  )
}

export default Desc
