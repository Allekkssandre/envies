"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PLAYERS, ROUNDS } from "@/lib/magic/engine";
import { CAMP_LABEL, formatMoment } from "@/lib/magic/texts";
import type { MagicSummary } from "@/lib/magic/types";
import type { Result } from "@/server/actions/result";
import { createMagicGame, deleteMagicGame, revealMagicGame } from "@/server/actions/magic";
import { SantaSection } from "./SantaShell";

const NETWORK = "Pas enregistré. Vérifiez la connexion.";

/** La Magie de Noël côté organisation : ouvrir le jeu, suivre la jauge, révéler. Aucun rôle visible. */
export function MagicOrganizer({
  santaId,
  magic,
  players,
}: {
  santaId: string;
  magic: MagicSummary | null;
  players: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [startsAt, setStartsAt] = useState("");
  const [roundDays, setRoundDays] = useState("7");
  const [startGauge, setStartGauge] = useState("4");
  const [stopping, setStopping] = useState(false);

  const act = (run: () => Promise<Result<null>>, done: string) =>
    startTransition(async () => {
      try {
        const result = await run();
        toast(result.ok ? done : result.error.message, { duration: 5000 });
        if (result.ok) router.refresh();
      } catch {
        toast(NETWORK, { duration: 5000 });
      }
    });

  if (!magic) {
    return (
      <SantaSection
        title="La Magie de Noël"
        hint={`Un jeu à rôles cachés en ${ROUNDS} manches, en parallèle des cadeaux. Il se joue à ${PLAYERS}.`}
      >
        {players === PLAYERS ? (
          <form
            className="grid gap-4 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!startsAt) return;
              act(
                () =>
                  createMagicGame(santaId, {
                    startsAt: new Date(startsAt).toISOString(),
                    roundDays: Number(roundDays),
                    startGauge: Number(startGauge),
                  }),
                "Jeu ouvert. Chacun le trouve sur sa page.",
              );
            }}
          >
            <Field
              label="Début de la partie"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              hint="Chacun choisit son camp avant cette date."
            />
            <Field
              label="Durée d'une manche (jours)"
              type="number"
              min={1}
              max={14}
              value={roundDays}
              onChange={(e) => setRoundDays(e.target.value)}
              hint={`${ROUNDS} manches : ${ROUNDS * Number(roundDays || 0)} jours en tout.`}
            />
            <Field
              label="Magie au départ"
              type="number"
              min={3}
              max={5}
              value={startGauge}
              onChange={(e) => setStartGauge(e.target.value)}
              hint="4 : partie équilibrée. 3 aide les Grinchs, 5 les Pères Noël."
            />
            <div>
              <Button
                type="submit"
                size={46}
                disabled={pending || !startsAt}
                icon={<Sparkles aria-hidden="true" />}
              >
                Ouvrir le jeu
              </Button>
            </div>
          </form>
        ) : (
          <p className="m-0 text-[15px] text-ink-soft">
            Ce Secret Santa compte {players} participants : le jeu n&apos;est pas disponible.
          </p>
        )}
      </SantaSection>
    );
  }

  const end = new Date(
    new Date(magic.startsAt).getTime() + ROUNDS * magic.roundDays * 86_400_000,
  ).toISOString();
  const over = `Partie terminée. ${magic.winner ? `Victoire pour ${CAMP_LABEL[magic.winner]}.` : ""} ${
    magic.status === "revealed" ? "Rôles et classement révélés." : "Rôles et classement à révéler."
  }`;
  return (
    <SantaSection
      title="La Magie de Noël"
      hint="Vous ne voyez ici aucun rôle. Jouez depuis votre lien personnel."
    >
      <p className="m-0 text-[15px] leading-normal">
        {magic.status === "joining"
          ? `Choix des camps jusqu'au ${formatMoment(magic.startsAt)}. Dernier vote le ${formatMoment(end)}.`
          : magic.status === "playing"
            ? `Manche ${magic.round + 1} sur ${ROUNDS}. Magie de Noël : ${magic.gauge}. Dernier vote le ${formatMoment(end)}.`
            : over}
      </p>
      <div className="flex flex-wrap gap-2.5">
        {magic.status === "over" ? (
          <Button
            size={46}
            disabled={pending}
            onClick={() => act(() => revealMagicGame(santaId), "Rôles et classement révélés à tous.")}
          >
            Révéler les rôles et le classement
          </Button>
        ) : null}
        {stopping ? (
          <>
            <Button
              variant="rust"
              size={46}
              disabled={pending}
              onClick={() => act(() => deleteMagicGame(santaId), "Jeu arrêté.")}
            >
              Confirmer : tout effacer
            </Button>
            <Button variant="ghost" size={46} onClick={() => setStopping(false)}>
              Annuler
            </Button>
          </>
        ) : (
          <Button variant="rust-outline" size={46} onClick={() => setStopping(true)}>
            Arrêter le jeu
          </Button>
        )}
      </div>
    </SantaSection>
  );
}
