const dayMonth = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const dayMonthYear = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** « le 12 octobre » (l'année seulement si elle diffère de celle de `now`). */
export function formatDayMonth(date: Date, now: Date = new Date()): string {
  const f = date.getFullYear() === now.getFullYear() ? dayMonth : dayMonthYear;
  return `le ${f.format(date)}`;
}

/**
 * Date relative (docs/12-textes.md) : « à l'instant », « il y a 2 min », « il y a 3 h »,
 * « hier », « il y a 2 jours », puis « le 12 octobre ».
 */
export function formatRelative(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return `il y a ${Math.floor(minutes / 60)} h`;
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} jours`;
  return formatDayMonth(date, now);
}
