import { asc, count, desc } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";
import { products, customers, conversations } from "@/db/schema";
import { formatCurrency } from "@/lib/whatsapp/utils";

export const dynamic = "force-dynamic";

const requiredEnvVars = [
  "DATABASE_URL",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_BOT_USERNAME",
] as const;

const sampleQuestions = [
  "Oi, quais produtos vocês têm hoje?",
  "Quanto custa o moedor manual preto?",
  "Tem camiseta bora de cafe em estoque?",
  "Quero falar com um atendente.",
];

type DashboardData = {
  dbError: string | null;
  totalConversations: number;
  totalCustomers: number;
  totalProducts: number;
  featuredProducts: Array<{
    available: boolean;
    name: string;
    price: number;
    slug: string;
    stock: number;
  }>;
};

async function getDashboardData(): Promise<DashboardData> {
  try {
    const [
      [{ totalProducts }],
      [{ totalCustomers }],
      [{ totalConversations }],
      featuredProducts,
    ] = await Promise.all([
      db.select({ totalProducts: count() }).from(products),
      db.select({ totalCustomers: count() }).from(customers),
      db.select({ totalConversations: count() }).from(conversations),
      db
        .select({
          available: products.available,
          name: products.name,
          price: products.price,
          slug: products.slug,
          stock: products.stock,
        })
        .from(products)
        .orderBy(
          desc(products.available),
          desc(products.stock),
          asc(products.name),
        )
        .limit(4),
    ]);

    return {
      dbError: null,
      totalConversations: Number(totalConversations),
      totalCustomers: Number(totalCustomers),
      totalProducts: Number(totalProducts),
      featuredProducts,
    };
  } catch (error) {
    return {
      dbError:
        error instanceof Error
          ? error.message
          : "Nao foi possivel consultar o banco de dados.",
      totalConversations: 0,
      totalCustomers: 0,
      totalProducts: 0,
      featuredProducts: [],
    };
  }
}

export default async function Home() {
  await connection();

  const envStatus = requiredEnvVars.map((name) => ({
    name,
    ready: Boolean(process.env[name]),
  }));
  const dashboardData = await getDashboardData();

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-4xl border border-(--line) bg-(--card) shadow-(--shadow)">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.4fr_0.9fr] lg:px-10 lg:py-10">
            <div className="space-y-6">
              <span className="inline-flex w-fit items-center rounded-full border border-[rgba(15,107,69,0.2)] bg-[rgba(15,107,69,0.08)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-(--accent)">
                WhatsApp + PostgreSQL + Next.js 16
              </span>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl lg:text-6xl">
                  Prototipo de bot em portugues para atendimento no WhatsApp.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-(--muted) sm:text-lg">
                  O fluxo esta pronto para responder perguntas sobre catalogo,
                  consultar preco e estoque direto no banco, registrar conversas
                  e encaminhar atendimento humano quando necessario.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <article className="rounded-[1.4rem] border border-(--line) bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-(--muted)">
                    Webhook
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    /api/webhooks/whatsapp
                  </p>
                </article>
                <article className="rounded-[1.4rem] border border-(--line) bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-(--muted)">
                    Concorrencia
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    Debounce de 1.2s
                  </p>
                </article>
                <article className="rounded-[1.4rem] border border-(--line) bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-(--muted)">
                    Idioma
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    pt-BR
                  </p>
                </article>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[1.6rem] border border-(--line) bg-(--panel) p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-(--muted)">
                  Saude do ambiente
                </p>
                <div className="mt-4 space-y-3">
                  {envStatus.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-(--line) bg-white/80 px-4 py-3">
                      <span className="text-sm font-medium text-foreground">
                        {item.name}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                          item.ready
                            ? "bg-[rgba(15,107,69,0.1)] text-(--accent)"
                            : "bg-[rgba(156,55,27,0.1)] text-(--danger)"
                        }`}>
                        {item.ready ? "ok" : "pendente"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[1.8rem] border border-(--line) bg-(--card) p-6 shadow-(--shadow)">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-(--muted)">
                  Resumo do banco
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                  Visao operacional
                </h2>
              </div>
              <span className="rounded-full border border-(--line) bg-white/80 px-3 py-1 text-xs uppercase tracking-[0.18em] text-(--muted)">
                live
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <article className="rounded-[1.3rem] border border-(--line) bg-white/75 p-4">
                <p className="text-sm text-(--muted)">Produtos</p>
                <p className="mt-2 text-3xl font-semibold">
                  {dashboardData.totalProducts}
                </p>
              </article>
              <article className="rounded-[1.3rem] border border-(--line) bg-white/75 p-4">
                <p className="text-sm text-(--muted)">Clientes</p>
                <p className="mt-2 text-3xl font-semibold">
                  {dashboardData.totalCustomers}
                </p>
              </article>
              <article className="rounded-[1.3rem] border border-(--line) bg-white/75 p-4">
                <p className="text-sm text-(--muted)">Conversas</p>
                <p className="mt-2 text-3xl font-semibold">
                  {dashboardData.totalConversations}
                </p>
              </article>
            </div>

            <div className="mt-6 rounded-[1.4rem] border border-dashed border-(--line) bg-[rgba(255,255,255,0.55)] p-4">
              <p className="text-sm leading-6 text-(--muted)">
                {dashboardData.dbError
                  ? `Falha ao consultar o banco: ${dashboardData.dbError}`
                  : "Se o catalogo estiver vazio, rode `bun run db:migrate` e depois `bun run db:seed`."}
              </p>
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-(--line) bg-(--card) p-6 shadow-(--shadow)">
            <p className="text-xs uppercase tracking-[0.22em] text-(--muted)">
              Perguntas exemplo
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
              O que o bot responde hoje
            </h2>
            <div className="mt-6 grid gap-3">
              {sampleQuestions.map((question, index) => (
                <article
                  key={question}
                  className="rounded-[1.3rem] border border-(--line) bg-white/75 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-(--muted)">
                    Exemplo {index + 1}
                  </p>
                  <p className="mt-2 text-base font-medium text-foreground">
                    {question}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[1.8rem] border border-(--line) bg-(--card) p-6 shadow-(--shadow)">
            <p className="text-xs uppercase tracking-[0.22em] text-(--muted)">
              Catalogo em destaque
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
              Produtos consultados pelo bot
            </h2>
            <div className="mt-6 grid gap-3">
              {dashboardData.featuredProducts.length === 0 ? (
                <div className="rounded-[1.4rem] border border-dashed border-(--line) bg-white/70 p-5 text-sm leading-6 text-(--muted)">
                  Nenhum produto encontrado ainda. O bot continua funcionando,
                  mas vai responder que o catalogo esta vazio ate o seed ser
                  executado.
                </div>
              ) : (
                dashboardData.featuredProducts.map((product) => (
                  <article
                    key={product.slug}
                    className="grid gap-3 rounded-[1.4rem] border border-(--line) bg-white/80 p-4 sm:grid-cols-[1fr_auto]">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {product.name}
                      </h3>
                      <p className="mt-1 text-sm text-(--muted)">
                        {product.available && product.stock > 0
                          ? `${product.stock} unidade(s) em estoque`
                          : "Indisponivel no momento"}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <span className="text-lg font-semibold text-foreground">
                        {formatCurrency(product.price)}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                          product.available && product.stock > 0
                            ? "bg-[rgba(15,107,69,0.1)] text-(--accent)"
                            : "bg-[rgba(156,55,27,0.1)] text-(--danger)"
                        }`}>
                        {product.available && product.stock > 0
                          ? "disponivel"
                          : "indisponivel"}
                      </span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-(--line) bg-(--card) p-6 shadow-(--shadow)">
            <p className="text-xs uppercase tracking-[0.22em] text-(--muted)">
              Fluxos cobertos
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
              Edge cases tratados
            </h2>
            <div className="mt-6 grid gap-3">
              {[
                "Mensagens curtas em sequencia sao consolidadas com debounce para evitar respostas fora de contexto.",
                "Mensagens sem texto, audio, imagem ou documento recebem uma orientacao clara para continuar por texto.",
                "Pedidos de atendimento humano viram handoff persistido em banco, com comando explicito para voltar ao bot.",
                "Perguntas vagas como 'quanto custa?' entram em modo de follow-up e esperam o nome do produto.",
              ].map((item) => (
                <article
                  key={item}
                  className="rounded-[1.3rem] border border-(--line) bg-white/75 p-4 text-sm leading-6 text-foreground">
                  {item}
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
