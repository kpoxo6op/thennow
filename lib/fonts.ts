import {
  Instrument_Sans as FontSans,
  Instrument_Serif as FontSerif,
  Newsreader as FontReading,
} from "next/font/google"

export const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
})

export const fontSerif = FontSerif({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: "400",
})

// Long passages: a text face, where the display serif would pinch.
export const fontReading = FontReading({
  subsets: ["latin"],
  variable: "--font-reading",
  axes: ["opsz"],
})
