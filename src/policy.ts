import type { Ticket, TicketMessage } from "./gorgias/types.ts";

/**
 * SUPER conservative starter policy:
 * - Only act on OPEN tickets
 * - Only act on latest INCOMING public customer message (from_agent=false, public=true)
 * - Never send externally here (we post internal notes only in Step 6)
 */
export function pickLatestCustomerMessage(ticket: Ticket): TicketMessage | null {
  const incoming = (ticket.messages ?? []).filter((m) => m.public === true && m.from_agent === false);
  if (!incoming.length) return null;

  // Prefer created_datetime, fallback to id
  incoming.sort((a, b) => {
    const ad = a.created_datetime ? Date.parse(a.created_datetime) : NaN;
    const bd = b.created_datetime ? Date.parse(b.created_datetime) : NaN;
    if (Number.isFinite(ad) && Number.isFinite(bd)) return bd - ad;
    return (b.id ?? 0) - (a.id ?? 0);
  });

  return incoming[0] ?? null;
}

export function draftReplyBaseline(input: {
  ticket: Ticket;
  messageText: string;
}) {
  // This is intentionally “safe + boring” for the harness.
  // Next steps will swap this with your multi-model router + RAG, etc.
  const subject = input.ticket.subject ? `Re: ${input.ticket.subject}` : `Re: your request`;
  const body =
    `Thanks for reaching out — I’m on it.\n\n` +
    `To help you fastest, please reply with:\n` +
    `1) Your order number (if applicable)\n` +
    `2) A quick description of what you want to happen next (refund, replacement, status update)\n\n` +
    `Once I have that, I can take the next step right away.`;

  return { subject, body };
}
