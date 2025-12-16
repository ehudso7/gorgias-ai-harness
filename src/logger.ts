import pino from "pino";

const pretty =
  process.env.NODE_ENV !== "production"
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } }
    : undefined;

export const logger = pino(pretty as any);
