export type TicketMessage = {
  id: number;
  ticket_id: number;
  public: boolean;
  from_agent: boolean;
  subject?: string | null;
  body_text?: string | null;
  stripped_text?: string | null;
  body_html?: string | null;
  stripped_html?: string | null;
  created_datetime?: string | null;
};

export type Ticket = {
  id: number;
  status: string; // open / closed / etc
  spam: boolean;
  channel?: string | null;
  subject?: string | null;
  last_received_message_datetime?: string | null;
  last_message_datetime?: string | null;
  messages: TicketMessage[];
};
