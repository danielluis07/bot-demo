import type {
  BotThreadState,
  PendingIntent,
  ProductRecord,
  ProductResolution,
  ReplyPlan,
} from "@/types";
import { BOT_STATE_DEFAULT, PRODUCT_QUERY_NOISE } from "./constants";
import { getAllProducts } from "./repository";
import { formatCurrency, normalizeText } from "./utils";

function buildSearchQuery(rawText: string) {
  const tokens = normalizeText(rawText)
    .split(" ")
    .filter((token) => token.length > 1 && !PRODUCT_QUERY_NOISE.has(token));

  return tokens.join(" ");
}

function resolveProductStatus(product: ProductRecord) {
  if (!product.available) {
    return "❌ Indisponível no momento.";
  }

  if (product.stock <= 0) {
    return "⚠️ Disponível no cadastro, mas com estoque zerado agora.";
  }

  return `✅ Disponível com ${product.stock} unidade(s) em estoque.`;
}

function resolveProductSearch(
  catalog: ProductRecord[],
  rawText: string,
  lastProductSlug: string | null,
): ProductResolution {
  if (catalog.length === 0) {
    return { kind: "catalog-empty" };
  }

  const query = buildSearchQuery(rawText);
  if (!query) {
    if (lastProductSlug) {
      const lastProduct = catalog.find(
        (product) => product.slug === lastProductSlug,
      );
      if (lastProduct) {
        return { kind: "match", product: lastProduct };
      }
    }

    return { kind: "need-product" };
  }

  const queryTokens = query.split(" ");
  const scoredProducts = catalog
    .map((product) => {
      const normalizedName = normalizeText(product.name);
      const normalizedSlug = normalizeText(product.slug);
      let score = 0;

      if (normalizedSlug === query || normalizedName === query) {
        score += 120;
      }

      if (normalizedName.includes(query) || normalizedSlug.includes(query)) {
        score += 80;
      }

      const matchedTokens = queryTokens.filter(
        (token) =>
          normalizedName.includes(token) || normalizedSlug.includes(token),
      ).length;

      if (matchedTokens > 0) {
        score += matchedTokens * 18;
      }

      const allTokensMatched = queryTokens.every(
        (token) =>
          normalizedName.includes(token) || normalizedSlug.includes(token),
      );
      if (allTokensMatched) {
        score += 30;
      }

      if (product.available) {
        score += 6;
      }

      if (product.stock > 0) {
        score += 4;
      }

      return { product, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  if (scoredProducts.length === 0) {
    return { kind: "not-found" };
  }

  if (scoredProducts.length === 1) {
    return { kind: "match", product: scoredProducts[0].product };
  }

  const [bestMatch, secondMatch] = scoredProducts;
  if (bestMatch.score >= 120 || bestMatch.score - secondMatch.score >= 24) {
    return { kind: "match", product: bestMatch.product };
  }

  return {
    kind: "ambiguous",
    options: scoredProducts.slice(0, 3).map((entry) => entry.product),
  };
}

export function buildCatalogReply(catalog: ProductRecord[]): ReplyPlan {
  if (catalog.length === 0) {
    return {
      state: BOT_STATE_DEFAULT,
      text: "Meu catálogo está vazio no momento. 📋 Rode o seed ou cadastre produtos no banco para eu conseguir consultar.",
    } satisfies ReplyPlan;
  }

  const visibleProducts = catalog.slice(0, 6);
  const lines = visibleProducts.map(
    (product) =>
      `• *${product.name}*: ${formatCurrency(product.price)}${
        product.available && product.stock > 0
          ? ` ✅ (${product.stock} em estoque)`
          : " ❌ (indisponível)"
      }`,
  );

  return {
    state: BOT_STATE_DEFAULT,
    text: [
      "🛍️ *Catálogo atual:*",
      "",
      ...lines,
      "",
      catalog.length > visibleProducts.length
        ? "Se quiser, também posso buscar um produto específico por nome. 🔍"
        : "Se quiser, posso te passar mais detalhes de qualquer item. 😊",
    ].join("\n"),
  } satisfies ReplyPlan;
}

export function buildCheapestReply(catalog: ProductRecord[]): ReplyPlan {
  const availableProducts = catalog.filter(
    (product) => product.available && product.stock > 0,
  );

  if (availableProducts.length === 0) {
    return {
      state: BOT_STATE_DEFAULT,
      text: "Não encontrei produtos disponíveis no momento. 😕 Se preferir, posso te encaminhar para um atendente.",
    } satisfies ReplyPlan;
  }

  const cheapestProducts = [...availableProducts]
    .sort((left, right) => left.price - right.price)
    .slice(0, 3);

  return {
    state: BOT_STATE_DEFAULT,
    text: [
      "🏷️ *Os itens mais em conta agora são:*",
      "",
      ...cheapestProducts.map(
        (product) =>
          `• *${product.name}*: ${formatCurrency(product.price)} ✅ (${product.stock} em estoque)`,
      ),
      "",
      "Se quiser, comparo algum deles com outro produto do catálogo. 😊",
    ].join("\n"),
  } satisfies ReplyPlan;
}

function buildProductReply(
  intent: PendingIntent,
  product: ProductRecord,
): ReplyPlan {
  const baseState: BotThreadState = {
    awaiting: null,
    lastProductSlug: product.slug,
    mode: "bot",
  };

  if (intent === "price") {
    return {
      state: baseState,
      text: `💰 *${product.name}* está saindo por ${formatCurrency(product.price)}. ${resolveProductStatus(product)}`,
    };
  }

  if (intent === "availability") {
    return {
      state: baseState,
      text: `📦 *${product.name}*: ${resolveProductStatus(product)}`,
    };
  }

  return {
    state: baseState,
    text: [
      `🛍️ *${product.name}*`,
      `• 💰 Preço: ${formatCurrency(product.price)}`,
      `• 📦 Status: ${resolveProductStatus(product)}`,
      "",
      "Se quiser, posso consultar preço, estoque ou listar outras opções. 😊",
    ].join("\n"),
  };
}

export async function resolveProductIntentReply(
  intent: PendingIntent,
  rawText: string,
  state: BotThreadState,
): Promise<ReplyPlan> {
  const catalog = await getAllProducts();
  const resolution = resolveProductSearch(
    catalog,
    rawText,
    state.lastProductSlug,
  );

  if (resolution.kind === "catalog-empty") {
    return {
      state: BOT_STATE_DEFAULT,
      text: "Ainda não tenho produtos cadastrados para consultar. 📋 Rode o seed ou cadastre itens no banco primeiro.",
    } satisfies ReplyPlan;
  }

  if (resolution.kind === "need-product") {
    return {
      state: {
        ...state,
        awaiting: intent,
      },
      text: "Qual produto você quer consultar? 🔍",
    } satisfies ReplyPlan;
  }

  if (resolution.kind === "not-found") {
    return {
      state: {
        ...state,
        awaiting: intent,
      },
      text: "Não encontrei esse produto no catálogo. 😕 Me diga o nome exato ou escreva *catálogo* para eu listar as opções.",
    } satisfies ReplyPlan;
  }

  if (resolution.kind === "ambiguous") {
    return {
      state: {
        ...state,
        awaiting: intent,
      },
      text: [
        "Encontrei mais de uma opção parecida: 🤔",
        "",
        ...resolution.options.map((product) => `• ${product.name}`),
        "",
        "Me diga o nome exato do produto que você quer consultar.",
      ].join("\n"),
    } satisfies ReplyPlan;
  }

  return buildProductReply(intent, resolution.product);
}
