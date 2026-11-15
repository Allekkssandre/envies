import type { Metadata } from "next";
import { CreateSanta } from "@/components/santa/CreateSanta";
import { SantaShell } from "@/components/santa/SantaShell";
import { SplitTitle } from "@/components/ui/SplitTitle";

export const metadata: Metadata = {
  title: "Secret Santa",
  description: "Un tirage au sort pour offrir un cadeau, avec un thème pour chacun.",
};

const STEPS = [
  "Vous entrez les thèmes et les participants, avec leur adresse mail.",
  "Vous lancez le tirage. Chacun reçoit un lien personnel par mail.",
  "Chacun découvre à qui il offre un cadeau, et son thème. Personne d'autre ne le sait, vous non plus.",
  "Chacun peut remplir une fiche et une liste d'idées, que seul son Santa verra.",
];

export default function SantaHomePage() {
  return (
    <SantaShell>
      <div className="relative flex flex-col gap-3">
        <SplitTitle
          as="h1"
          title="Secret Santa"
          restColor="text-ochre"
          className="text-[44px] sm:text-[60px]"
        />
        <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
          {STEPS.map((step, i) => (
            <li key={step} className="flex gap-3 text-[15px] leading-normal text-ink-soft">
              <span className="font-display-72 text-lg leading-none text-ochre">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
      <CreateSanta />
    </SantaShell>
  );
}
