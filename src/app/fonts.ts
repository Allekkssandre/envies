import { Dancing_Script, Fraunces, Instrument_Sans } from "next/font/google";

export const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

export const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

/** Écriture manuscrite, réservée à la lettre du Pôle Nord de La Magie de Noël. */
export const script = Dancing_Script({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-script",
  display: "swap",
});
