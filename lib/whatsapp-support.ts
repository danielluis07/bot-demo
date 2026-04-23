import type { Message, Thread } from "chat";
import { BOT_STATE_DEFAULT, HELP_MESSAGE } from "@/lib/whatsapp/constants";
import {
  isAvailabilityRequest,
  isCatalogRequest,
  isCheapestRequest,
  isGreeting,
  isHelpRequest,
  isHumanHandoffRequest,
  isOrderRequest,
  isPriceRequest,
  isResumeBotRequest,
  isStopRequest,
  isThanks,
} from "@/lib/whatsapp/intents";
import {
  ensureConversationContext,
  getAllProducts,
  persistIncomingMessage,
  persistOutgoingMessage,
  updateConversationStatus,
} from "@/lib/whatsapp/repository";
import {
  buildCatalogReply,
  buildCheapestReply,
  resolveProductIntentReply,
} from "@/lib/whatsapp/products";
import {
  normalizeConversationStatus,
  normalizeText,
  normalizeThreadState,
} from "@/lib/whatsapp/utils";
import type {
  BotThreadState,
  ConversationContext,
  ConversationStatus,
  ReplyPlan,
} from "@/types";

function buildAttachmentReply(message: Message) {
  const attachmentTypes = new Set(message.attachments.map((item) => item.type));

  if (attachmentTypes.has("audio")) {
    return "Ainda nao consigo transcrever audio neste prototipo. Me mande sua pergunta em texto que eu continuo por aqui.";
  }

  if (attachmentTypes.has("image") || attachmentTypes.has("file")) {
    return "Recebi o anexo, mas neste prototipo eu respondo melhor quando voce descreve a duvida em texto.";
  }

  if (attachmentTypes.has("video")) {
    return "Recebi o video, mas neste prototipo eu so processo mensagens em texto.";
  }

  return "Recebi sua mensagem, mas preciso que voce escreva a pergunta em texto para eu consultar o banco.";
}

async function buildReplyPlan(
  message: Message,
  state: BotThreadState,
  status: ConversationStatus,
): Promise<ReplyPlan> {
  const rawText = message.text.trim();
  const normalizedText = normalizeText(rawText);

  if (!rawText && message.attachments.length > 0) {
    return {
      state,
      text: buildAttachmentReply(message),
    } satisfies ReplyPlan;
  }

  if (!rawText) {
    return {
      state,
      text: "Nao consegui identificar sua pergunta. Pode me mandar de novo em texto?",
    } satisfies ReplyPlan;
  }

  if (status === "human_requested") {
    if (isResumeBotRequest(normalizedText)) {
      return {
        state: BOT_STATE_DEFAULT,
        status: "bot",
        text: "Perfeito, voltei para o atendimento automatico. Pode me perguntar sobre produtos, preco ou estoque.",
      } satisfies ReplyPlan;
    }

    return {
      state: {
        ...state,
        awaiting: null,
        mode: "human_requested",
      },
      text: "Seu atendimento humano ja foi solicitado. Para voltar ao bot, escreva 'voltar para o bot'.",
    } satisfies ReplyPlan;
  }

  if (isHumanHandoffRequest(normalizedText)) {
    return {
      state: {
        awaiting: null,
        lastProductSlug: state.lastProductSlug,
        mode: "human_requested",
      },
      status: "human_requested",
      text: "Tudo certo. Vou registrar seu pedido de atendimento humano. Para voltar ao bot depois, escreva 'voltar para o bot'.",
      unsubscribe: true,
    } satisfies ReplyPlan;
  }

  if (isStopRequest(normalizedText)) {
    return {
      state: BOT_STATE_DEFAULT,
      status: "closed",
      text: "Conversa encerrada. Quando quiser retomar, e so mandar 'oi'.",
      unsubscribe: true,
    } satisfies ReplyPlan;
  }

  if (isHelpRequest(normalizedText)) {
    return {
      state: BOT_STATE_DEFAULT,
      text: HELP_MESSAGE,
    } satisfies ReplyPlan;
  }

  if (isCatalogRequest(normalizedText)) {
    return buildCatalogReply(await getAllProducts());
  }

  if (isCheapestRequest(normalizedText)) {
    return buildCheapestReply(await getAllProducts());
  }

  if (isOrderRequest(normalizedText)) {
    return {
      state: BOT_STATE_DEFAULT,
      text: "Neste prototipo eu consulto catalogo, preco e estoque. Para pedido, entrega ou rastreio, escreva 'atendente' que eu encaminho.",
    } satisfies ReplyPlan;
  }

  if (state.awaiting) {
    return resolveProductIntentReply(state.awaiting, rawText, state);
  }

  if (isPriceRequest(normalizedText)) {
    return resolveProductIntentReply("price", rawText, state);
  }

  if (isAvailabilityRequest(normalizedText)) {
    return resolveProductIntentReply("availability", rawText, state);
  }

  const directProductReply = await resolveProductIntentReply(
    "details",
    rawText,
    {
      ...state,
      lastProductSlug: null,
    },
  );
  if (directProductReply.state.lastProductSlug) {
    return directProductReply;
  }

  if (isThanks(normalizedText)) {
    return {
      state,
      text: "Por nada. Se precisar, posso continuar consultando o catalogo para voce.",
    } satisfies ReplyPlan;
  }

  if (isGreeting(normalizedText)) {
    return {
      state: BOT_STATE_DEFAULT,
      text: "Oi! Eu sou o assistente da loja. Posso consultar produtos, preco e estoque. Se quiser ver tudo o que eu faco, escreva 'menu'.",
    } satisfies ReplyPlan;
  }

  return {
    state,
    text: "Ainda nao entendi essa solicitacao. Neste prototipo eu ajudo com catalogo, preco, estoque e handoff humano. Escreva 'menu' para ver exemplos.",
  } satisfies ReplyPlan;
}

export async function handleWhatsAppMessage(
  thread: Thread<BotThreadState>,
  message: Message,
) {
  let conversationContext: ConversationContext | null = null;

  try {
    conversationContext = await ensureConversationContext(thread, message);
    await persistIncomingMessage(conversationContext.conversation.id, message);

    const currentStatus = normalizeConversationStatus(
      conversationContext.conversation.status,
    );
    const currentState = normalizeThreadState(
      await thread.state,
      currentStatus,
    );
    const replyPlan = await buildReplyPlan(
      message,
      currentState,
      currentStatus,
    );

    if (replyPlan.status && replyPlan.status !== currentStatus) {
      conversationContext = {
        ...conversationContext,
        conversation: await updateConversationStatus(
          conversationContext.conversation.id,
          replyPlan.status,
        ),
      };
    }

    await thread.setState(replyPlan.state, { replace: true });

    if (!replyPlan.unsubscribe && !(await thread.isSubscribed())) {
      await thread.subscribe();
    }

    const sentMessage = await thread.post(replyPlan.text);
    await persistOutgoingMessage(
      conversationContext.conversation.id,
      sentMessage,
    );

    if (replyPlan.unsubscribe && (await thread.isSubscribed())) {
      await thread.unsubscribe();
    }
  } catch (error) {
    console.error("whatsapp-bot-error", error);

    const sentMessage = await thread.post(
      "Estou com uma instabilidade agora e nao consegui concluir sua consulta. Tente novamente em instantes.",
    );

    if (conversationContext) {
      await persistOutgoingMessage(
        conversationContext.conversation.id,
        sentMessage,
      );
    }
  }
}
