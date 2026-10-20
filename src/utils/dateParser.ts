// Parser de fechas para recordatorios.
// Soporta:
//  - "YYYY-MM-DD HH:MM"
//  - "mañana 09:00", "pasado mañana 15:30"
//  - "en 2h", "en 30m", "en 1d"

export type ParsedWhen = { date: Date } | { error: string };

const RELATIVE_RE = /^en\s+(\d+)\s*(m|min|h|hr|d|dia|dias|day|days)$/i;
const TOMORROW_RE = /^(mañana|manana|tomorrow)\s+(\d{1,2}):(\d{2})$/i;
const DAYAFTER_RE = /^(pasado mañana|pasado manana)\s+(\d{1,2}):(\d{2})$/i;
const ABSOLUTE_RE = /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})$/;

export function parseWhen(input: string, now: Date = new Date()): ParsedWhen {
  const s = input.trim();

  let m = s.match(RELATIVE_RE);
  if (m) {
    const n = Number(m[1]);
    const unit = (m[2] ?? "").toLowerCase();
    const ms =
      unit.startsWith("m")
        ? n * 60_000
        : unit.startsWith("h")
          ? n * 3_600_000
          : n * 86_400_000;
    return { date: new Date(now.getTime() + ms) };
  }

  m = s.match(TOMORROW_RE);
  if (m) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(Number(m[2]), Number(m[3]), 0, 0);
    return { date: d };
  }

  m = s.match(DAYAFTER_RE);
  if (m) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    d.setHours(Number(m[2]), Number(m[3]), 0, 0);
    return { date: d };
  }

  m = s.match(ABSOLUTE_RE);
  if (m) {
    const datePart = m[1];
    const hour = Number(m[2]);
    const minute = Number(m[3]);
    if (hour > 23 || minute > 59) return { error: "Hora invalida" };
    const d = new Date(`${datePart}T00:00:00`);
    if (isNaN(d.getTime())) return { error: "Fecha invalida" };
    d.setHours(hour, minute, 0, 0);
    if (d.getTime() <= now.getTime()) return { error: "La fecha debe ser futura" };
    return { date: d };
  }

  return { error: "Formato no reconocido. Usa: YYYY-MM-DD HH:MM, 'mañana HH:MM', 'en 2h'" };
}
