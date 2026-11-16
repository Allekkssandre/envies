import { describe, expect, it } from "vitest";
import {
  CATCH_GAIN,
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROUNDS,
  assignRoles,
  certificates,
  clueIsTrue,
  fakeClueOptions,
  alibiWeeks,
  loupeResult,
  displayNames,
  flair,
  grinchCount,
  letterCount,
  makeClue,
  playerPoints,
  pointTotal,
  resolveRound,
  startMagic,
  tally,
  threshold,
  type Player,
  type Rng,
  type Vote,
} from "./engine";

const random: Rng = (max) => Math.floor(Math.random() * max);

function seeded(seed: number): Rng {
  let s = seed >>> 0;
  return (max) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return Math.floor((s / 2 ** 32) * max);
  };
}

const players = (roles: string): Player[] =>
  [...roles].map((r, i) => ({ id: `p${i}`, role: r === "g" ? "gr" : "pn", out: false }));

describe("mise en place", () => {
  it("environ un Krampus pour quatre joueurs", () => {
    expect(grinchCount(5)).toBe(1);
    expect(grinchCount(8)).toBe(2);
    expect(grinchCount(12)).toBe(3);
    expect(grinchCount(20)).toBe(5);
    expect(threshold(5)).toBe(2);
    expect(threshold(12)).toBe(3);
  });

  it("tire le bon nombre de Krampus, au hasard", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `p${i}`);
    const seen = new Set<string>();
    for (let k = 0; k < 200; k++) {
      const roles = assignRoles(ids, random);
      const grinchs = ids.filter((id) => roles.get(id) === "gr");
      expect(grinchs).toHaveLength(3);
      for (const g of grinchs) seen.add(g);
    }
    expect(seen.size).toBe(12);
  });

  it("Magie de départ pour chaque taille de groupe, réglable", () => {
    for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
      const base = startMagic(n);
      expect(base).toBeGreaterThan(1);
      // Les Krampus peuvent toujours gagner par le seul sabotage.
      expect(base).toBeLessThanOrEqual(grinchCount(n) * ROUNDS);
      expect(startMagic(n, "pn")).toBeGreaterThanOrEqual(base);
      expect(startMagic(n, "gr")).toBeLessThanOrEqual(base);
    }
    expect(startMagic(12)).toBe(12);
  });
});

describe("désignations", () => {
  const roster = players("ggg" + "p".repeat(9));
  const v = (voter: number, target: number): Vote => ({ voter: `p${voter}`, target: `p${target}` });

  it("démasque le plus désigné s'il atteint le seuil, sans égalité", () => {
    expect(tally(roster, [v(3, 0), v(4, 0), v(5, 0)]).unmasked).toBe("p0");
    expect(tally(roster, [v(3, 0), v(4, 0)]).unmasked).toBeNull();
    expect(tally(roster, [v(3, 0), v(4, 0), v(5, 0), v(6, 7), v(8, 7), v(9, 7)]).unmasked).toBeNull();
  });

  it("ignore les votes pour soi, des Krampus démasqués et contre les démasqués", () => {
    const r = roster.map((p) => (p.id === "p1" || p.id === "p10" ? { ...p, out: true } : p));
    const counts = tally(r, [v(3, 3), v(1, 4), v(5, 10), v(6, 4)]).counts;
    expect(counts).toEqual({ p4: 1 });
  });
});

describe("résolution d'une semaine", () => {
  const roster = players("ggg" + "p".repeat(9));
  const votes = (target: number) => [3, 4, 5].map((i) => ({ voter: `p${i}`, target: `p${target}` }));

  it("Krampus démasqué : +2 plafonné, puis sabotage des autres", () => {
    const r = resolveRound({ round: 1, magic: 9, startMagic: 12, players: roster, votes: votes(0) });
    expect(r.unmaskedRole).toBe("gr");
    expect(r.accusation).toBe(CATCH_GAIN);
    expect(r.sabotage).toBe(2);
    expect(r.after).toBe(9);
    const capped = resolveRound({ round: 1, magic: 12, startMagic: 12, players: roster, votes: votes(0) });
    expect(capped.accusation).toBe(0);
    expect(capped.after).toBe(10);
  });

  it("Père Noël démasqué : −1, et tous les Krampus sabotent", () => {
    const r = resolveRound({ round: 1, magic: 12, startMagic: 12, players: roster, votes: votes(6) });
    expect(r.unmaskedRole).toBe("pn");
    expect(r.after).toBe(12 - 1 - 3);
  });

  it("sans personne : seul le sabotage joue, et la partie se termine quand même", () => {
    let magic = startMagic(12);
    let result = null;
    for (let round = 1; round <= ROUNDS && !result?.end; round++) {
      result = resolveRound({ round, magic, startMagic: 12, players: roster, votes: [] });
      magic = result.after;
    }
    expect(result?.end).toBe("zero");
    expect(result?.winner).toBe("gr");
  });

  it("victoire des Pères Noël quand tous les Krampus sont démasqués", () => {
    const r = roster.map((p) => (p.id === "p0" || p.id === "p1" ? { ...p, out: true } : p));
    const res = resolveRound({ round: 3, magic: 5, startMagic: 12, players: r, votes: votes(2) });
    expect(res.end).toBe("all-caught");
    expect(res.winner).toBe("pn");
  });

  it("victoire des Pères Noël si la Magie tient cinq semaines", () => {
    const r = roster.map((p) => (p.id === "p0" || p.id === "p1" ? { ...p, out: true } : p));
    const res = resolveRound({ round: ROUNDS, magic: 4, startMagic: 12, players: r, votes: [] });
    expect(res.after).toBe(3);
    expect(res.end).toBe("last-round");
  });
});

describe("indices", () => {
  const people = [
    { id: "a", firstName: "Hélène", lastName: "Martin", role: "gr" as const, out: false },
    { id: "b", firstName: "Paul", lastName: "Durand", role: "pn" as const, out: false },
    { id: "c", firstName: "Zoé", lastName: "Petit", role: "pn" as const, out: false },
    { id: "d", firstName: "Paul", lastName: "Simon", role: "pn" as const, out: false },
  ];

  it("de plus en plus précis, toujours vrais", () => {
    const first = makeClue(1, people, random);
    expect(first?.t).toBe("has");
    if (first?.t === "has") expect("HELENE").toContain(first.letter);
    const second = makeClue(2, people, random);
    expect(second?.t).toBe("length");
    const innocent = makeClue(3, people, random);
    expect(innocent?.t).toBe("innocent");
    if (innocent?.t === "innocent") expect(innocent.names).not.toContain("Hélène");
    const among = makeClue(4, people, random);
    expect(among?.t).toBe("among");
    if (among?.t === "among") expect(among.names).toContain("Hélène");
  });

  it("une lettre et une longueur qui laissent environ la moitié des joueurs suspects", () => {
    const crowd = [
      { id: "k", firstName: "Xavier", lastName: "A", role: "gr" as const, out: false },
      ...["Anne", "Paul", "Marie", "Louis", "Emma", "Jean", "Clara", "Hugo", "Lea", "Tom"].map(
        (firstName, i) => ({ id: `p${i}`, firstName, lastName: "B", role: "pn" as const, out: false }),
      ),
    ];
    for (let k = 0; k < 100; k++) {
      for (const week of [1, 2]) {
        const clue = makeClue(week, crowd, random)!;
        const share = crowd.filter((p) =>
          clueIsTrue(clue, [{ ...p, role: "gr", out: false }], displayNames([p])),
        ).length;
        // Jamais la seule personne désignée par un X rare : au moins un tiers des joueurs suspects.
        expect(share).toBeGreaterThanOrEqual(4);
        expect(share).toBeLessThanOrEqual(8);
      }
    }
  });

  it("aucun indice quand tous les Krampus sont démasqués", () => {
    const caught = people.map((p) => ({ ...p, out: p.role === "gr" }));
    expect(makeClue(2, caught, random)).toBeNull();
  });

  it("prénoms en double distingués par l'initiale", () => {
    const names = displayNames(people);
    expect(names.get("b")).toBe("Paul D.");
    expect(names.get("d")).toBe("Paul S.");
    expect(names.get("c")).toBe("Zoé");
    expect(letterCount("Jean-Éric")).toBe(8);
  });
});

describe("secrets et flair", () => {
  it("chaque Père Noël reçoit un autre Père Noël, les Krampus rien", () => {
    const roster = players("gg" + "p".repeat(8));
    const certs = certificates(roster, random);
    expect(certs.size).toBe(8);
    for (const [id, cert] of certs) {
      expect(cert).not.toBe(id);
      expect(roster.find((p) => p.id === cert)?.role).toBe("pn");
    }
  });

  it("flair : désignations portées sur un Krampus encore caché", () => {
    const points = flair([
      {
        votes: [
          { voter: "x", target: "g" },
          { voter: "y", target: "p" },
        ],
        hiddenKrampus: ["g"],
      },
      { votes: [{ voter: "x", target: "g" }], hiddenKrampus: [] },
    ]);
    expect(points.get("x")).toBe(1);
    expect(points.get("y")).toBeUndefined();
  });
});

/**
 * Équilibre (docs/14-magie-de-noel.md § Équilibre) : les Pères Noël visent juste de plus en
 * plus souvent au fil des indices, les Krampus accusent ensemble un innocent.
 */
function simulate(n: number, participation: number, rng: Rng): "pn" | "gr" {
  const ids = Array.from({ length: n }, (_, i) => `p${i}`);
  const roles = assignRoles(ids, rng);
  let roster: Player[] = ids.map((id) => ({ id, role: roles.get(id)!, out: false }));
  const start = startMagic(n);
  let magic = start;
  const accuracy = [0.3, 0.4, 0.5, 0.6, 0.65];
  const chance = (p: number) => rng(1000) < p * 1000;
  for (let round = 1; round <= ROUNDS; round++) {
    const hiddenG = roster.filter((p) => p.role === "gr" && !p.out);
    const hiddenP = roster.filter((p) => p.role === "pn" && !p.out);
    const lead = hiddenG[rng(hiddenG.length)]!;
    const frame = hiddenP[rng(hiddenP.length)];
    const votes: Vote[] = [];
    for (const voter of roster) {
      if ((voter.out && voter.role === "gr") || !chance(participation)) continue;
      if (voter.role === "gr") {
        if (frame) votes.push({ voter: voter.id, target: frame.id });
      } else if (chance(accuracy[round - 1]!)) {
        const g = chance(0.6) ? lead : hiddenG[rng(hiddenG.length)]!;
        votes.push({ voter: voter.id, target: g.id });
      } else {
        const others = hiddenP.filter((p) => p.id !== voter.id);
        if (others.length) votes.push({ voter: voter.id, target: others[rng(others.length)]!.id });
      }
    }
    const res = resolveRound({ round, magic, startMagic: start, players: roster, votes });
    magic = res.after;
    roster = roster.map((p) => (p.id === res.unmasked ? { ...p, out: true } : p));
    if (res.winner) return res.winner;
  }
  return "pn";
}

describe("équilibre", () => {
  it("à 12 joueurs, environ une chance sur deux quand 60 % désignent", () => {
    const rng = seeded(42);
    const games = 4000;
    let pn = 0;
    for (let i = 0; i < games; i++) if (simulate(12, 0.6, rng) === "pn") pn++;
    expect(pn / games).toBeGreaterThan(0.4);
    expect(pn / games).toBeLessThan(0.65);
  });

  it("plus on joue, plus les Pères Noël gagnent", () => {
    const rng = seeded(7);
    const rate = (p: number) => {
      let pn = 0;
      for (let i = 0; i < 2000; i++) if (simulate(12, p, rng) === "pn") pn++;
      return pn / 2000;
    };
    expect(rate(0.2)).toBeLessThan(rate(0.6));
  });
});

describe("atouts", () => {
  const people = [
    { id: "k1", firstName: "Hélène", lastName: "Martin", role: "gr" as const, out: false },
    { id: "k2", firstName: "Bruno", lastName: "Petit", role: "gr" as const, out: false },
    { id: "p1", firstName: "Paul", lastName: "Durand", role: "pn" as const, out: false },
    { id: "p2", firstName: "Zoé", lastName: "Petit", role: "pn" as const, out: false },
    { id: "p3", firstName: "Marc", lastName: "Simon", role: "pn" as const, out: false },
    { id: "p4", firstName: "Julie", lastName: "Roux", role: "pn" as const, out: false },
    { id: "p5", firstName: "Nathalie", lastName: "Blanc", role: "pn" as const, out: false },
  ];

  it("Loupe : vrai s'il y a un Krampus sans alibi parmi les deux", () => {
    expect(loupeResult(people, ["k1", "p1"], new Set())).toBe(true);
    expect(loupeResult(people, ["p1", "p2"], new Set())).toBe(false);
    expect(loupeResult(people, ["k1", "p1"], new Set(["k1"]))).toBe(false);
    expect(loupeResult(people, ["k1", "k2"], new Set(["k1"]))).toBe(true);
  });

  it("Alibi : la semaine où il est joué et la suivante, jamais au-delà de la dernière", () => {
    expect(alibiWeeks(1)).toEqual([1, 2]);
    expect(alibiWeeks(4)).toEqual([4, 5]);
    expect(alibiWeeks(5)).toEqual([5]);
  });

  it("Fausse piste : jusqu'à trois indices, tous faux, quelle que soit la semaine", () => {
    const names = displayNames(people);
    for (let week = 1; week <= 5; week++) {
      for (let k = 0; k < 50; k++) {
        const options = fakeClueOptions(week, people, random);
        expect(options.length).toBeGreaterThan(0);
        expect(options.length).toBeLessThanOrEqual(3);
        for (const clue of options) expect(clueIsTrue(clue, people, names)).toBe(false);
      }
    }
  });

  it("les vrais indices sont reconnus comme vrais", () => {
    const names = displayNames(people);
    for (let week = 1; week <= 5; week++) {
      for (let k = 0; k < 50; k++) {
        const clue = makeClue(week, people, random);
        expect(clue && clueIsTrue(clue, people, names)).toBe(true);
      }
    }
  });
});

describe("points personnels", () => {
  // a et b sont Krampus ; b est démasqué en semaine 2, c (Père Noël) en semaine 1.
  const players = [
    { id: "a", role: "gr" as const, outRound: null },
    { id: "b", role: "gr" as const, outRound: 2 },
    { id: "c", role: "pn" as const, outRound: 1 },
    { id: "d", role: "pn" as const, outRound: null },
    { id: "e", role: "pn" as const, outRound: null },
  ];
  const rounds = [
    {
      round: 1,
      votes: [
        { voter: "a", target: "c" },
        { voter: "d", target: "c" },
        { voter: "e", target: "b" },
      ],
    },
    {
      round: 2,
      votes: [
        { voter: "d", target: "b" },
        { voter: "e", target: "b" },
        { voter: "c", target: "a" },
      ],
    },
    // Un Krampus démasqué ne compte plus, ni comme votant ni comme cible.
    {
      round: 3,
      votes: [
        { voter: "b", target: "d" },
        { voter: "d", target: "b" },
      ],
    },
  ];
  const points = playerPoints(players, rounds);
  const total = (id: string) => pointTotal(points.get(id)!);

  it("récompense le flair et le démasquage des Pères Noël, punit l'erreur", () => {
    expect(points.get("d")!.map((l) => l.kind)).toEqual(["wrong", "flair", "catch"]);
    expect(total("d")).toBe(2);
    expect(total("e")).toBe(2 + 2 + 1);
    expect(total("c")).toBe(2);
  });

  it("récompense le camouflage et les manigances des Krampus, punit le démasquage", () => {
    expect(points.get("a")!.map((l) => l.kind)).toEqual(["scheme", "camouflage", "camouflage", "camouflage"]);
    expect(total("a")).toBe(8);
    expect(points.get("b")!.map((l) => l.kind)).toEqual(["camouflage", "caught"]);
    expect(total("b")).toBe(0);
  });

  it("ne compte qu'une désignation par joueur et par semaine", () => {
    const twice = playerPoints(players, [
      {
        round: 1,
        votes: [
          { voter: "e", target: "b" },
          { voter: "e", target: "a" },
        ],
      },
    ]);
    expect(pointTotal(twice.get("e")!)).toBe(2);
  });
});
