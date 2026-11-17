# IA generativa (OPCIONAL, só servidor BDS)

O Shadowbound funciona **100% offline** no celular e no PC. Esta pasta é só para quem roda um
**Bedrock Dedicated Server** e quer que ordens que o interpretador local não entende sejam
interpretadas por um modelo de linguagem.

```
jogo (addon) --scriptevent--> ponte BDS (bds-bridge) --HTTP--> backend (llm-backend) --> Claude API
     ^                                                                                        |
     +---- plano JSON de lista fechada, validado DE NOVO no addon antes de qualquer ação -----+
```

Segurança: o modelo **nunca** envia código, só intenções de uma lista fechada. O executor local verifica
dono, permissões e capacidades. A chave da API fica só no backend. Há limite de frequência e de tamanho, e se a
ponte não responder em 10 s o addon continua no modo offline.

## Passos
1. Backend: `cd optional/llm-backend && npm install && ANTHROPIC_API_KEY=... SHADOWBOUND_TOKEN=um-segredo npm start`
2. No BDS, instale `optional/bds-bridge` como behavior pack do mundo (junto com o Shadowbound). O módulo
   `@minecraft/server-net` é **beta**, então o mundo do servidor precisa da opção **Beta APIs** ativada.
3. Em `config/0dd57c88-ffd7-44cc-8f6d-0d4499f84739/variables.json`: `{ "backend_url": "http://127.0.0.1:8787/plan" }`;
   e em `secrets.json`: `{ "token": "um-segredo" }`. Também é preciso liberar o módulo `@minecraft/server-net` no `permissions.json` do servidor.
4. No jogo: menu da sombra → Configurações → ligar **IA externa** (aparece "[ponte conectada]").
