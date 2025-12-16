import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config.ts";

export const connection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null
});

export type TicketJob = {
  ticketId: number;
  receivedAt: string;
  raw: unknown;
};

export const ticketQueue = new Queue<TicketJob>("ticket-events", {
  connection
});
