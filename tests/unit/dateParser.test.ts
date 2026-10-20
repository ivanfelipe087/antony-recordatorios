import { describe, it, expect } from "vitest";
import { parseWhen } from "../../src/utils/dateParser";

describe("parseWhen", () => {
  const now = new Date("2026-10-20T10:00:00");

  it("parsea fecha absoluta", () => {
    const r = parseWhen("2026-10-22 15:30", now);
    expect("date" in r).toBe(true);
    if ("date" in r) {
      expect(r.date.getFullYear()).toBe(2026);
      expect(r.date.getMonth()).toBe(9);
      expect(r.date.getDate()).toBe(22);
      expect(r.date.getHours()).toBe(15);
      expect(r.date.getMinutes()).toBe(30);
    }
  });

  it("parsea relativo en horas", () => {
    const r = parseWhen("en 2h", now);
    expect("date" in r).toBe(true);
    if ("date" in r) {
      expect(r.date.getTime()).toBe(now.getTime() + 2 * 3_600_000);
    }
  });

  it("parsea relativo en minutos", () => {
    const r = parseWhen("en 30m", now);
    expect("date" in r).toBe(true);
    if ("date" in r) {
      expect(r.date.getTime()).toBe(now.getTime() + 30 * 60_000);
    }
  });

  it("rechaza fecha pasada", () => {
    const r = parseWhen("2020-01-01 10:00", now);
    expect("error" in r).toBe(true);
  });

  it("rechaza formato invalido", () => {
    const r = parseWhen("foo bar", now);
    expect("error" in r).toBe(true);
  });
});
