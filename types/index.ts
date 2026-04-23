import { conversations, products } from "@/db/schema";

export type ProductRecord = typeof products.$inferSelect;
export type ConversationRecord = typeof conversations.$inferSelect;
export type ConversationStatus = "bot" | "human_requested" | "closed";
export type PendingIntent = "availability" | "details" | "price";

export interface BotThreadState {
  awaiting: PendingIntent | null;
  lastProductSlug: string | null;
  mode: "bot" | "human_requested";
}

export type ConversationContext = {
  conversation: ConversationRecord;
  phone: string;
};

export type ReplyPlan = {
  state: BotThreadState;
  status?: ConversationStatus;
  text: string;
  unsubscribe?: boolean;
};

export type ProductResolution =
  | { kind: "ambiguous"; options: ProductRecord[] }
  | { kind: "catalog-empty" }
  | { kind: "match"; product: ProductRecord }
  | { kind: "need-product" }
  | { kind: "not-found" };
