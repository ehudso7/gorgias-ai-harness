import axios, { AxiosError, AxiosInstance } from "axios";
import { config } from "../config.ts";
import { logger } from "../logger.ts";
import type { Ticket } from "./types.ts";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class GorgiasClient {
  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: `https://${config.GORGIAS_DOMAIN}.gorgias.com/api`,
      auth: {
        username: config.GORGIAS_EMAIL,
        password: config.GORGIAS_API_KEY
      },
      timeout: 30_000,
      // axios follows 301 for GET by default, which matters for merged tickets  [oai_citation:6‡gorgias-developers](https://developers.gorgias.com/changelog/301-redirect-when-fetching-merged-ticket?utm_source=chatgpt.com)
      maxRedirects: 5
    });
  }

  private async requestWith429Retry<T>(fn: () => Promise<T>, attempt = 1): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      const err = e as AxiosError;
      const status = err.response?.status;

      if (status === 429 && attempt <= 4) {
        const retryAfter = err.response?.headers?.["retry-after"];
        const waitSeconds = retryAfter ? Number(retryAfter) : NaN;
        const waitMs = Number.isFinite(waitSeconds) ? waitSeconds * 1000 : 2000 * attempt;

        logger.warn({ status, attempt, waitMs }, "Gorgias rate-limited (429). Retrying...");
        await sleep(waitMs);
        return this.requestWith429Retry(fn, attempt + 1);
      }

      throw e;
    }
  }

  async getTicket(ticketId: number): Promise<Ticket> {
    // Ticket contains messages array  [oai_citation:7‡gorgias-developers](https://developers.gorgias.com/reference/the-ticket-object)
    return this.requestWith429Retry(async () => {
      const res = await this.http.get<Ticket>(`/tickets/${ticketId}`);
      return res.data;
    });
  }

  async createInternalNote(ticketId: number, noteText: string, noteHtml?: string) {
    // Create message endpoint  [oai_citation:8‡gorgias-developers](https://developers.gorgias.com/reference/create-ticket-message)
    // Use channel "internal-note" so it's never sent to customer  [oai_citation:9‡gorgias-developers](https://developers.gorgias.com/reference/create-ticket-message)
    return this.requestWith429Retry(async () => {
      const payload = {
        channel: "internal-note",
        from_agent: true,
        sender: { email: config.GORGIAS_SENDER_EMAIL },
        body_text: noteText,
        body_html: noteHtml ?? `<pre>${escapeHtml(noteText)}</pre>`
      };

      const res = await this.http.post(`/tickets/${ticketId}/messages`, payload);
      return res.data;
    });
  }
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
