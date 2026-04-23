import { asc, desc, eq } from "drizzle-orm";
import type { Message, SentMessage, Thread } from "chat";
import { db } from "@/db";
import { conversations, customers, messages, products } from "@/db/schema";
import type {
  BotThreadState,
  ConversationContext,
  ConversationStatus,
} from "@/types";
import { parseWhatsAppPhone, serializeMessageText } from "./utils";

async function upsertCustomer(phone: string, name: string | null) {
  const [existingCustomer] = await db
    .select()
    .from(customers)
    .where(eq(customers.phone, phone))
    .limit(1);

  if (!existingCustomer) {
    const [createdCustomer] = await db
      .insert(customers)
      .values({
        name,
        phone,
      })
      .returning();

    return createdCustomer;
  }

  if (!existingCustomer.name && name) {
    const [updatedCustomer] = await db
      .update(customers)
      .set({ name })
      .where(eq(customers.id, existingCustomer.id))
      .returning();

    return updatedCustomer;
  }

  return existingCustomer;
}

export async function ensureConversationContext(
  thread: Thread<BotThreadState>,
  message: Message,
): Promise<ConversationContext> {
  const phone = parseWhatsAppPhone(thread.id);
  const customer = await upsertCustomer(
    phone,
    message.author.fullName || message.author.userName || null,
  );

  const [latestConversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.customerId, customer.id))
    .orderBy(desc(conversations.createdAt))
    .limit(1);

  if (!latestConversation || latestConversation.status === "closed") {
    const [createdConversation] = await db
      .insert(conversations)
      .values({
        channel: "whatsapp",
        customerId: customer.id,
        status: "bot",
      })
      .returning();

    return {
      conversation: createdConversation,
      phone,
    };
  }

  return {
    conversation: latestConversation,
    phone,
  };
}

export async function persistIncomingMessage(
  conversationId: string,
  message: Message,
) {
  await db.insert(messages).values({
    conversationId,
    externalId: message.id,
    fromCustomer: true,
    text: serializeMessageText(message),
  });
}

export async function persistOutgoingMessage(
  conversationId: string,
  message: SentMessage,
) {
  await db.insert(messages).values({
    conversationId,
    externalId: message.id,
    fromCustomer: false,
    text: message.text.trim() || "[resposta sem texto]",
  });
}

export async function updateConversationStatus(
  conversationId: string,
  status: ConversationStatus,
) {
  const [conversation] = await db
    .update(conversations)
    .set({ status })
    .where(eq(conversations.id, conversationId))
    .returning();

  return conversation;
}

export async function getAllProducts() {
  return db
    .select()
    .from(products)
    .orderBy(
      desc(products.available),
      desc(products.stock),
      asc(products.name),
    );
}
