import { randomInt } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  GR_CARDS,
  PN_CARDS,
  assignJoin,
  checkRoster,
  joinOption,
  letterCount,
  resolveRound,
  scores,
  tally,
  type GrCard,
  type PlayerSecret,
  type PnCard,
  type Role,
} from "./engine";

function fill(choices: (Role | null)[]): PlayerSecret[] {
  const joined: PlayerSecret[] = [];
  for (const c of choices) joined.push(assignJoin(joined, c, randomInt));
  return joined;
}

describe("choix du camp", () => {
  it("12 arrivées au hasard : toujours 5 + 5 + 2, cartes et pseudonymes différents", () => {
    for (let run = 0; run < 3000; run++) {
      const players = fill(Array.from({ length: 12 }, () => null));
      expect(() => checkRoster(players)).not.toThrow();
    }
  });

  it("un camp complet envoie dans l'autre, les deux derniers sont infiltrés", () => {
    const players = fill(["gr", "gr", "gr", "gr", "gr", "gr", "gr", "pn", "pn", "pn", "inf_pn", "inf_pn"]);
    expect(players.map((p) => p.role)).toEqual([
      "gr",
      "gr",
      "gr",
      "gr",
      "gr",
      "pn",
      "pn",
      "pn",
      "pn",
      "pn",
      "inf_pn",
      "inf_gr",
    ]);
    checkRoster(players);
  });

  it("ce que voit l'arrivant : choix du camp, rôle donné, puis choix de l'infiltré", () => {
    const joined: PlayerSecret[] = [];
    const seen: string[] = [];
    for (const c of ["pn", "pn", "pn", "pn", "pn", "pn", "gr", "gr", "gr", "gr", "inf_gr", null] as const) {
      seen.push(joinOption(joined));
      joined.push(assignJoin(joined, c, randomInt));
    }
    expect(seen).toEqual([
      "camp",
      "camp",
      "camp",
      "camp",
      "camp",
      "auto",
      "auto",
      "auto",
      "auto",
      "auto",
      "infiltre",
      "auto",
    ]);
    expect(() => assignJoin(joined, null, randomInt)).toThrow();
  });
});

describe("vote", () => {
  const voters = ["a", "b", "c", "d"];
  it("le plus voté gagne ; votes hors liste ou en double ignorés", () => {
    const t = tally(
      [
        { voter: "a", target: "x" },
        { voter: "b", target: "x" },
        { voter: "c", target: "y" },
        { voter: "c", target: "y" },
        { voter: "z", target: "y" },
        { voter: "d", target: "déjà joué" },
      ],
      voters,
      ["x", "y"],
      randomInt,
    );
    expect(t).toMatchObject({ winner: "x", counts: { x: 2, y: 1 }, tie: false, noVote: false });
  });
  it("égalité ou aucun vote : tirage au sort parmi les concernés", () => {
    const tie = tally(
      [
        { voter: "a", target: "x" },
        { voter: "b", target: "y" },
      ],
      voters,
      ["x", "y", "w"],
      () => 1,
    );
    expect(tie).toMatchObject({ winner: "y", tie: true });
    expect(tally([], voters, ["x", "y", "w"], () => 2)).toMatchObject({ winner: "w", noVote: true });
  });
});

describe("résolution d'une manche", () => {
  const base = { round: 2, gauge: 4, frozen: false, maxLoss: 0 };
  it("attaque et défense comptées ensemble", () => {
    expect(resolveRound({ ...base, pnCard: "lanterne", grCard: "siphon" })).toMatchObject({
      loss: 2,
      gain: 1,
      gaugeAfter: 3,
      lanterne: true,
      nature: "mag",
    });
  });
  it("Pare-feu et Bouclier ne bloquent que leur nature ; un blocage annule tout l'effet", () => {
    expect(resolveRound({ ...base, pnCard: "parefeu", grCard: "cyber" })).toMatchObject({
      blocked: true,
      loss: 0,
      grVisit: false,
    });
    expect(resolveRound({ ...base, pnCard: "parefeu", grCard: "siphon" })).toMatchObject({
      blocked: false,
      loss: 2,
    });
    expect(resolveRound({ ...base, pnCard: "bouclier", grCard: "corrupteur" })).toMatchObject({
      blocked: true,
      corrupteur: false,
    });
    expect(resolveRound({ ...base, pnCard: "bouclier", grCard: "givre" })).toMatchObject({
      blocked: false,
      frozenNext: true,
    });
  });
  it("pouvoir gelé : consommé sans effet, visite comprise", () => {
    expect(resolveRound({ ...base, frozen: true, pnCard: "facteur", grCard: "siphon" })).toMatchObject({
      gain: 0,
      pnVisit: false,
      loss: 2,
    });
    expect(resolveRound({ ...base, frozen: true, pnCard: "parefeu", grCard: "cyber" })).toMatchObject({
      blocked: false,
      grVisit: true,
    });
  });
  it("Givré à la dernière manche : −2, rien à geler", () => {
    expect(resolveRound({ ...base, round: 5, pnCard: "lanterne", grCard: "givre" })).toMatchObject({
      loss: 2,
      frozenNext: false,
    });
  });
  it("Fée : rend la plus grosse perte passée, au moins 1", () => {
    expect(resolveRound({ ...base, maxLoss: 3, pnCard: "fee", grCard: "cyber" }).gain).toBe(3);
    expect(resolveRound({ ...base, maxLoss: 0, pnCard: "fee", grCard: "cyber" }).gain).toBe(1);
  });
  it("les deux espionnages ont le même effet visible que la vraie carte", () => {
    const a = resolveRound({ ...base, pnCard: "espion", grCard: "espion" });
    const b = resolveRound({ ...base, pnCard: "facteur", grCard: "cyber" });
    expect(a).toEqual(b);
    expect(a).toMatchObject({ pnVisit: true, grVisit: true, loss: 1, gain: 1 });
  });
  it("Brouilleur : la nature est cachée aux Pères Noël", () => {
    expect(resolveRound({ ...base, pnCard: "lanterne", grCard: "brouilleur" }).natureShown).toBeNull();
  });
  it("jauge à 0 : les Grinchs gagnent", () => {
    expect(resolveRound({ ...base, gauge: 2, pnCard: "parefeu", grCard: "corrupteur" })).toMatchObject({
      gaugeAfter: 0,
      grinchsWin: true,
    });
  });
});

function permutations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  return items.flatMap((x, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)], k - 1).map((rest) => [x, ...rest]),
  );
}

describe("équilibre", { timeout: 120_000 }, () => {
  it("jauge de départ 4, tous les ordres de vote possibles : entre 45 % et 58 % pour les Grinchs", () => {
    const grOrders = permutations<GrCard | "espion">([...GR_CARDS, "espion"], 5);
    const pnOrders = permutations<PnCard | "espion">([...PN_CARDS, "espion"], 5);
    let total = 0;
    let wins = 0;
    for (const go of grOrders) {
      for (const po of pnOrders) {
        let gauge = 4;
        let frozen = false;
        let maxLoss = 0;
        let won = false;
        for (let r = 1; r <= 5 && !won; r++) {
          const res = resolveRound({
            round: r,
            gauge,
            frozen,
            maxLoss,
            pnCard: po[r - 1]!,
            grCard: go[r - 1]!,
          });
          gauge = res.gaugeAfter;
          frozen = res.frozenNext;
          maxLoss = res.maxLossAfter;
          won = res.grinchsWin;
        }
        total++;
        if (won) wins++;
      }
    }
    expect(total).toBe(720 * 720);
    expect(wins / total).toBeGreaterThan(0.45);
    expect(wins / total).toBeLessThan(0.58);
  });
});

describe("identifications", () => {
  const players: { id: string; role: Role }[] = [
    ...["p1", "p2", "p3", "p4", "p5"].map((id) => ({ id, role: "pn" as const })),
    ...["g1", "g2", "g3", "g4", "g5"].map((id) => ({ id, role: "gr" as const })),
    { id: "i1", role: "inf_gr" },
    { id: "i2", role: "inf_pn" },
  ];
  it("barème : +1, +2, +4 ; faux : −1, −2, −1 ; démasqué : −1", () => {
    const s = scores(players, [
      { accuser: "p1", target: "g1", role: "gr" },
      { accuser: "p1", target: "i1", role: "inf" },
      { accuser: "p2", target: "p3", role: "gr" },
      { accuser: "g1", target: "p1", role: "pn" },
      { accuser: "g2", target: "i2", role: "gr" },
    ]);
    expect(s.get("p1")).toEqual({ points: 2 + 4 - 1, right: 2, wrong: 0, unmasked: 1 });
    expect(s.get("p2")?.points).toBe(-2);
    expect(s.get("g1")?.points).toBe(1 - 1);
    expect(s.get("i1")?.points).toBe(-1);
    // Un infiltré accusé d'être « Grinch » : faux.
    expect(s.get("g2")?.points).toBe(-2);
  });
  it("identifier au hasard perd des points en moyenne, pour tout joueur et tout rôle", () => {
    for (const me of players) {
      for (const role of ["pn", "gr", "inf"] as const) {
        let sum = 0;
        for (const other of players) {
          if (other.id === me.id) continue;
          sum += scores(players, [{ accuser: me.id, target: other.id, role }]).get(me.id)!.points;
        }
        expect(sum, `${me.role} accuse ${role}`).toBeLessThan(0);
      }
    }
  });
});

it("nombre de lettres d'un prénom", () => {
  expect(letterCount("Jean-Noël")).toBe(8);
  expect(letterCount(" Zoé ")).toBe(3);
});
