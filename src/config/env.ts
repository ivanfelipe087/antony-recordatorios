import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN es requerido"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerido"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  WEBHOOK_URL: z.string().optional(),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.string().default("info"),
  ADMIN_USER_IDS: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [])),
  GEMINI_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Variables de entorno invalidas:");
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
export const isAdmin = (userId: number | bigint): boolean =>
  env.ADMIN_USER_IDS.includes(String(userId));
