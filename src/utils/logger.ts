import pino from "pino";
import { env } from "../config/env.js";

const loggerOptions: any = { level: env.LOG_LEVEL };
if (env.NODE_ENV === "development") {
  loggerOptions.transport = { target: "pino-pretty", options: { colorize: true } };
}
export const logger = pino(loggerOptions);

export default logger;
