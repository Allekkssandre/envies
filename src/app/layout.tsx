import type { Metadata, Viewport } from "next";
import { Grain } from "@/components/ui/Grain";
import { Toaster } from "@/components/ui/Toaster";
import { fraunces, instrument } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Envies", template: "%s · Envies" },
  description: "Listes d'envies, à partager avec les proches. Sans compte.",
};

export const viewport: Viewport = {
  themeColor: "#2A3014",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${instrument.variable}`}>
      <body>
        {/* Cible du rétrécissement d'arrière-plan des feuilles mobiles (vaul). */}
        <div data-vaul-drawer-wrapper="" className="min-h-dvh bg-cream">
          {children}
        </div>
        <Toaster />
        <Grain />
      </body>
    </html>
  );
}
