"use client";

import { Share } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";

/** Copie un lien dans le presse-papiers et l'annonce. */
export async function copyLink(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    toast("Lien copié", { duration: 4000 });
  } catch {
    toast("Quelque chose n'a pas marché. Réessayez.", { duration: 4000 });
  }
}

/** Partage natif (Web Share API) si disponible, sinon copie du lien. */
async function share(title: string, path: string) {
  const url = new URL(path, window.location.origin).toString();
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  await copyLink(url);
}

type ShareButtonProps = {
  title: string;
  path: string;
  /** `full` : bouton avec libellé (desktop) ; `round` : bouton rond (mobile). */
  variant: "full" | "round";
  tone: "dark" | "light";
};

export function ShareButton({ title, path, variant, tone }: ShareButtonProps) {
  const onClick = () => void share(title, path);
  if (variant === "round") {
    return (
      <IconButton
        variant={tone === "dark" ? "glass" : "outline"}
        aria-label="Partager la liste"
        onClick={onClick}
      >
        <Share aria-hidden="true" />
      </IconButton>
    );
  }
  return (
    <Button
      variant={tone === "dark" ? "glass" : "outline"}
      icon={<Share aria-hidden="true" />}
      onClick={onClick}
    >
      Partager
    </Button>
  );
}
