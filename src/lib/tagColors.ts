import type { Enums } from "@/types/database";

export type TagColor = Enums<"tag_color">;

/** Enum `tag_color` → valeur CSS du token correspondant. */
export const tagColorVar: Record<TagColor, string> = {
  rouille: "var(--color-rust)",
  ocre: "var(--color-ochre)",
  miel: "var(--color-honey-deep)",
  olive: "var(--color-olive)",
  sauge: "var(--color-sage)",
  ardoise: "var(--color-slate)",
  prune: "var(--color-plum)",
  sable: "var(--color-sand)",
};
