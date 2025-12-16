import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  WEBHOOK_SECRET: z.string().min(8),

  REDIS_URL: z.string().url(),

  GORGIAS_DOMAIN: z.string().min(1),
  GORGIAS_EMAIL: z.string().email(),
  GORGIAS_API_KEY: z.string().min(10),
  GORGIAS_SENDER_EMAIL: z.string().email(),

  DRY_RUN: z
    .string()
    .default("true")
    .transform((v) => v.toLowerCase() === "true")
});

export const config = schema.parse(process.env);
