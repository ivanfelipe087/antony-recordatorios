import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY || "");

export interface ParsedIntent {
  action: "create" | "create_recurring" | "list_today" | "list_all" | "delete" | "unknown";
  text?: string;
  datetime?: string; // ISO 8601 local sin tz, ej "2026-10-25T15:30"
  recurrence?: string; // daily, weekly, monthly, weekly:mon,wed, monthly:15
  deleteId?: string;
  reply?: string; // respuesta conversacional si action=unknown
}

const SYSTEM_PROMPT = `Eres el asistente de recordatorios "Antony". El usuario te envía un audio transcrito o texto en español.
Debes interpretar la intención y devolver SOLO un JSON válido (sin markdown, sin texto extra) con esta estructura:

{
  "action": "create" | "create_recurring" | "list_today" | "list_all" | "delete" | "unknown",
  "text": "texto del recordatorio (solo si action create/create_recurring)",
  "datetime": "YYYY-MM-DDTHH:MM (hora local del usuario, solo si create/create_recurring)",
  "recurrence": "daily|weekly|monthly|weekly:mon,wed|monthly:15 (solo si create_recurring)",
  "deleteId": "id del recordatorio (solo si delete)",
  "reply": "respuesta conversacional breve si action unknown o para confirmar"
}

Reglas:
- "recuérdame mañana a las 3 comprar leche" => create, datetime mañana 15:00, text "comprar leche".
- "envíame mis tareas todos los días a las 8" => create_recurring, recurrence daily, datetime hoy/mañana 08:00, text "mis tareas".
- "qué tengo hoy" / "mis recordatorios de hoy" => list_today.
- "muéstrame todos" => list_all.
- "borra el recordatorio X" => delete.
- Si no entiendes, action unknown con reply explicando.
- La hora actual del usuario se te proporciona. Usa la fecha de hoy para "mañana".
- Devuelve ÚNICAMENTE el JSON, nada más.`;

export async function parseIntentFromText(userText: string, nowIso: string, tz: string): Promise<ParsedIntent> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `${SYSTEM_PROMPT}\n\nHora actual del usuario (${tz}): ${nowIso}\n\nMensaje del usuario: "${userText}"`;
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    // Limpiar posibles backticks
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as ParsedIntent;
    return parsed;
  } catch (e) {
    logger.error(e, "error parseando intención con Gemini");
    return { action: "unknown", reply: "No pude entender el audio. Intenta de nuevo." };
  }
}

export async function transcribeAndParseAudio(
  audioBuffer: Buffer,
  mimeType: string,
  nowIso: string,
  tz: string,
): Promise<ParsedIntent & { transcript?: string }> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const base64 = audioBuffer.toString("base64");
    const prompt = `${SYSTEM_PROMPT}\n\nHora actual del usuario (${tz}): ${nowIso}\n\nTranscribe el audio y luego interpreta la intención. Devuelve el JSON con un campo extra "transcript" con la transcripción literal.`;
    const result = await model.generateContent([
      { inlineData: { data: base64, mimeType } },
      { text: prompt },
    ]);
    const raw = result.response.text().trim();
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as ParsedIntent & { transcript?: string };
    return parsed;
  } catch (e) {
    logger.error(e, "error procesando audio con Gemini");
    return { action: "unknown", reply: "No pude procesar el audio. Intenta de nuevo o escribe el comando." };
  }
}
