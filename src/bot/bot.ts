import { Telegraf } from "telegraf";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export const bot = new Telegraf(env.BOT_TOKEN);

// Middleware de logging
bot.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  logger.debug(
    { updateId: ctx.update.update_id, type: ctx.updateType, ms },
    "update procesado",
  );
});

// Manejo de errores global
bot.catch((err, ctx) => {
  logger.error({ err, updateId: ctx.update.update_id }, "error no manejado en bot");
  ctx.reply("❌ Ocurrió un error. Intenta de nuevo más tarde.").catch(() => {});
});

export default bot;
