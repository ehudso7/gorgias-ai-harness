import express from "express";
import { z } from "zod";
import { config } from "./config.ts";
import { logger } from "./logger.ts";
import { ticketQueue } from "./queue.ts";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

/**
 * Minimal webhook contract:
 * You configure the Gorgias HTTP Integration request body to send:
 *   { "ticket_id": {{ticket.id}} }
 * (Gorgias HTTP Integrations support templating like {{ticket.customer.email}} etc.)  [oai_citation:10‡Gorgias](https://docs.gorgias.com/en-US/http-integrations-81822?utm_source=chatgpt.com)
 */
const WebhookSchema = z.object({
  ticket_id: z.number().int().positive().optional(),
  ticketId: z.number().int().positive().optional(),
  ticket: z.object({ id: z.number().int().positive() }).optional()
});

app.post("/webhooks/gorgias", async (req, res) => {
  const secret = req.header("X-Halcyon-Secret") ?? "";
  if (secret !== config.WEBHOOK_SECRET) {
    return res.status(401).json({ ok: false, error: "Invalid webhook secret" });
  }

  const parsed = WebhookSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "Invalid payload", details: parsed.error.flatten() });
  }

  const body = parsed.data;
  const ticketId = body.ticket_id ?? body.ticketId ?? body.ticket?.id;

  if (!ticketId) {
    return res.status(400).json({ ok: false, error: "Missing ticket id" });
  }

  await ticketQueue.add(
    "ticket-event",
    { ticketId, receivedAt: new Date().toISOString(), raw: req.body },
    {
      removeOnComplete: 1000,
      removeOnFail: 500
    }
  );

  res.json({ ok: true, queued: true, ticketId });
});

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, "Server listening");
});
