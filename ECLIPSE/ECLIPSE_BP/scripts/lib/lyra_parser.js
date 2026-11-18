// Interpretador de pedidos para a Lyra (PT-BR, offline, determinístico).
// Converte frases como "faz uma mansão aqui e depois pega comida" em uma fila de tarefas.
import { hasAny, normalize, parseAmount, tokens } from "./text.js";

export const STRUCTURES = {
  cabana: ["cabana", "casinha", "casebre", "choupana", "cabaninha"],
  casa: ["casa", "residencia", "lar", "moradia", "sobrado"],
  mansao: ["mansao", "castelo", "palacio", "mansão", "casarao", "casa grande", "casa gigante", "mansaozinha"],
  torre: ["torre", "torreao", "farol", "vigia"],
  muralha: ["muralha", "muro", "parede", "cerca de pedra"],
  ponte: ["ponte", "passarela"],
  fazenda: ["fazenda", "plantacao", "horta", "roca", "plantar", "lavoura"],
  abrigo: ["abrigo", "refugio", "bunker", "esconderijo"],
};

const RESOURCES = {
  log: ["madeira", "madeiras", "tronco", "troncos", "lenha", "arvore", "arvores", "tora", "toras", "wood", "log"],
  cobblestone: ["pedra", "pedras", "rocha", "rochas", "pedregulho", "cobblestone", "stone"],
  sand: ["areia", "sand"],
  food: ["comida", "comidas", "carne", "caca", "cacar", "alimento", "fome", "comer", "rango", "lanche"],
  coal: ["carvao", "coal"],
  iron: ["ferro", "iron"],
  gold: ["ouro", "gold"],
  diamond: ["diamante", "diamantes", "diamond"],
  copper: ["cobre", "copper"],
  redstone: ["redstone", "pedra vermelha"],
  lapis: ["lapis", "lazuli"],
};

const VERBS = {
  gather: ["pega", "pegar", "pegue", "coleta", "coletar", "colete", "junta", "juntar", "busca", "buscar", "traz", "trazer", "traga", "corta", "cortar", "corte", "consegue", "conseguir", "arruma", "arrumar", "procura", "procurar", "minera", "minerar", "cava", "cavar", "caca", "cacar", "acha", "achar", "encontra", "encontrar", "vai atras", "pesca"],
  build: ["constroi", "construir", "construa", "constroe", "faz", "faca", "fazer", "faze", "cria", "criar", "crie", "ergue", "erguer", "levanta", "levantar", "monta", "montar", "edifica", "build"],
  give: ["me da", "me de", "entrega", "entregar", "passa", "passar", "me passa", "manda"],
};

function detectStructure(tok) {
  const text = tok.join(" ");
  // preferir as mais específicas
  for (const key of ["mansao", "cabana", "torre", "muralha", "ponte", "fazenda", "abrigo", "casa"]) {
    if (hasAny(tok, STRUCTURES[key])) {
      // "casinha" é cabana; "casa grande" é mansão
      if (key === "casa" && /grande|enorme|gigante/.test(text)) return "mansao";
      return key;
    }
  }
  return null;
}

function detectResource(tok) {
  for (const [key, words] of Object.entries(RESOURCES)) if (hasAny(tok, words)) return key;
  return null;
}

function detectWhere(tok) {
  const t = tok.join(" ");
  if (/\b(ali|la|naquele|naquela|onde estou olhando|onde eu olho|nessa direcao)\b/.test(t)) return "look";
  if (/\b(aqui|perto de mim|do meu lado|aqui mesmo)\b/.test(t)) return "here";
  return "look";
}

/**
 * @returns {{tasks: object[], reply: string|null, unknown: boolean}}
 */
export function parseRequest(input) {
  const raw = normalize(input);
  if (!raw) return { tasks: [], reply: null, unknown: true };
  const clauses = raw
    .split(/\s*(?:,|;|\be depois\b|\bdepois\b|\be entao\b|\bentao\b|\be tambem\b|\btambem\b|\be ai\b)\s*/)
    .flatMap((c) => c.split(/\s+e\s+(?=(?:pega|coleta|faz|constroi|constroe|cria|explora|vai|me|volta|segue|protege|caca|corta|busca|traz)\b)/))
    .map((c) => c.trim())
    .filter(Boolean);
  const tasks = [];
  let reply = null;
  let lastVerb = null;
  for (const clause of clauses) {
    const tok = tokens(clause);
    const t = tok.join(" ");
    // ---- conversa
    if (/^(oi|ola|eae|e ai|salve|opa|bom dia|boa tarde|boa noite|hey|ei)\b/.test(t) && tok.length <= 3) {
      reply = "greet";
      continue;
    }
    if (/\b(obrigad[oa]|valeu|vlw|brigad[oa]|tmj)\b/.test(t)) {
      reply = "thanks";
      continue;
    }
    if (/\b(ajuda|socorro me ajuda a usar|o que voce faz|comandos|o que vc faz|como funciona)\b/.test(t)) {
      reply = "help";
      continue;
    }
    // ---- controle
    if (/\b(para|pare|cancela|cancelar|esquece|chega|stop|deixa pra la)\b/.test(t) && !/\bpara (mim|eu|o|a|construir|fazer|pegar)\b/.test(t)) {
      tasks.push({ type: "stop" });
      continue;
    }
    if (/\b(volta pra sombra|volta para a sombra|some|desaparece|descansa|recolhe|vai embora|tchau)\b/.test(t)) {
      tasks.push({ type: "recall" });
      continue;
    }
    if (/\b(vem aqui|chega aqui|vem ca|aqui agora|cola aqui|vem pra ca)\b/.test(t)) {
      tasks.push({ type: "come" });
      continue;
    }
    if (/\b(me segue|segue|seguir|me acompanha|acompanha|vem comigo|bora|vamos)\b/.test(t)) {
      tasks.push({ type: "follow" });
      continue;
    }
    if (/\b(espera|esperar|fica|fique|fica aqui|aguarda|parada|para ai)\b/.test(t)) {
      tasks.push({ type: "stay" });
      continue;
    }
    if (/\b(protege|proteger|defende|defender|guarda|me protege|luta|lute|ataca|mata os monstros)\b/.test(t)) {
      tasks.push({ type: "guard" });
      continue;
    }
    if (/\b(inventario|o que voce tem|que voce tem|mostra (os )?itens|sua bolsa|seus itens|o que tem ai)\b/.test(t)) {
      tasks.push({ type: "inventory" });
      continue;
    }
    if (/\b(me da tudo|entrega tudo|me passa tudo|esvazia|me de tudo|da tudo)\b/.test(t)) {
      tasks.push({ type: "dump" });
      continue;
    }
    if (/\b(danca|dancar|dance|gira|faz uma pose)\b/.test(t)) {
      tasks.push({ type: "dance" });
      continue;
    }
    if (/\b(explora|explorar|explore|vai longe|da uma volta|reconhece|vasculha|investiga|patrulha)\b/.test(t)) {
      const radius = /\b(muito longe|bem longe|longe)\b/.test(t) ? 160 : /\bperto\b/.test(t) ? 48 : 96;
      tasks.push({ type: "explore", radius });
      continue;
    }
    // ---- verbos com objeto
    let verb = null;
    if (hasAny(tok, VERBS.give)) verb = "give";
    else if (hasAny(tok, VERBS.build)) verb = "build";
    else if (hasAny(tok, VERBS.gather)) verb = "gather";
    const structure = detectStructure(tok);
    const resource = detectResource(tok);
    if (!verb) verb = structure ? "build" : resource ? lastVerb ?? "gather" : null;
    if (verb === "build" && structure) {
      tasks.push({ type: "build", blueprint: structure, where: detectWhere(tok) });
      lastVerb = "build";
      continue;
    }
    if (verb === "build" && !structure && resource) verb = "gather";
    if (verb === "give" && resource) {
      tasks.push({ type: "give", resource, amount: parseAmount(t, 64) });
      lastVerb = "give";
      continue;
    }
    if ((verb === "gather" || verb === "give") && resource) {
      const def = resource === "log" ? 32 : resource === "cobblestone" ? 64 : resource === "food" ? 10 : resource === "sand" ? 32 : 8;
      const amount = Math.max(1, Math.min(512, parseAmount(t, def)));
      if (resource === "food") tasks.push({ type: "food", amount });
      else if (["coal", "iron", "gold", "diamond", "copper", "redstone", "lapis"].includes(resource)) tasks.push({ type: "ore", ore: resource, amount });
      else tasks.push({ type: "gather", resource, amount });
      lastVerb = "gather";
      continue;
    }
    if (verb === "build") {
      reply = "build_what";
      continue;
    }
  }
  return { tasks, reply, unknown: tasks.length === 0 && !reply };
}

export const LYRA_EXAMPLES = [
  "pega 32 madeiras",
  "faz uma casa aqui",
  "constrói uma mansão ali e depois pega comida",
  "explora bem longe",
  "me protege",
  "me dá a madeira",
  "o que você tem?",
  "para",
];
