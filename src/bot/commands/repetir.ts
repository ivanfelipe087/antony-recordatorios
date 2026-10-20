import { bot } from "../bot.js";
import { prisma } from "../../db/prisma.js";

bot.command("repetir", async (ctx: any) => {
  const from = ctx.from;
  if (!from) return;
  const parts = (ctx.message.text || "").replace(/^\/repetir\s*/i, "").trim().split(/\s+/);
  const id = parts[0];
  const pattern = parts.slice(1).join(" ").toLowerCase() || "daily";
  if (!id) {
    await ctx.reply("Uso: /repetir <id> <patrón>\nPatrones: daily, weekly, monthly, weekly:mon,wed, monthly:15");
    return;
  }
  const r = await prisma.reminder.findFirst({ where: { id, userId: BigInt(from.id) } });
  if (!r) {
    await ctx.reply("❌ Recordatorio no encontrado.");
    return;
  }
  const rec = await prisma.recurrence.create({ data: { pattern } });
  await prisma.reminder.update({ where: { id }, data: { recurrenceId: rec.id } });
  await ctx.reply(`🔁 Recordatorio ${id.slice(0, 8)} ahora es recurrente: ${pattern}.`);
});
