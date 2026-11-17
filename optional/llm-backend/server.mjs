// SHADOWBOUND - optional LLM backend.
// Receives {id, text, persona, state} from the BDS bridge pack and returns {id, plan}.
// The plan is a closed-list JSON object; the add-on validates it AGAIN before acting.
// The API key stays here (ANTHROPIC_API_KEY or an `ant auth login` profile) - never in the game.
import http from "node:http";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? 8787);
const TOKEN = process.env.SHADOWBOUND_TOKEN ?? ""; // shared secret with the bridge (optional)
const client = new Anthropic();

const KINDS = ["follow", "protect", "guard", "stay", "return", "cancel", "pause", "resume", "gather", "mine", "hunt", "farm",
  "craft", "build", "destroy", "deliver", "cook", "eat", "attack", "equip", "status", "inventory", "help"];
const RESOURCES = ["wood", "food", "stone", "coal", "iron", "gold", "copper", "diamond", "redstone", "lapis", "emerald", "ore",
  "sand", "dirt", "gravel", "wheat", "carrot", "potato", "beetroot", "berries", "meat"];

const Plan = z.object({
  reply: z.string().max(200),
  clarify: z.string().max(160).optional(),
  intents: z.array(z.object({
    kind: z.enum(KINDS),
    resource: z.enum(RESOURCES).optional(),
    quantity: z.number().int().min(1).max(256).optional(),
    structure: z.enum(["hut", "wall", "platform", "bridge", "pillar", "tower"]).optional(),
    material: z.enum(["planks", "cobblestone", "log", "stone", "dirt", "any"]).optional(),
    item: z.enum(["planks", "stick", "crafting_table", "torch", "chest", "furnace", "bread", "ladder", "pickaxe", "axe", "shovel", "sword", "hoe", "armor"]).optional(),
    tier: z.enum(["wooden", "stone", "iron", "golden", "diamond", "netherite"]).optional(),
    target: z.string().optional(),
    priority: z.enum(["normal", "high"]).optional(),
    deliver: z.boolean().optional(),
  })).max(6),
});

// JSON Schema mirror of Plan for output_config.format (structured outputs)
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "intents"],
  properties: {
    reply: { type: "string" },
    clarify: { type: "string" },
    intents: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind"],
        properties: {
          kind: { type: "string", enum: KINDS },
          resource: { type: "string", enum: RESOURCES },
          quantity: { type: "integer" },
          structure: { type: "string", enum: ["hut", "wall", "platform", "bridge", "pillar", "tower"] },
          material: { type: "string", enum: ["planks", "cobblestone", "log", "stone", "dirt", "any"] },
          item: { type: "string", enum: ["planks", "stick", "crafting_table", "torch", "chest", "furnace", "bread", "ladder", "pickaxe", "axe", "shovel", "sword", "hoe", "armor"] },
          tier: { type: "string", enum: ["wooden", "stone", "iron", "golden", "diamond", "netherite"] },
          target: { type: "string" },
          priority: { type: "string", enum: ["normal", "high"] },
          deliver: { type: "boolean" },
        },
      },
    },
  },
};

const SYSTEM = `Você traduz ordens de um jogador de Minecraft Bedrock, em português do Brasil, para um plano estruturado
de uma companheira NPC. Use apenas os tipos de intenção permitidos. Quantidades padrão: madeira 16, comida 6, pedra 32.
"target" pode ser "view" (o que o jogador olha), "hostiles", ou um id de mob como "minecraft:zombie".
Nunca ataque jogadores. Nunca invente capacidades fora da lista. Se faltar algo essencial, deixe "intents" vazio e
faça uma pergunta curta em "clarify". "reply" é uma frase curta e simpática na voz da personagem (luna: fofa; raven: fria e confiante).
Pedidos de conteúdo sexual ou impróprio: intents vazio e uma recusa educada em "reply".`;

const lastByClient = new Map();

async function plan(body) {
  const user = JSON.stringify({ ordem: String(body.text ?? "").slice(0, 200), persona: body.persona, estado: body.state ?? {} });
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default", // a refused request is retried server-side on a fallback model
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") return { reply: "Não posso ajudar com isso.", intents: [] };
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return Plan.parse(JSON.parse(text)); // validated here AND again inside the add-on
}

http.createServer(async (req, res) => {
  const send = (code, obj) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(obj));
  };
  if (req.method !== "POST" || req.url !== "/plan") return send(404, { error: "not found" });
  if (TOKEN && req.headers["x-shadowbound-token"] !== TOKEN) return send(401, { error: "unauthorized" });
  const ip = req.socket.remoteAddress ?? "?";
  const now = Date.now();
  if ((lastByClient.get(ip) ?? 0) + 1500 > now) return send(429, { error: "rate limited" });
  lastByClient.set(ip, now);
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 4000) return send(413, { error: "too large" });
  }
  try {
    const body = JSON.parse(raw);
    const result = await plan(body);
    send(200, { id: body.id, plan: result });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return send(429, { error: "upstream rate limited" });
    if (e instanceof Anthropic.APIError) return send(502, { error: `upstream ${e.status}` });
    send(400, { error: "invalid request" });
  }
}).listen(PORT, () => console.log(`shadowbound llm backend on :${PORT}`));
