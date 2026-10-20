import { bot } from "../bot.js";
import { prisma } from "../../db/prisma.js";
import { logger } from "../../utils/logger.js";
import { parseWhen } from "../../utils/dateParser.js";
import { formatInTz } from "../../utils/tz.js";
import { createReminder } from "../../services/reminderService.js";
import { isAdmin } from "../../config/env.js";

bot.command("recordar", async (ctx: any) => {
  const from = ctx.from;
  if (!from) return;

  const user = await prisma.user.findUnique({ where: { id: BigInt(from.id) } });
  if (!user) {
    await ctx.reply("Primero usa /start para registrarte.");
    return;
  }

  const args = ctx.message.text.replace(/^\/recordar\s*/i, "").trim();
  if (!args) {
    await ctx.reply(
      "Uso: /recordar <fecha> <hora> <texto>\n" +
        "Ejemplos:\n" +
        "/recordar 2026-10-22 15:30 Comprar leche\n" +
        "/recordar mañana 09:00 Llamar al doctor\n" +
        "/recordar en 2h Tomar medicina\n\n" +
        "También puedes enviar una foto/documento con el comando en el caption.",
    );
    return;
  }

  // Parsear: fecha/hora al inicio, resto es texto
  // Intentar patrones: "YYYY-MM-DD HH:MM texto" | "mañana HH:MM texto" | "en 2h texto"
  let whenStr = "";
  let text = "";
  const tokens = args.split(/\s+/);

  // Caso "en Xh texto"
  if (tokens[0]?.toLowerCase() === "en" && tokens[1] && /^\d+[mhd]$/.test(tokens[1].toLowerCase())) {
    whenStr = `${tokens[0]} ${tokens[1]}`;
    text = tokens.slice(2).join(" ");
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(tokens[0] ?? "")) {
    // fecha absoluta
    whenStr = `${tokens[0]} ${tokens[1] ?? ""}`;
    text = tokens.slice(2).join(" ");
  } else {
    // mañana / pasado mañana
    whenStr = `${tokens[0]} ${tokens[1] ?? ""}`;
    text = tokens.slice(2).join(" ");
  }

  if (!text.trim()) {
    await ctx.reply("❌ Falta el texto del recordatorio.");
    return;
  }

  const parsed = parseWhen(whenStr, new Date());
  if ("error" in parsed) {
    await ctx.reply(`❌ ${parsed.error}`);
    return;
  }

  // Adjunto si el mensaje es respuesta a media o tiene photo/document
  let attachmentType: string | null = null;
  let attachmentFileId: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msg: any = ctx.message;
  if (msg.photo?.length) {
    attachmentType = "PHOTO";
    attachmentFileId = msg.photo[msg.photo.length - 1].file_id;
  } else if (msg.document) {
    attachmentType = "DOCUMENT";
    attachmentFileId = msg.document.file_id;
  } else if (msg.voice) {
    attachmentType = "VOICE";
    attachmentFileId = msg.voice.file_id;
  } else if (msg.location) {
    attachmentType = "LOCATION";
  } else if (msg.contact) {
    attachmentType = "CONTACT";
  }

  try {
    const reminder = await createReminder({
      userId: BigInt(from.id),
      text,
      localDate: parsed.date,
      tz: user.timezone,
      attachmentType,
      attachmentFileId,
      attachmentCaption: msg.caption ?? null,
    });

    const formatted = formatInTz(reminder.triggerAt, user.timezone);
    await ctx.reply(
      `✅ Recordatorio creado.\n` +
        `📝 ${reminder.text}\n` +
        `🕒 ${formatted} (${user.timezone})\n` +
        `🆔 ${reminder.id}`,
    );
  } catch (e) {
    logger.error(e);
    await ctx.reply("❌ No pude crear el recordatorio.");
  }
});
