"use client"

import { useState } from "react"
import Link from "next/link"

import { RephotoCamera } from "./rephoto-camera"

export function DecisionExperiment(props: {
  name: string
  slug: string
  thenSrc: string
  aspect: number
  available: boolean
}) {
  const [started, setStarted] = useState(false)
  if (started) return <RephotoCamera {...props} decisions />
  return (
    <main className="mx-auto flex min-h-[70svh] max-w-sm flex-col justify-center gap-5 px-6">
      <h1 className="text-3xl">Try the animated guide</h1>
      <p className="text-muted-foreground">
        Small camera images go to OpenAI for suggestions. Your photo is only
        taken when you press the shutter.
      </p>
      {props.available ? (
        <button
          className="rounded-md bg-foreground px-5 py-3 text-background"
          onClick={() => setStarted(true)}
        >
          Start experiment
        </button>
      ) : (
        <p role="status">This experiment is not available yet.</p>
      )}
      <Link
        className="underline underline-offset-4"
        href={`/${props.slug}/camera`}
      >
        Use the usual camera
      </Link>
    </main>
  )
}
