# Antony Recordatorios — Bot de Telegram

Bot de Telegram para crear, gestionar y recibir recordatorios programados, con soporte para recurrencia, adjuntos, zonas horarias y notificaciones interactivas (botones inline).

## Stack
- Node.js 20 + TypeScript
- Telegraf 4
- Prisma + PostgreSQL
- Pino (logging)

## Requisitos
- Node.js 20+
- PostgreSQL 16 (o Docker)
- Un bot token de [@BotFather](https://t.me/BotFather)

## Setup rápido (desarrollo)

```bash
# 1. Clonar e instalar
npm install

# 2. Variables de entorno
cp .env.example .env
# edita .env y pon tu BOT_TOKEN

# 3. Levantar Postgres + Redis (opcional en dev)
docker compose up -d

# 4. Migraciones
npx prisma migrate dev

# 5. Generar cliente Prisma
npx prisma generate

# 6. Arrancar en modo dev (polling)
npm run dev
```

El bot arrancará en modo polling. Abre Telegram y envía `/start`.

## Comandos disponibles

| Comando | Descripción |
|---------|-------------|
| `/start` | Bienvenida y registro |
| `/help` | Ayuda completa |
| `/recordar <fecha> <hora> <texto>` | Crear recordatorio |
| `/lista` | Ver pendientes |
| `/lista todo` | Ver todos |
| `/eliminar <id>` | Eliminar |
| `/zona <tz>` | Cambiar zona horaria |
| `/repetir <id> <patrón>` | Hacer recurrente |
| `/config` | Ver configuración |

### Ejemplos
```
/recordar 2026-10-22 15:30 Comprar leche y pan
/recordar mañana 09:00 Llamar al doctor
/recordar en 2h Tomar medicina
/zona America/Bogota
```

## Despliegue (producción)

```bash
# 1. Configurar .env con WEBHOOK_URL y NODE_ENV=production
# 2. Levantar
docker compose -f docker-compose.prod.yml up -d --build
```

El contenedor ejecuta las migraciones automáticamente al arrancar.

## Estructura
```
src/
  bot/         # handlers, comandos, callbacks
  services/    # lógica de negocio
  db/          # Prisma client
  utils/       # dateParser, tz, logger
  config/      # validación de env
  index.ts     # entrypoint
```

## Tests
```bash
npm test
npm run test:coverage
```

## Licencia
MIT
