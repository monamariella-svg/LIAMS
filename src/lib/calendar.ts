// Utilitaires de dates pour le calendrier hebdomadaire (planning), en manipulant
// des chaînes ISO "YYYY-MM-DD" via des Date UTC pour éviter tout décalage de
// fuseau horaire (piège classique avec `new Date("YYYY-MM-DD")`).

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return formatISODate(date);
}

export function todayISO(): string {
  return formatISODate(new Date());
}

// 0 = lundi ... 6 = dimanche (convention utilisée dans tout le projet, voir disponibilites.ts)
export function isoWeekday(iso: string): number {
  const jsDay = parseISODate(iso).getUTCDay(); // 0 = dimanche ... 6 = samedi
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function startOfWeek(iso: string): string {
  return addDays(iso, -isoWeekday(iso));
}

export function getWeekDates(weekStartIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStartIso, i));
}

export function formatDateLabel(iso: string): string {
  return parseISODate(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

// Calcule toutes les dates entre startIso et endIso (inclus) tombant sur l'un
// des jours de semaine demandés (0 = lundi ... 6 = dimanche).
export function computeRecurringDates(
  startIso: string,
  endIso: string,
  weekdays: number[],
): string[] {
  const weekdaySet = new Set(weekdays);
  const dates: string[] = [];
  let cursor = startIso;
  let guard = 0;
  while (cursor <= endIso && guard < 400) {
    if (weekdaySet.has(isoWeekday(cursor))) dates.push(cursor);
    cursor = addDays(cursor, 1);
    guard++;
  }
  return dates;
}
