import type { Metadata } from "next";
import type { ReactNode } from "react";

// Le Secret Santa a son propre nom : on n'y écrit pas « Envies », le nom des listes d'envies.
export const metadata: Metadata = {
  title: { default: "Secret Santa", template: "%s · Secret Santa" },
  applicationName: "Secret Santa",
  appleWebApp: { title: "Secret Santa" },
  openGraph: { siteName: "Secret Santa" },
};

export default function LutinsLayout({ children }: { children: ReactNode }) {
  return children;
}
