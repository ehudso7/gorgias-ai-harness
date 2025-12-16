import { Worker } from "bullmq";
import { config } from "./config.ts";
import { connection } from "./queue.ts";
import { logger } from "./logger.ts";
import { GorgiasClient } from "./gorgias/client.ts";
import { pickLatestCustomerMessage, draftReplyBaseline } from "./policy.ts";

const gorgias = new GorgiasClient();

async function wasProcessed(ticketId: number, messageId: number) {
  const key = `processed:${ticketId}:${messageId}`;
  // SET NX with TTL: 7 days
  const set = await connection.set(key, "1", "NX", "EX", 7 * 24 * 60 * 60);
  return set !== "OK";
}

const worker = new Worker(
  "ticket-events",
  async (job) => {
    const { ticketId } = job.data;

    const ticket = await gorgias.getTicket(ticketId);

    if (ticket.spam) {
      logger.info({ ticketId }, "Skipping spam ticket");
      return { skipped: "spam" };
    }

    if (String(ticket.status).toLowerCase() !== "open") {
      logger.info({ ticketId, status: ticket.status }, "Skipping non-open ticket");
      return { skipped: "status" };
    }

    const latest = pickLatestCustomerMessage(ticket);
    if (!latest) {
      logger.info({ ticketId }, "No incoming customer message found");
      return { skipped: "no_incoming_message" };
    }

    // Dedupe guard
    const already = await wasProcessed(ticketId, latest.id);
    if (already) {
      logger.info({ ticketId, messageId: latest.id }, "Duplicate event; already processed");
      return { skipped: "duplicate" };
    }

    const messageText =
      latest.stripped_text ??
      latest.body_text ??
      "(no text content found)";

    const draft = draftReplyBaseline({ ticket, messageText });

    const note =
      `AI Assist (DRY-RUN)\n` +
      `Ticket: #${ticket.id}\n` +
      `Latest customer msg id: ${latest.id}\n` +
      `---\n` +
      `Customer said:\n${messageText}\n` +
      `---\n` +
      `Proposed reply:\nSubject: ${draft.subject}\n\n${draft.body}\n`;

    // In Step 6 we ALWAYS create an internal note (never a customer-facing reply).  [oai_citation:11‡gorgias-developers](https://developers.gorgias.com/reference/create-ticket-message)
    await gorgias.createInternalNote(ticketId, note);

    logger.info({ ticketId, messageId: latest.id }, "Posted internal-note draft");
    return { ok: true };
  },
  { connection }
);

worker.on("ready", () => logger.info("Worker ready"));
worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "Job failed");
});
