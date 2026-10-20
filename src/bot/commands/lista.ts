import { bot } from "../bot.js";
import { prisma } from "../../db/prisma.js";
import { formatInTz } from "../../utils/tz.js";
import { listReminders, deleteReminder } from "../../services/reminderService.js";

bot.command("lista", async (ctx: any) => {
  const from = ctx.from;
  if (!from) return;
  const user = await prisma.user.findUnique({ where: { id: BigInt(from.id) } });
  if (!user) {
    await ctx.reply("Primero usa /start.");
    return;
  }

  const includeAll = (ctx.message.text || "").toLowerCase().includes("todo");
  const reminders = await listReminders(BigInt(from.id), includeAll);

  if (reminders.length === 0) {
    await ctx.reply("📭 No tienes recordatorios.");
    return;
  }

  const lines = reminders.map((r) => {
    const when = formatInTz(r.triggerAt, user.timezone);
    const status = r.status === "PENDING" ? "⏳" : r.status === "SNOOZED" ? "⏰" : r.status === "DONE" ? "✅" : "❌";
    return `${status} \`${r.id.slice(0, 8)}\` — ${r.text}\n   🕒 ${when}`;
  });

  await ctx.reply(`📋 *Tus recordatorios*\n\n${lines.join("\n\n")}`, { parse_mode: "Markdown" });
});

bot.command("eliminar", async (ctx: any) => {
  const from = ctx.from;
  if (!from) return;
  const args = (ctx.message.text || "").replace(/^\/eliminar\s*/i, "").trim();
  if (!args) {
    await ctx.reply("Uso: /eliminar <id>");
    return;
  }
  const deleted = await deleteReminder(args, BigInt(from.id));
  if (!deleted) {
    await ctx.reply("❌ No encontré ese recordatorio o no te pertenece.");
    return;
  }
  await ctx.reply(`🗑 Eliminado: ${deleted.text}`);
});
