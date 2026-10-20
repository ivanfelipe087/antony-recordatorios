import { bot } from "../bot.js";
import { prisma } from "../../db/prisma.js";
import { logger } from "../../utils/logger.js";

bot.command("start", async (ctx: any) => {
  const from = ctx.from;
  if (!from) return;

  try {
    await prisma.user.upsert({
      where: { id: BigInt(from.id) },
      update: {
        username: from.username ?? null,
        firstName: from.first_name ?? null,
        lastName: from.last_name ?? null,
        languageCode: from.language_code ?? "es",
      },
      create: {
        id: BigInt(from.id),
        username: from.username ?? null,
        firstName: from.first_name ?? null,
        lastName: from.last_name ?? null,
        languageCode: from.language_code ?? "es",
        timezone: "America/Mexico_City",
      },
    });

    await ctx.reply(
      `¡Hola ${from.first_name ?? "amigo"}! 👋\n\n` +
        `Soy *Antony Recordatorios*, tu asistente para no olvidar nada.\n\n` +
        `📌 Comandos principales:\n` +
        `/recordar <fecha> <hora> <texto> — crear recordatorio\n` +
        `/lista — ver mis recordatorios\n` +
        `/eliminar <id> — eliminar\n` +
        `/zona <zona> — cambiar zona horaria\n` +
        `/help — ayuda completa\n\n` +
        `Tu zona horaria actual: America/Mexico_City\n` +
        `Cámbiala con /zona America/Bogota (u otra).`,
      { parse_mode: "Markdown" },
    );
  } catch (e) {
    logger.error(e);
    await ctx.reply("❌ No pude registrarte. Intenta de nuevo.");
  }
});
