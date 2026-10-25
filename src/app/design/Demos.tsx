"use client";

import { Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { KeyChip } from "@/components/ui/Kbd";
import { Toggle } from "@/components/ui/Toggle";
import { tagColorVar } from "@/lib/tagColors";

/** Puces de filtre interactives (catégorie unique, tags multiples). */
export function ChipsDemo() {
  const [category, setCategory] = useState<"all" | "maison">("maison");
  const [tags, setTags] = useState<Set<string>>(new Set(["priorite"]));

  const toggleTag = (key: string) =>
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const tagList = [
    { key: "priorite", name: "Priorité", color: tagColorVar.rouille },
    { key: "petit-prix", name: "Petit prix", color: tagColorVar.miel },
    { key: "seconde-main", name: "Seconde main OK", color: tagColorVar.olive },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      <Chip pressed={category === "all"} count={24} onClick={() => setCategory("all")}>
        Tout
      </Chip>
      <Chip pressed={category === "maison"} count={8} onClick={() => setCategory("maison")}>
        Maison &amp; déco
      </Chip>
      {tagList.map((tag) => (
        <Chip
          key={tag.key}
          pressed={tags.has(tag.key)}
          tone={tag.color}
          dot={tag.color}
          onClick={() => toggleTag(tag.key)}
        >
          {tag.name}
        </Chip>
      ))}
    </div>
  );
}

export function KeyChipsDemo() {
  const [category, setCategory] = useState(true);
  const [tag, setTag] = useState(false);
  return (
    <>
      <KeyChip keyLabel="1" pressed={category} onClick={() => setCategory((v) => !v)}>
        Maison &amp; déco
      </KeyChip>
      <KeyChip keyLabel="Z" pressed={tag} dot={tagColorVar.miel} onClick={() => setTag((v) => !v)}>
        Petit prix
      </KeyChip>
    </>
  );
}

export function TogglesDemo() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <Toggle label="Seulement les coups de cœur" tone="rust" defaultChecked />
      <Toggle label="Ranger directement" />
    </div>
  );
}

export function ToastDemo() {
  return (
    <Button
      variant="outline"
      size={44}
      icon={<Undo2 aria-hidden="true" />}
      onClick={() =>
        toast("Article supprimé", {
          action: { label: "Annuler", onClick: () => toast("Enregistré", { duration: 2000 }) },
        })
      }
    >
      Afficher le message
    </Button>
  );
}
