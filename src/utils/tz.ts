// Utilidades de zona horaria
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function listTimezones(): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const intl = Intl as any;
  if (typeof intl.supportedValuesOf === "function") {
    return intl.supportedValuesOf("timeZone") as string[];
  }
  return [];
}

export function toUtc(localDate: Date, tz: string): Date {
  // Convierte una fecha "wall-clock" interpretada en tz a UTC
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(localDate);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const iso = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
  // Calculamos offset
  const utcDate = new Date(iso + "Z");
  const offsetMs = localDate.getTime() - utcDate.getTime();
  return new Date(localDate.getTime() - offsetMs);
}

export function formatInTz(date: Date, tz: string, locale = "es-ES"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
