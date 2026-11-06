import {
  JetBrains_Mono as FontMono,
  Inter as FontSans,
  Instrument_Sans as FontHomeSans,
  Instrument_Serif as FontHomeSerif,
  Newsreader as FontSerif,
} from "next/font/google"

export const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
})

export const fontSerif = FontSerif({
  subsets: ["latin"],
  variable: "--font-serif",
  axes: ["opsz"],
})

export const fontMono = FontMono({
  subsets: ["latin"],
  variable: "--font-mono",
})

// The homepage's own voice. Same variable names, so its subtree just reads differently.
export const fontHomeSerif = FontHomeSerif({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: "400",
})

export const fontHomeSans = FontHomeSans({
  subsets: ["latin"],
  variable: "--font-sans",
})
