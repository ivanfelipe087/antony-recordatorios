import { bot } from "../bot.js";
import { prisma } from "../../db/prisma.js";
import { logger } from "../../utils/logger.js";
import { formatInTz } from "../../utils/tz.js";
import { parseWhen } from "../../utils/dateParser.js";
import { createReminder, listReminders } from "../../services/reminderService.js";
import { transcribeAndParseAudio, parseIntentFromText } from "../../services/aiService.js";

// Memoria de intenciones pendientes de confirmación por usuario
const pendingIntent = new Map<number, { intent: any; transcript?: string }>();

bot.on("voice", async (ctx: any) => {
  await handleAudio(ctx, ctx.message.voice.file_id, "audio/ogg");
});

bot.on("audio", async (ctx: any) => {
  const a = ctx.message.audio;
  await handleAudio(ctx, a.file_id, a.mime_type || "audio/mpeg");
});

async function handleAudio(ctx: any, fileId: string, mimeType: string) {
  const from = ctx.from;
  if (!from) return;
  const user = await prisma.user.findUnique({ where: { id: BigInt(from.id) } });
  if (!user) {
    await ctx.reply("Primero usa /start para registrarte.");
    return;
  }

  await ctx.reply("🎧 Procesando audio...");

  try {
    const link = await ctx.telegram.getFileLink(fileId);
    const res = await fetch(link.href);
    const buf = Buffer.from(await res.arrayBuffer());

    const now = new Date();
    const nowIso = now.toISOString();
    const intent = await transcribeAndParseAudio(buf, mimeType, nowIso, user.timezone);

    await processIntent(ctx, user, intent, intent.transcript);
  } catch (e) {
    logger.error(e);
    await ctx.reply("❌ No pude procesar el audio. Intenta de nuevo.");
  }
}

// Texto libre (no comando) → interpretar intención
bot.on("text", async (ctx: any) => {
  const text = ctx.message.text || "";
  if (text.startsWith("/")) return; // es comando, ya manejado
  const from = ctx.from;
  if (!from) return;
  const user = await prisma.user.findUnique({ where: { id: BigInt(from.id) } });
  if (!user) {
    await ctx.reply("Primero usa /start.");
    return;
  }
  const now = new Date();
  const intent = await parseIntentFromText(text, now.toISOString(), user.timezone);
  await processIntent(ctx, user, intent, text);
});

async function processIntent(ctx: any, user: any, intent: any, originalText?: string) {
  const from = ctx.from;

  if (intent.action === "create" || intent.action === "create_recurring") {
    if (!intent.text || !intent.datetime) {
      await ctx.reply(`❌ No entendí bien. ${intent.reply || "Intenta de nuevo."}`);
      return;
    }
    const parsed = parseWhen(intent.datetime.replace("T", " "), new Date());
    if ("error" in parsed) {
      await ctx.reply(`❌ ${parsed.error}`);
      return;
    }

    pendingIntent.set(from.id, { intent, transcript: originalText });

    const when = formatInTz(parsed.date, user.timezone);
    const rec = intent.recurrence ? `\n🔁 Recurrencia: ${intent.recurrence}` : "";
    await ctx.reply(
      `📝 *Confirmar recordatorio*\n\n` +
        `Texto: ${intent.text}\n` +
        `Hora: ${when} (${user.timezone})${rec}\n\n` +
        `¿Crear?`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Crear", callback_data: "confirm_create" },
              { text: "❌ Cancelar", callback_data: "cancel_create" },
            ],
          ],
        },
      },
    );
    return;
  }

  if (intent.action === "list_today") {
    const reminders = await listReminders(BigInt(from.id), false);
    const today = new Date().toDateString();
    const todayRems = reminders.filter((r: any) => new Date(r.triggerAt).toDateString() === today);
    if (todayRems.length === 0) {
      await ctx.reply("📭 No tienes recordatorios para hoy.");
      return;
    }
    const lines = todayRems.map((r: any) => `• ${r.text} — ${formatInTz(r.triggerAt, user.timezone)}`);
    await ctx.reply(`📋 *Tus recordatorios de hoy*\n\n${lines.join("\n")}`, { parse_mode: "Markdown" });
    return;
  }

  if (intent.action === "list_all") {
    const reminders = await listReminders(BigInt(from.id), false);
    if (reminders.length === 0) {
      await ctx.reply("📭 No tienes recordatorios pendientes.");
      return;
    }
    const lines = reminders.map((r: any) => `• ${r.text} — ${formatInTz(r.triggerAt, user.timezone)}`);
    await ctx.reply(`📋 *Tus recordatorios*\n\n${lines.join("\n")}`, { parse_mode: "Markdown" });
    return;
  }

  if (intent.action === "delete") {
    await ctx.reply("Para eliminar, usa /eliminar <id> o dime el texto exacto.");
    return;
  }

  await ctx.reply(intent.reply || "No entendí. Prueba: 'recuérdame mañana a las 3 comprar leche' o 'qué tengo hoy'.");
}

// Callbacks de confirmación
bot.action("confirm_create", async (ctx: any) => {
  const from = ctx.from;
  if (!from) return;
  const pending = pendingIntent.get(from.id);
  if (!pending) {
    await ctx.answerCbQuery("No hay nada pendiente.");
    return;
  }
  pendingIntent.delete(from.id);

  const user = await prisma.user.findUnique({ where: { id: BigInt(from.id) } });
  if (!user) return;

  const intent = pending.intent;
  const parsed = parseWhen(intent.datetime.replace("T", " "), new Date());
  if ("error" in parsed) {
    await ctx.answerCbQuery("Error en fecha");
    await ctx.editMessageText(`❌ ${parsed.error}`);
    return;
  }

  try {
    const reminder = await createReminder({
      userId: BigInt(from.id),
      text: intent.text,
      localDate: parsed.date,
      tz: user.timezone,
      recurrencePattern: intent.action === "create_recurring" ? intent.recurrence || "daily" : null,
      recurrenceEndDate: null,
      recurrenceCount: null,
    });
    await ctx.answerCbQuery("Creado ✅");
    const when = formatInTz(reminder.triggerAt, user.timezone);
    await ctx.editMessageText(
      `✅ Recordatorio creado.\n📝 ${reminder.text}\n🕒 ${when} (${user.timezone})\n🆔 ${reminder.id}`,
    );
  } catch (e) {
    logger.error(e);
    await ctx.answerCbQuery("Error");
    await ctx.editMessageText("❌ No pude crear el recordatorio.");
  }
});

bot.action("cancel_create", async (ctx: any) => {
  const from = ctx.from;
  if (from) pendingIntent.delete(from.id);
  await ctx.answerCbQuery("Cancelado");
  await ctx.editMessageText("❌ Cancelado.");
});
