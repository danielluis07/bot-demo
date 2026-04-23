export function isGreeting(text: string) {
  return /^(oi+|ola|opa|bom dia|boa tarde|boa noite)\b/.test(text);
}

export function isHelpRequest(text: string) {
  return /\b(ajuda|menu|opcoes|como funciona|o que voce faz)\b/.test(text);
}

export function isCatalogRequest(text: string) {
  return /\b(catalogo|listar|lista|produtos)\b/.test(text);
}

export function isCheapestRequest(text: string) {
  return /\b(mais barato|mais em conta|menor preco)\b/.test(text);
}

export function isPriceRequest(text: string) {
  return /\b(preco|valor|quanto custa|custa quanto)\b/.test(text);
}

export function isAvailabilityRequest(text: string) {
  return /\b(estoque|disponivel|disponibilidade)\b/.test(text);
}

export function isHumanHandoffRequest(text: string) {
  return /\b(atendente|humano|pessoa|especialista|suporte)\b/.test(text);
}

export function isResumeBotRequest(text: string) {
  return /\b(voltar pro bot|voltar para o bot|retomar bot|continuar com o bot|voltar ao bot)\b/.test(
    text,
  );
}

export function isStopRequest(text: string) {
  return /\b(encerrar|finalizar|sair|parar|cancelar atendimento)\b/.test(text);
}

export function isThanks(text: string) {
  return /\b(obrigado|obrigada|valeu|brigado)\b/.test(text);
}

export function isOrderRequest(text: string) {
  return /\b(pedido|entrega|rastreio|rastreamento|codigo do pedido|status do pedido)\b/.test(
    text,
  );
}
