import { after } from "next/server";
import { bot } from "@/lib/bot";

export const runtime = "nodejs";

function handleWebhook(request: Request) {
  return bot.webhooks.whatsapp(request, {
    waitUntil: (task) => after(() => task),
  });
}

export async function GET(request: Request) {
  return handleWebhook(request);
}

export async function POST(request: Request) {
  return handleWebhook(request);
}
