import { bot } from "../bot.js";

bot.command("help", async (ctx: any) => {
  await ctx.reply(
    `📖 *Ayuda — Antony Recordatorios*\n\n` +
      `*Crear recordatorio:*\n` +
      `/recordar 2026-10-22 15:30 Comprar leche\n` +
      `/recordar mañana 09:00 Llamar al doctor\n` +
      `/recordar en 2h Tomar medicina\n\n` +
      `*Gestionar:*\n` +
      `/lista — ver pendientes\n` +
      `/lista todo — ver todos\n` +
      `/eliminar <id> — eliminar\n` +
      `/editar <id> — editar\n\n` +
      `*Configuración:*\n` +
      `/zona America/Bogota — cambiar zona horaria\n` +
      `/repetir <id> diario — hacer recurrente\n\n` +
      `*Tips:*\n` +
      `• Envía una foto/documento junto al comando para adjuntarlo.\n` +
      `• Los recordatorios recurrentes se reprograman automáticamente.\n` +
      `• Usa los botones inline para posponer o marcar como hecho.`,
    { parse_mode: "Markdown" },
  );
});
