import type { MetadataRoute } from "next";

// Manifeste : installation sur l'écran d'accueil et cible de partage (Android).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Envies",
    short_name: "Envies",
    description: "Listes d'envies, à partager avec les proches. Sans compte.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F3EDE2",
    theme_color: "#2A3014",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/partage",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
