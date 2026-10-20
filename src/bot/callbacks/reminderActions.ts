import { bot } from "../bot.js";
import { prisma } from "../../db/prisma.js";
import { logger } from "../../utils/logger.js";
import { formatInTz } from "../../utils/tz.js";
import { markStatus, deleteReminder } from "../../services/reminderService.js";
import { createReminder } from "../../services/reminderService.js";

bot.action(/^done:(.+)$/, async (ctx: any) => {
  const id = ctx.match[1];
  await ctx.answerCbQuery("Marcado como hecho ✅");
  await markStatus(id, "DONE");
  try {
    await ctx.editMessageText("✅ Recordatorio marcado como hecho.");
  } catch {}
});

bot.action(/^delete:(.+)$/, async (ctx: any) => {
  const id = ctx.match[1];
  const from = ctx.from;
  if (!from) return;
  await ctx.answerCbQuery("Eliminado 🗑");
  await deleteReminder(id, BigInt(from.id));
  try {
    await ctx.editMessageText("🗑 Recordatorio eliminado.");
  } catch {}
});

bot.action(/^snooze:(.+):(\d+)$/, async (ctx: any) => {
  const id = ctx.match[1];
  const mins = Number(ctx.match[2]);
  await ctx.answerCbQuery(`Posponiendo ${mins} min ⏰`);
  const r = await prisma.reminder.findUnique({ where: { id }, include: { user: true } });
  if (!r) return;
  const until = new Date(Date.now() + mins * 60_000);
  await markStatus(id, "SNOOZED", until);
  // crear nuevo recordatorio para el snooze
  await createReminder({
    userId: r.userId,
    text: r.text,
    localDate: until,
    tz: r.user.timezone,
    attachmentType: r.attachmentType,
    attachmentFileId: r.attachmentFileId,
    attachmentCaption: r.attachmentCaption,
  });
  try {
    await ctx.editMessageText(`⏰ Posponido ${mins} minutos.`);
  } catch {}
});

bot.action(/^snooze:(.+):tomorrow$/, async (ctx: any) => {
  const id = ctx.match[1];
  await ctx.answerCbQuery("Posponiendo a mañana ⏰");
  const r = await prisma.reminder.findUnique({ where: { id }, include: { user: true } });
  if (!r) return;
  const until = new Date();
  until.setDate(until.getDate() + 1);
  until.setHours(9, 0, 0, 0);
  await markStatus(id, "SNOOZED", until);
  await createReminder({
    userId: r.userId,
    text: r.text,
    localDate: until,
    tz: r.user.timezone,
    attachmentType: r.attachmentType,
    attachmentFileId: r.attachmentFileId,
    attachmentCaption: r.attachmentCaption,
  });
  try {
    await ctx.editMessageText("⏰ Posponido a mañana 09:00.");
  } catch {}
});
