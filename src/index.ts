import "dotenv/config";
import http from "node:http";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { bot } from "./bot/bot.js";
import { prisma } from "./db/prisma.js";
import { startScheduler } from "./services/schedulerService.js";
// Importar comandos (se registran al importar)
import "./bot/commands/start.js";
import "./bot/commands/help.js";
import "./bot/commands/recordar.js";
import "./bot/commands/lista.js";
import "./bot/commands/zona.js";
import "./bot/commands/repetir.js";
import "./bot/callbacks/reminderActions.js";
import "./bot/handlers/audioHandler.js";

async function main() {
  // Inicializar comandos base
  await bot.telegram.setMyCommands([
    { command: "start", description: "Iniciar y configurar zona horaria" },
    { command: "help", description: "Ayuda y ejemplos" },
    { command: "recordar", description: "Crear un recordatorio" },
    { command: "lista", description: "Ver mis recordatorios" },
    { command: "eliminar", description: "Eliminar un recordatorio" },
    { command: "zona", description: "Cambiar zona horaria" },
  ]);

  startScheduler();

  if (env.NODE_ENV === "production" && env.WEBHOOK_URL) {
    const webhookPath = `/webhook/${env.BOT_TOKEN}`;
    await bot.telegram.setWebhook(`${env.WEBHOOK_URL}${webhookPath}`);
    const server = http.createServer((req, res) => {
      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }
      if (req.url === webhookPath && req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const update = JSON.parse(body);
            bot.handleUpdate(update).catch((e) => logger.error(e));
          } catch (e) {
            logger.error(e);
          }
          res.writeHead(200);
          res.end();
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(env.PORT, () => {
      logger.info({ port: env.PORT }, "servidor webhook iniciado");
    });
  } else {
    // Polling en desarrollo
    await bot.launch();
    logger.info("bot iniciado en modo polling");

    // Health check simple en dev
    const server = http.createServer((req, res) => {
      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(env.PORT, () => {
      logger.info({ port: env.PORT }, "health server iniciado");
    });
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "apagando...");
    bot.stop(signal);
    await prisma.$disconnect();
    process.exit(0);
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((e) => {
  logger.error(e);
  process.exit(1);
});
