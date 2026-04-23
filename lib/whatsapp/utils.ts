import type { Message } from "chat";
import type { BotThreadState, ConversationStatus } from "@/types";

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatCurrency(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valueInCents / 100);
}

export function parseWhatsAppPhone(threadId: string) {
  const [, , ...rest] = threadId.split(":");
  return rest.join(":") || threadId;
}

export function normalizeConversationStatus(value: string): ConversationStatus {
  if (value === "human_requested" || value === "closed") {
    return value;
  }

  return "bot";
}

export function normalizeThreadState(
  state: BotThreadState | null,
  status: ConversationStatus,
): BotThreadState {
  return {
    awaiting: state?.awaiting ?? null,
    lastProductSlug: state?.lastProductSlug ?? null,
    mode: status === "human_requested" ? "human_requested" : "bot",
  };
}

export function serializeMessageText(message: Message) {
  const text = message.text.trim();
  if (text) {
    return text;
  }

  if (message.attachments.length === 0) {
    return "[mensagem sem texto]";
  }

  return message.attachments
    .map((attachment) =>
      attachment.name
        ? `[${attachment.type}: ${attachment.name}]`
        : `[${attachment.type}]`,
    )
    .join(" ");
}
