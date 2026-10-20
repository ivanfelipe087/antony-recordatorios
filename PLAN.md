# Plan de Desarrollo — Antony Recordatorios (Bot de Telegram)

## 1. Resumen del Proyecto

**Nombre:** Antony Recordatorios
**Tipo:** Bot de Telegram (Node.js + Telegraf)
**Objetivo:** Permitir a los usuarios crear, gestionar y recibir recordatorios programados, con soporte para recurrencia, adjuntos, zonas horarias y notificaciones interactivas.
**Despliegue:** Servidor propio / VPS con PostgreSQL.

### Stack tecnológico
| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js 20 LTS + TypeScript |
| Framework bot | Telegraf 4.x |
| Base de datos | PostgreSQL 16 (Prisma ORM) |
| Cola de envíos | BullMQ + Redis (para jobs programados) |
| Scheduler | node-cron / BullMQ delayed jobs |
| Validación | Zod |
| Logging | Pino |
| Testing | Vitest + Supertest (webhook) |
| Contenedores | Docker + docker-compose |
| CI/CD | GitHub Actions |
| Despliegue | VPS (systemd + nginx reverse proxy + Let's Encrypt) |

---

## 2. Arquitectura

```
┌────────────────────┐
│   Telegram API     │
└─────────┬──────────┘
          │ webhook (HTTPS)
┌─────────▼──────────┐
│  Nginx (TLS)       │
└─────────┬──────────┘
          │
┌─────────▼──────────┐     ┌──────────────┐
│  Bot (Telegraf)    │────▶│  PostgreSQL  │
│  Node.js process   │     │  (Prisma)    │
└─────────┬──────────┘     └──────────────┘
          │
┌─────────▼──────────┐
│  Redis + BullMQ    │  (cola de envíos programados)
└────────────────────┘
```

### Componentes
1. **Bot core** — manejo de comandos, conversaciones (scenes/wizard), middlewares.
2. **Servicio de recordatorios** — CRUD, validación, programación.
3. **Scheduler/Worker** — proceso separado que consume la cola y envía mensajes a la hora exacta.
4. **Persistencia** — Prisma + PostgreSQL con migraciones versionadas.
5. **Observabilidad** — logs estructurados, health check endpoint.

---

## 3. Modelo de Datos (Prisma)

```prisma
model User {
  id            BigInt    @id  // telegram user id
  username      String?
  firstName     String?
  lastName      String?
  languageCode  String    @default("es")
  timezone      String    @default("America/Mexico_City")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  reminders     Reminder[]
}

model Reminder {
  id            String    @id @default(cuid())
  userId        BigInt
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  text          String
  // Momento de disparo (UTC)
  triggerAt     DateTime
  // Recurrencia (cron-like o enum)
  recurrence    Recurrence? @relation(fields: [recurrenceId], references: [id])
  recurrenceId  String?
  // Adjunto opcional
  attachmentType AttachmentType?  // photo, document, location, contact, voice
  attachmentFileId String?
  attachmentCaption String?
  // Estado
  status        ReminderStatus @default(PENDING) // PENDING, SENT, SNOOZED, DONE, CANCELLED
  snoozedUntil  DateTime?
  // Job en cola
  jobId         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([userId, status])
  @@index([triggerAt, status])
}

model Recurrence {
  id        String   @id @default(cuid())
  pattern   String   // "daily", "weekly:mon,wed", "monthly:15", cron expr
  endDate   DateTime?
  count     Int?     // número de repeticiones restantes
  reminders Reminder[]
}

enum ReminderStatus { PENDING SENT SNOOZED DONE CANCELLED }
enum AttachmentType { PHOTO DOCUMENT LOCATION CONTACT VOICE STICKER }
```

---

## 4. Comandos del Bot

| Comando | Descripción |
|---------|-------------|
| `/start` | Bienvenida + registro de usuario + selección de zona horaria |
| `/help` | Lista de comandos y ejemplos |
| `/recordar <fecha> <hora> <texto>` | Crear recordatorio (ej: `/recordar 2026-10-22 15:30 Comprar leche`) |
| `/recordar` (sin args) | Wizard interactivo paso a paso |
| `/lista` | Listar recordatorios pendientes (paginado) |
| `/lista todo` | Listar todos (incluye enviados/hechos) |
| `/eliminar <id>` | Eliminar un recordatorio |
| `/editar <id>` | Editar texto/fecha de un recordatorio |
| `/zona <tz>` | Cambiar zona horaria (ej: `/zona America/Bogota`) |
| `/repetir <id> <patrón>` | Convertir en recurrente |
| `/cancelar` | Cancelar la operación en curso (wizard) |
| `/config` | Preferencias del usuario |

### Wizard interactivo (conversación)
1. Bot: "¿Qué quieres que te recuerde?"
2. Usuario escribe texto (o envía adjunto).
3. Bot: "¿Cuándo? (fecha YYYY-MM-DD o 'mañana', 'en 2h')"
4. Bot: "¿A qué hora? (HH:MM)"
5. Bot: "¿Repetir? (no / diario / semanal / mensual / cron)"
6. Bot confirma con botones [Guardar] [Cancelar].

---

## 5. Notificaciones y Botones Inline

Cuando se dispara un recordatorio, el bot envía un mensaje con botones inline:
- ✅ **Hecho** → marca como DONE, cancela jobs futuros si recurrente.
- ⏰ **Posponer 10 min / 1h / mañana** → reprograma.
- 🔕 **Silenciar recurrencia** → cancela la serie.
- 🗑 **Eliminar** → borra el recordatorio.

---

## 6. Fases de Desarrollo

### Fase 0 — Setup del proyecto (Día 1) ✅ COMPLETADA
- [ ] Inicializar repo (git init), `.gitignore`, README.
- [ ] `npm init`, TypeScript, ESLint, Prettier, Husky.
- [ ] Estructura de carpetas:
  ```
  src/
    bot/            # handlers, middlewares, scenes
    services/       # reminderService, userService, schedulerService
    db/             # prisma client, repositories
    queue/          # bullmq producer/consumer
    utils/          # date parsing, tz helpers
    config/         # env validation (zod)
    index.ts        # entrypoint
  prisma/
    schema.prisma
    migrations/
  tests/
  docker/
  ```
- [ ] Variables de entorno (`.env.example`): `BOT_TOKEN`, `DATABASE_URL`, `REDIS_URL`, `WEBHOOK_URL`, `PORT`, `NODE_ENV`, `LOG_LEVEL`.
- [ ] Docker compose para Postgres + Redis (dev).

### Fase 1 — Core del bot (Días 2-3)
- [ ] Configurar Telegraf con webhook o polling (polling en dev, webhook en prod).
- [ ] Middleware de logging, manejo de errores global, rate limiting.
- [ ] Comando `/start` con upsert de usuario.
- [ ] Comando `/help`.
- [ ] Validación de env con Zod al arrancar.

### Fase 2 — Persistencia (Día 3)
- [ ] Instalar Prisma, definir schema, primera migración.
- [ ] Repositorios: `UserRepository`, `ReminderRepository`.
- [ ] Tests de integración con Postgres (testcontainers o DB de test).

### Fase 3 — Creación de recordatorios (Días 4-5)
- [ ] Parser de fecha/hora (`/recordar 2026-10-22 15:30 texto`).
- [ ] Soporte de expresiones relativas: "mañana", "en 2h", "en 30m", "pasado mañana 9:00".
- [ ] Wizard interactivo (Telegraf scenes) para creación paso a paso.
- [ ] Soporte de adjuntos (forward de foto/documento/ubicación al crear).
- [ ] Validación de zona horaria y conversión a UTC.

### Fase 4 — Scheduler y envío (Días 6-7)
- [ ] Configurar BullMQ con Redis.
- [ ] Al crear recordatorio → encolar job delayed con `delay = triggerAt - now`.
- [ ] Worker que consume la cola y envía el mensaje al usuario.
- [ ] Reintentos con backoff en caso de fallo de Telegram API.
- [ ] Al eliminar/editar/snooze → cancelar/reprogramar job (`jobId`).
- [ ] Manejo de recordatorios perdidos al reiniciar (rescan de PENDING con triggerAt <= now + margen).

### Fase 5 — Recurrencia (Día 8)
- [ ] Modelo `Recurrence` y patrones: daily, weekly (días), monthly (día del mes), cron.
- [ ] Al disparar un recurrente → crear el siguiente occurrence y encolar.
- [ ] Comando `/repetir` y botón "Silenciar recurrencia".
- [ ] Límite de repeticiones (`count`) y fecha fin (`endDate`).

### Fase 6 — Gestión: lista, editar, eliminar (Día 9)
- [ ] `/lista` con paginación inline (botones ◀ ▶).
- [ ] `/eliminar <id>` y botón 🗑.
- [ ] `/editar <id>` con wizard de edición.
- [ ] `/config` para tz e idioma.

### Fase 7 — Notificaciones interactivas (Día 10)
- [ ] Botones inline en el mensaje de recordatorio.
- [ ] Callback handlers: done, snooze (10m/1h/mañana), delete, silence.
- [ ] Actualizar mensaje original (editar texto con ✅ Hecho).

### Fase 8 — Zonas horarias (Día 10)
- [ ] Detección automática por `language_code`? No, pedir al usuario.
- [ ] `/zona` con validación (lista de tz válidas de `Intl`).
- [ ] Conversión correcta al programar jobs (siempre UTC interno).

### Fase 9 — Robustez y observabilidad (Día 11)
- [ ] Health check HTTP endpoint (`/health`) para monitoring.
- [ ] Graceful shutdown (SIGTERM → cerrar bot, worker, prisma).
- [ ] Reintentos y dead-letter queue para jobs fallidos.
- [ ] Métricas básicas (recordatorios creados/enviados/fallidos) — opcional Prometheus.

### Fase 10 — Testing (Días 12-13)
- [ ] Unit tests: parser de fechas, tz helpers, servicios.
- [ ] Integration tests: repositorios con Postgres de test.
- [ ] E2E tests: flujo completo con Telegraf test utilities / mock.
- [ ] Coverage ≥ 80% en services.

### Fase 11 — Dockerización y despliegue (Días 14-15)
- [ ] Dockerfile multi-stage (build TS → runtime node:20-alpine).
- [ ] docker-compose.prod.yml (bot + worker + postgres + redis + nginx).
- [ ] Configurar webhook con certificado (Let's Encrypt vía nginx).
- [ ] systemd unit como alternativa.
- [ ] GitHub Actions: lint + test + build + push image a GHCR.
- [ ] Documentación de despliegue en README.

### Fase 12 — Pulido y lanzamiento (Día 16)
- [ ] Rate limiting por usuario (evitar spam).
- [ ] Mensajes de error amigables.
- [ ] `/stats` para el admin (número de usuarios, recordatorios).
- [ ] Backup de Postgres (cron pg_dump).
- [ ] Monitoreo (Uptime Kuma o similar).

---

## 7. Estructura de Carpetas Final

```
antony-recordatorios/
├── .env.example
├── .gitignore
├── README.md
├── package.json
├── tsconfig.json
├── eslint.config.js
├── docker-compose.yml          # dev
├── docker-compose.prod.yml     # prod
├── Dockerfile
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── index.ts
│   ├── config/
│   │   └── env.ts              # zod validation
│   ├── bot/
│   │   ├── bot.ts              # Telegraf instance
│   │   ├── middlewares/
│   │   │   ├── logger.ts
│   │   │   ├── errorHandler.ts
│   │   │   └── rateLimit.ts
│   │   ├── commands/
│   │   │   ├── start.ts
│   │   │   ├── help.ts
│   │   │   ├── recordar.ts
│   │   │   ├── lista.ts
│   │   │   ├── eliminar.ts
│   │   │   ├── editar.ts
│   │   │   ├── zona.ts
│   │   │   ├── repetir.ts
│   │   │   └── config.ts
│   │   ├── scenes/
│   │   │   ├── createReminder.scene.ts
│   │   │   └── editReminder.scene.ts
│   │   └── callbacks/
│   │       └── reminderActions.ts
│   ├── services/
│   │   ├── userService.ts
│   │   ├── reminderService.ts
│   │   ├── recurrenceService.ts
│   │   └── schedulerService.ts
│   ├── db/
│   │   ├── prisma.ts
│   │   └── repositories/
│   │       ├── userRepository.ts
│   │       └── reminderRepository.ts
│   ├── queue/
│   │   ├── producer.ts
│   │   ├── consumer.ts         # worker entrypoint
│   │   └── jobs.ts
│   ├── utils/
│   │   ├── dateParser.ts
│   │   ├── tz.ts
│   │   └── format.ts
│   └── server/
│       └── health.ts           # express/fastify health endpoint
├── tests/
│   ├── unit/
│   └── integration/
└── .github/
    └── workflows/
        └── ci.yml
```

---

## 8. Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Pérdida de jobs al reiniciar | Rescan de PENDING al arrancar; jobs idempotentes. |
| Duplicado de envío (job reintentado) | Marcar SENT antes de enviar; verificar estado en worker. |
| Zona horaria mal configurada | Validación estricta con `Intl.supportedValuesOf('timeZone')`. |
| Rate limit de Telegram | Cola con concurrency limitada y backoff. |
| Mensajes con texto muy largo | Truncar / dividir en chunks. |
| Adjuntos expirados (file_id) | Reenviar desde file_id guardado; Telegram los mantiene. |

---

## 9. Métricas de Éxito (MVP)

- Crear un recordatorio en < 3 interacciones.
- Disparo con precisión ≤ 60s de la hora programada.
- 0 recordatorios perdidos tras reinicio.
- Cobertura de tests ≥ 80% en services.
- Despliegue reproducible con `docker compose up`.

---

## 10. Próximos Pasos Inmediatos

1. Confirmar el plan y el nombre del repo.
2. Crear el proyecto base (Fase 0).
3. Obtener el BOT_TOKEN de @BotFather.
4. Provisionar VPS + Postgres + Redis (o docker compose).
5. Empezar Fase 1.

---

## Anexo A — Ejemplo de uso

```
Usuario: /start
Bot: ¡Hola! Soy Antony Recordatorios. 📌
     Configura tu zona horaria: /zona America/Mexico_City

Usuario: /recordar 2026-10-22 15:30 Comprar leche y pan
Bot: ✅ Recordatorio creado.
     📝 Comprar leche y pan
     🕒 22/10/2026 15:30 (America/Mexico_City)
     ID: clx123abc

--- a las 15:30 ---
Bot: 🔔 Recordatorio: Comprar leche y pan
     [✅ Hecho] [⏰ +10min] [⏰ +1h] [🗑 Eliminar]
```

## Anexo B — Variables de entorno

```env
NODE_ENV=production
BOT_TOKEN=123456:ABC-DEF...
DATABASE_URL=postgresql://user:pass@localhost:5432/antony_recordatorios
REDIS_URL=redis://localhost:6379
WEBHOOK_URL=https://tu-dominio.com
PORT=3000
LOG_LEVEL=info
ADMIN_USER_IDS=123456789
```
