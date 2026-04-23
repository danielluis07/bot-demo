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
    return "Indisponivel no momento.";
  }

  if (product.stock <= 0) {
    return "Disponivel no cadastro, mas com estoque zerado agora.";
  }

  return `Disponivel com ${product.stock} unidade(s) em estoque.`;
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
      text: "Meu catalogo esta vazio no momento. Rode o seed ou cadastre produtos no banco para eu conseguir consultar.",
    } satisfies ReplyPlan;
  }

  const visibleProducts = catalog.slice(0, 6);
  const lines = visibleProducts.map(
    (product) =>
      `- ${product.name}: ${formatCurrency(product.price)}${
        product.available && product.stock > 0
          ? ` (${product.stock} em estoque)`
          : " (indisponivel)"
      }`,
  );

  return {
    state: BOT_STATE_DEFAULT,
    text: [
      "Aqui vai um recorte do catalogo atual:",
      ...lines,
      "",
      catalog.length > visibleProducts.length
        ? "Se quiser, eu tambem posso buscar um produto especifico por nome."
        : "Se quiser, posso te passar mais detalhes de qualquer item.",
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
      text: "Nao encontrei produtos disponiveis no momento. Se preferir, posso te encaminhar para um atendente.",
    } satisfies ReplyPlan;
  }

  const cheapestProducts = [...availableProducts]
    .sort((left, right) => left.price - right.price)
    .slice(0, 3);

  return {
    state: BOT_STATE_DEFAULT,
    text: [
      "Os itens mais em conta agora sao:",
      ...cheapestProducts.map(
        (product) =>
          `- ${product.name}: ${formatCurrency(product.price)} (${product.stock} em estoque)`,
      ),
      "",
      "Se quiser, eu comparo algum deles com outro produto do catalogo.",
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
      text: `${product.name} esta saindo por ${formatCurrency(product.price)}. ${resolveProductStatus(product)}`,
    };
  }

  if (intent === "availability") {
    return {
      state: baseState,
      text: `${product.name}: ${resolveProductStatus(product)}`,
    };
  }

  return {
    state: baseState,
    text: [
      `${product.name}`,
      `- Preco: ${formatCurrency(product.price)}`,
      `- Status: ${resolveProductStatus(product)}`,
      "",
      "Se quiser, posso consultar preco, estoque ou listar outras opcoes.",
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
      text: "Ainda nao tenho produtos cadastrados para consultar. Rode o seed ou cadastre itens no banco primeiro.",
    } satisfies ReplyPlan;
  }

  if (resolution.kind === "need-product") {
    return {
      state: {
        ...state,
        awaiting: intent,
      },
      text: "Qual produto voce quer consultar?",
    } satisfies ReplyPlan;
  }

  if (resolution.kind === "not-found") {
    return {
      state: {
        ...state,
        awaiting: intent,
      },
      text: "Nao encontrei esse produto no catalogo. Me diga o nome exato ou escreva 'catalogo' para eu listar as opcoes.",
    } satisfies ReplyPlan;
  }

  if (resolution.kind === "ambiguous") {
    return {
      state: {
        ...state,
        awaiting: intent,
      },
      text: [
        "Encontrei mais de uma opcao parecida:",
        ...resolution.options.map((product) => `- ${product.name}`),
        "",
        "Me diga o nome exato do produto que voce quer consultar.",
      ].join("\n"),
    } satisfies ReplyPlan;
  }

  return buildProductReply(intent, resolution.product);
}
