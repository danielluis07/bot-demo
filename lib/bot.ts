import { Chat } from "chat";
import { createWhatsAppAdapter } from "@chat-adapter/whatsapp";
import { createPostgresState } from "@chat-adapter/state-pg";
import { handleWhatsAppMessage } from "@/lib/whatsapp-support";
import type { BotThreadState } from "@/types";

const adapters = {
  whatsapp: createWhatsAppAdapter(),
};

export const bot = new Chat<typeof adapters, BotThreadState>({
  userName: process.env.WHATSAPP_BOT_USERNAME ?? "loja-bot",
  adapters,
  state: createPostgresState(),
  concurrency: {
    strategy: "debounce",
    debounceMs: 1200,
    maxQueueSize: 20,
    queueEntryTtlMs: 120_000,
  },
  messageHistory: {
    maxMessages: 50,
    ttlMs: 1_209_600_000,
  },
});

bot.onDirectMessage(async (thread, message) => {
  await handleWhatsAppMessage(thread, message);
});

bot.onSubscribedMessage(async (thread, message) => {
  await handleWhatsAppMessage(thread, message);
});
