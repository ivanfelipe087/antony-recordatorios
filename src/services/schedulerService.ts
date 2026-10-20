import { bot } from "../bot/bot.js";
import { prisma } from "../db/prisma.js";
import { logger } from "../utils/logger.js";
import { formatInTz } from "../utils/tz.js";
import { createReminder } from "./reminderService.js";

const DAY_MS = 86_400_000;

function nextOccurrence(pattern: string, from: Date): Date | null {
  const lower = pattern.toLowerCase().trim();
  const d = new Date(from);
  if (lower === "daily" || lower === "diario") {
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (lower === "weekly" || lower === "semanal") {
    d.setDate(d.getDate() + 7);
    return d;
  }
  if (lower === "monthly" || lower === "mensual") {
    d.setMonth(d.getMonth() + 1);
    return d;
  }
  // weekly:mon,wed,fri
  const wm = lower.match(/^weekly:(.+)$/);
  if (wm) {
    const days = wm[1]!.split(",").map((x) => x.trim());
    const names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    // avanzar día a día hasta encontrar uno válido (max 7)
    for (let i = 1; i <= 7; i++) {
      const cand = new Date(from);
      cand.setDate(cand.getDate() + i);
      const name = names[cand.getDay()];
      if (name && days.includes(name)) return cand;
    }
  }
  // monthly:15
  const mm = lower.match(/^monthly:(\d{1,2})$/);
  if (mm) {
    const day = Number(mm[1]!);
    const cand = new Date(from);
    cand.setMonth(cand.getMonth() + 1);
    cand.setDate(Math.min(day, new Date(cand.getFullYear(), cand.getMonth() + 1, 0).getDate()));
    return cand;
  }
  return null;
}

async function sendReminder(reminder: any) {
  const user = reminder.user;
  const tz = user.timezone;
  const when = formatInTz(reminder.triggerAt, tz);

  const text =
    `🔔 *Recordatorio*\n\n` +
    `${reminder.text}\n\n` +
    `🕒 ${when} (${tz})`;

  const opts: any = { parse_mode: "Markdown" };

  if (reminder.attachmentType === "PHOTO" && reminder.attachmentFileId) {
    await bot.telegram.sendPhoto(user.id.toString(), reminder.attachmentFileId, { caption: text, parse_mode: "Markdown" });
  } else if (reminder.attachmentType === "DOCUMENT" && reminder.attachmentFileId) {
    await bot.telegram.sendDocument(user.id.toString(), reminder.attachmentFileId, { caption: text, parse_mode: "Markdown" });
  } else if (reminder.attachmentType === "VOICE" && reminder.attachmentFileId) {
    await bot.telegram.sendVoice(user.id.toString(), reminder.attachmentFileId, { caption: text, parse_mode: "Markdown" });
  } else {
    await bot.telegram.sendMessage(user.id.toString(), text, opts);
  }

  // Botones inline
  const keyboard = {
    inline_keyboard: [
      [
        { text: "✅ Hecho", callback_data: `done:${reminder.id}` },
        { text: "⏰ +10min", callback_data: `snooze:${reminder.id}:10` },
        { text: "⏰ +1h", callback_data: `snooze:${reminder.id}:60` },
      ],
      [
        { text: "⏰ Mañana", callback_data: `snooze:${reminder.id}:tomorrow` },
        { text: "🗑 Eliminar", callback_data: `delete:${reminder.id}` },
      ],
    ],
  };

  // Enviar botones como mensaje separado si ya se envió con caption
  if (reminder.attachmentType) {
    await bot.telegram.sendMessage(user.id.toString(), "Acciones:", { reply_markup: keyboard });
  } else {
    // Reenviar con botones? Mejor editar el último mensaje no es posible; enviamos botones aparte.
    await bot.telegram.sendMessage(user.id.toString(), "Acciones:", { reply_markup: keyboard });
  }
}

export function startScheduler() {
  const tick = async () => {
    try {
      const due = await prisma.reminder.findMany({
        where: { status: "PENDING", triggerAt: { lte: new Date() } },
        include: { user: true, recurrence: true },
      });

      for (const r of due) {
        try {
          // Marcar SENT primero (idempotencia)
          await prisma.reminder.update({ where: { id: r.id }, data: { status: "SENT" } });
          await sendReminder(r);

          // Recurrencia: crear siguiente
          if (r.recurrence) {
            const rec = r.recurrence;
            // Verificar límites
            let shouldContinue = true;
            if (rec.endDate && new Date() > rec.endDate) shouldContinue = false;
            if (rec.count !== null && rec.count <= 0) shouldContinue = false;

            if (shouldContinue) {
              const next = nextOccurrence(rec.pattern, r.triggerAt);
              if (next) {
                // mantener la misma hora del día
                next.setHours(r.triggerAt.getHours(), r.triggerAt.getMinutes(), 0, 0);
                await createReminder({
                  userId: r.userId,
                  text: r.text,
                  localDate: next,
                  tz: r.user.timezone,
                  attachmentType: r.attachmentType,
                  attachmentFileId: r.attachmentFileId,
                  attachmentCaption: r.attachmentCaption,
                  recurrencePattern: rec.pattern,
                  recurrenceEndDate: rec.endDate,
                  recurrenceCount: rec.count !== null ? rec.count - 1 : null,
                });
                // actualizar count del recurrence original? Ya se pasó count-1 al nuevo.
              }
            }
            // decrementar count en recurrence original no necesario porque el nuevo lleva count-1
          }
        } catch (e) {
          logger.error({ err: e, reminderId: r.id }, "fallo al enviar recordatorio");
          // Revertir a PENDING para reintento
          await prisma.reminder.update({ where: { id: r.id }, data: { status: "PENDING" } }).catch(() => {});
        }
      }
    } catch (e) {
      logger.error(e, "error en scheduler tick");
    }
  };

  setInterval(tick, 30_000);
  // primer tick inmediato
  tick();
  logger.info("scheduler iniciado (polling 30s)");
}
