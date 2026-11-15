"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { MAX_PLAYERS, MIN_PLAYERS, ROUNDS, type Level } from "@/lib/magic/engine";
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
  const [level, setLevel] = useState<Level>("balanced");
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
        hint={`Un jeu de ${ROUNDS} semaines, en parallèle des cadeaux : quelques Krampus tirés au sort se cachent parmi les participants, et chacun peut désigner chaque semaine la personne qu'il soupçonne d'en être un.`}
      >
        {players >= MIN_PLAYERS && players <= MAX_PLAYERS ? (
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
                    level,
                  }),
                "Jeu ouvert. Chacun reçoit un mail et trouve son rôle sur sa page.",
              );
            }}
          >
            <Field
              label="Début de la partie"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              hint="Les rôles sont tirés tout de suite. La première semaine commence à cette date."
            />
            <Field
              label="Durée d'une manche (jours)"
              type="number"
              min={1}
              max={14}
              value={roundDays}
              onChange={(e) => setRoundDays(e.target.value)}
              hint={`${ROUNDS} semaines de jeu : ${ROUNDS * Number(roundDays || 0)} jours en tout.`}
            />
            <label className="flex flex-col gap-1.5 text-[15px] font-semibold">
              Équilibre
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as Level)}
                className="min-h-11 rounded-xl border border-ink/20 bg-linen px-3 text-[15px] font-normal"
              >
                <option value="balanced">Équilibré</option>
                <option value="pn">Avantage Pères Noël</option>
                <option value="gr">Avantage Krampus</option>
              </select>
              <span className="text-[13px] font-normal text-ink-soft">
                Règle la Magie de départ. Équilibré : une chance sur deux pour chaque camp.
              </span>
            </label>
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
            Le jeu se joue de {MIN_PLAYERS} à {MAX_PLAYERS} participants. Ce Secret Santa en compte {players}.
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
      hint="Vous ne voyez ici aucun rôle. Jouez depuis votre lien personnel, comme les autres."
    >
      <p className="m-0 text-[15px] leading-normal">
        {magic.status === "waiting"
          ? `${magic.players} joueurs. Première semaine le ${formatMoment(magic.startsAt)}. Fin le ${formatMoment(end)}.`
          : magic.status === "playing"
            ? `Semaine ${magic.round + 1} sur ${ROUNDS}. Magie de Noël : ${magic.magic} sur ${magic.startMagic}. Fin le ${formatMoment(end)}.`
            : over}
      </p>
      <p className="m-0 text-sm text-ink-soft">
        Une gazette part par mail à la fin de chaque semaine. Si les mails arrivent dans les indésirables,
        demandez à chacun de marquer le premier comme « non spam ».
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
