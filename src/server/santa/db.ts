import "server-only";
import { cache } from "react";
import { checkDraw, DrawError, type DrawEntry } from "@/lib/santa/draw";
import type { DrawCheck, LutinProfile, LutinView, OrganizerView, SantaInfo } from "@/lib/santa/types";
import { getServiceDb } from "@/server/db/client";
import type { Tables } from "@/types/database";
import { decryptAssignment, hashToken, looksLikeToken } from "./crypto";
import { magicSummary } from "@/server/magic/game";
import { mailConfigured } from "./mail";

type SantaRow = Tables<"santas">;
type ParticipantRow = Tables<"santa_participants">;

export function toSantaInfo(row: SantaRow): SantaInfo {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    message: row.message,
    budget: row.budget,
    exchangeDate: row.exchange_date,
    status: row.status,
    launchedAt: row.launched_at,
  };
}

export const getSantaBySlug = cache(async (slug: string): Promise<SantaInfo | null> => {
  if (!/^[a-z0-9-]{3,90}$/.test(slug)) return null;
  const { data } = await getServiceDb().from("santas").select("*").eq("slug", slug).maybeSingle();
  return data ? toSantaInfo(data) : null;
});

function profileOf(row: ParticipantRow): LutinProfile {
  return {
    age: row.age ?? "",
    shoeSize: row.shoe_size ?? "",
    clothingSize: row.clothing_size ?? "",
    tastes: row.tastes ?? "",
  };
}

/**
 * Contrôle complet d'un tirage lancé : chaque ligne se déchiffre, et l'ensemble respecte
 * toutes les règles (`checkDraw`). Le résultat ne dit rien de qui a tiré qui.
 */
function verifyLaunched(santaId: string, rows: ParticipantRow[], themeIds: string[]): DrawCheck {
  const draw: DrawEntry[] = [];
  for (const row of rows) {
    const value = row.assignment ? decryptAssignment(santaId, row.id, row.assignment) : null;
    if (!value) return { ok: false, reason: "Un tirage est illisible." };
    draw.push({ giverId: row.id, receiverId: value.receiverId, themeId: value.themeId });
  }
  try {
    checkDraw(
      draw,
      rows.map((r) => r.id),
      themeIds,
    );
    return { ok: true, count: rows.length };
  } catch (error) {
    return { ok: false, reason: error instanceof DrawError ? error.message : "Tirage invalide." };
  }
}

export async function loadOrganizerView(santa: SantaInfo): Promise<OrganizerView> {
  const db = getServiceDb();
  const [themes, participants] = await Promise.all([
    db.from("santa_themes").select("id, label").eq("santa_id", santa.id).order("position"),
    db.from("santa_participants").select("*").eq("santa_id", santa.id).order("position"),
  ]);
  const rows = participants.data ?? [];
  const themeRows = themes.data ?? [];
  return {
    santa,
    themes: themeRows,
    participants: rows.map((r) => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      mailedAt: r.mailed_at,
      mailError: r.mail_error,
      openedAt: r.opened_at,
      confirmedAt: r.confirmed_at,
    })),
    check:
      santa.status === "launched"
        ? verifyLaunched(
            santa.id,
            rows,
            themeRows.map((t) => t.id),
          )
        : null,
    mailReady: mailConfigured(),
    magic: santa.status === "launched" ? await magicSummary(santa.id) : null,
  };
}

export type LutinContext = {
  santa: SantaInfo;
  me: ParticipantRow;
  target: ParticipantRow;
  themeLabel: string;
};

/** Participant d'après son lien personnel, avec son tirage déchiffré ; `null` si le lien ne vaut plus. */
export async function loadLutinContext(token: string): Promise<LutinContext | null> {
  if (!looksLikeToken(token)) return null;
  const db = getServiceDb();
  const { data: me } = await db
    .from("santa_participants")
    .select("*")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!me?.assignment) return null;
  const { data: santaRow } = await db.from("santas").select("*").eq("id", me.santa_id).maybeSingle();
  if (!santaRow || santaRow.status !== "launched") return null;
  const value = decryptAssignment(me.santa_id, me.id, me.assignment);
  if (!value || value.receiverId === me.id) return null;
  const [{ data: target }, { data: theme }] = await Promise.all([
    db
      .from("santa_participants")
      .select("*")
      .eq("id", value.receiverId)
      .eq("santa_id", me.santa_id)
      .maybeSingle(),
    db.from("santa_themes").select("label").eq("id", value.themeId).eq("santa_id", me.santa_id).maybeSingle(),
  ]);
  if (!target || !theme) return null;
  return { santa: toSantaInfo(santaRow), me, target, themeLabel: theme.label };
}

export function toLutinView(ctx: LutinContext): LutinView {
  return {
    santa: ctx.santa,
    me: {
      id: ctx.me.id,
      firstName: ctx.me.first_name,
      confirmedAt: ctx.me.confirmed_at,
      profile: profileOf(ctx.me),
      hasList: Boolean(ctx.me.list_id),
    },
    target: {
      firstName: ctx.target.first_name,
      lastName: ctx.target.last_name,
      profile: profileOf(ctx.target),
      hasList: Boolean(ctx.target.list_id),
    },
    theme: ctx.themeLabel,
  };
}
