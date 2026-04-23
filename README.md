# WhatsApp Bot Prototype

Protótipo de bot para WhatsApp usando Next.js 16, Vercel Chat SDK, adaptador
do WhatsApp e PostgreSQL.

## O que já está pronto

- Respostas em português do Brasil.
- Consulta de catálogo, preço e estoque direto no banco.
- Persistência de clientes, conversas e mensagens.
- Handoff para atendimento humano com estado persistido.
- Tratamento de edge cases comuns do WhatsApp:
  - rajadas de mensagens curtas com debounce;
  - perguntas vagas que exigem follow-up;
  - mensagens sem texto ou com anexos;
  - retomada do bot após handoff humano.

## Variáveis de ambiente

Crie um `.env` com:

```bash
DATABASE_URL=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_APP_SECRET=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_VERIFY_TOKEN=...
WHATSAPP_BOT_USERNAME=loja-bot
```

## Banco de dados

Rode as migrations:

```bash
bun run db:migrate
```

Se quiser um catálogo inicial para testar o bot:

```bash
bun run db:seed
```

Observação: o campo `price` é armazenado em centavos.

## Desenvolvimento

```bash
bun dev
```

Abra `http://localhost:3000` para ver a página de status do protótipo.

## Webhook do WhatsApp

Use este endpoint no painel da Meta:

```txt
/api/webhooks/whatsapp
```

Em desenvolvimento, exponha o app com ngrok ou ferramenta equivalente.

## Exemplos de perguntas

- `Oi, quais produtos vocês têm hoje?`
- `Quanto custa o moedor manual preto?`
- `Tem camiseta bora de cafe em estoque?`
- `Quero falar com um atendente`

## Scripts

- `bun dev`
- `bun run build`
- `bun run lint`
- `bun run db:migrate`
- `bun run db:seed`
