import { bot } from "../bot.js";
import { prisma } from "../../db/prisma.js";
import { isValidTimezone } from "../../utils/tz.js";

bot.command("zona", async (ctx: any) => {
  const from = ctx.from;
  if (!from) return;
  const tz = (ctx.message.text || "").replace(/^\/zona\s*/i, "").trim();
  if (!tz) {
    await ctx.reply("Uso: /zona America/Bogota");
    return;
  }
  if (!isValidTimezone(tz)) {
    await ctx.reply("❌ Zona horaria inválida. Ej: America/Mexico_City, Europe/Madrid");
    return;
  }
  await prisma.user.update({ where: { id: BigInt(from.id) }, data: { timezone: tz } });
  await ctx.reply(`✅ Zona horaria actualizada a ${tz}.`);
});

bot.command("config", async (ctx: any) => {
  const from = ctx.from;
  if (!from) return;
  const user = await prisma.user.findUnique({ where: { id: BigInt(from.id) } });
  if (!user) {
    await ctx.reply("Primero usa /start.");
    return;
  }
  await ctx.reply(
    `⚙️ *Tu configuración*\n\n` +
      `🆔 ${user.id}\n` +
      `👤 @${user.username ?? "—"}\n` +
      `🌍 Zona: ${user.timezone}\n` +
      `🌐 Idioma: ${user.languageCode}`,
    { parse_mode: "Markdown" },
  );
});
