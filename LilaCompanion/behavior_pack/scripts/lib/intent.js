// Reconhecedor de intenções em português (puro e determinístico — não é um modelo de linguagem).
// Converte frases livres em uma lista ordenada de intenções que viram objetivos do planejador:
//   "pega 20 madeira e depois faz uma casa aqui" -> [gather log x20, build casa (aqui)]
import { normalize, parseAmount, similar, tokens } from "./text.js";
import { findArch } from "./archgen.js";
import { ARMOR_WORDS, BLUEPRINT_WORDS, ITEMS, TIER_WORDS, TOOL_WORDS } from "./lexicon.js";
import { ARMY_WORDS, BIOMES, CREATIVE_ITEMS, DESTROY_WORDS, FLATTEN_WORDS, FORM_WORDS, KIT_WORDS, MEGA, NORMAL_WORDS, OFF_WORDS, ON_WORDS, SPEED_WORDS, SWARM_SHAPES, SWARM_WORDS, VACUUM_WORDS } from "./catalog.js";

/**
 * @typedef {{type:string, [k:string]:any}} Intent
 */

const SPLIT_RE = /\s*(?:,|;|\be depois\b|\bdepois disso\b|\bdepois\b|\bem seguida\b|\be entao\b|\bentao\b|\be tambem\b|\btambem\b|\bai\b(?= [a-z]))\s*/;

/** Tem a frase (multi-palavra) ou palavra (com tolerância a erro de digitação)? */
function has(tok, list) {
  const joined = ` ${tok.join(" ")} `;
  for (const w of list) {
    if (w.includes(" ")) {
      if (joined.includes(` ${w} `)) return true;
    } else {
      for (const t of tok) if (t === w || (w.length >= 6 && t.startsWith(w)) || (w.length >= 6 && similar(t, w))) return true;
    }
  }
  return false;
}

/** Item mencionado no texto (maior correspondência primeiro). */
export function findItem(tok) {
  const joined = ` ${tok.join(" ")} `;
  let best = null;
  let bestLen = 0;
  for (const e of ITEMS) {
    for (const w of e.words) {
      const hit = w.includes(" ") ? joined.includes(` ${w} `) : tok.some((t) => t === w || (w.length >= 6 && similar(t, w)));
      if (hit && w.length > bestLen) {
        best = e;
        bestLen = w.length;
      }
    }
  }
  return best;
}

/** Ferramenta ou armadura mencionada: {id, kind, tier}. */
export function findTool(tok) {
  let kind = null, armor = null, tier = null;
  for (const [k, ws] of Object.entries(TOOL_WORDS)) if (has(tok, ws)) kind = k;
  for (const [k, ws] of Object.entries(ARMOR_WORDS)) if (has(tok, ws)) armor = k;
  // o nível é a palavra depois de "de" ("picareta de ferro") ou qualquer menção
  const j = tok.join(" ");
  for (const [t, ws] of Object.entries(TIER_WORDS)) {
    for (const w of ws) if (j.includes(`de ${w}`) || j.includes(` ${w} `) || j.endsWith(` ${w}`)) tier = tier ?? t;
  }
  if (kind) {
    const tr = tier ?? "best";
    return { kind, tier: tr, id: tr === "best" ? null : `minecraft:${tr}_${kind}` };
  }
  if (armor) {
    const tr = tier && ["iron", "diamond", "golden"].includes(tier) ? tier : "iron";
    return { kind: armor, tier: tr, id: `minecraft:${tr}_${armor}`, armor: true };
  }
  return null;
}

/** Item do catálogo criativo (maior nome primeiro). */
export function findCreative(tok) {
  const joined = ` ${tok.join(" ")} `;
  let best = null, bl = 0;
  for (const e of CREATIVE_ITEMS) {
    for (const w of e.w) {
      const hit = w.includes(" ") ? joined.includes(` ${w} `) : tok.includes(w);
      if (hit && w.length > bl) {
        best = e;
        bl = w.length;
      }
    }
  }
  return best;
}

function findKey(tok, table) {
  const joined = ` ${tok.join(" ")} `;
  let best = null, bl = 0;
  for (const [k, v] of Object.entries(table)) {
    for (const w of v.w ?? v) {
      const hit = w.includes(" ") ? joined.includes(` ${w} `) : tok.includes(w);
      if (hit && w.length > bl) {
        best = k;
        bl = w.length;
      }
    }
  }
  return best;
}

const TRANSFORM = ["vira", "virar", "vire", "transforma", "transformar", "transforme", "modo", "quero", "vai de", "bora de", "muda pra", "muda para", "forma de"];

function findBlueprint(tok) {
  for (const [k, ws] of Object.entries(BLUEPRINT_WORDS)) if (has(tok, ws)) return k;
  return null;
}

const V = {
  follow: ["bora", "vamo", "vamos", "anda comigo", "fica comigo", "cola em mim", "vem junto", "vem comigo", "me segue", "me siga", "segue", "seguir", "siga", "vem comigo", "venha comigo", "me acompanha", "acompanha", "acompanhar", "follow"],
  stay: ["fica aqui", "fique aqui", "fica ai", "espera", "espere", "aguarda", "aguarde", "fica parada", "parada ai", "nao se mexe", "stay", "wait"],
  come: ["corre aqui", "cola aqui", "chega aqui", "chega mais", "corre ca", "vem rapido", "vem aqui", "venha aqui", "vem ca", "venha ca", "volta aqui", "volte aqui", "vem pra ca", "aparece", "cade voce", "come here"],
  auto: ["faz oq quiser", "oq quiser", "o que quiser", "modo livre", "fica livre", "livre", "autonoma", "faz o que quiser", "faca o que quiser", "se vira", "vai brincar", "vive sua vida", "joga sozinha", "explora sozinha", "free"],
  stop: ["pare", "parar", "para tudo", "para agora", "para ai", "para com isso", "para de", "cancela", "cancelar", "esquece", "chega", "deixa pra la", "stop", "cancel"],
  pause: ["pausa", "pausar", "pause", "segura ai"],
  resume: ["continua", "continuar", "continue", "volta ao trabalho", "retoma", "retomar", "resume"],
  status: ["status", "como voce esta", "como vc ta", "como esta", "tudo bem", "o que voce ta fazendo", "o que esta fazendo", "oq ta fazendo", "estado", "vida"],
  inventory: ["o que vc tem", "que vc tem", "o que voce tem", "inventario", "o que voce tem", "oq vc tem", "mostra suas coisas", "suas coisas", "mochila", "bolsa", "inventory"],
  give: ["me da", "me de", "me passa", "passa pra mim", "me entrega", "entrega", "joga pra mim", "me manda", "me envia", "da pra mim", "me devolve", "devolve", "give"],
  gather: ["pega", "pegue", "pegar", "coleta", "colete", "coletar", "junta", "junte", "juntar", "consegue", "consiga", "arranja", "arranje", "busca", "busque", "buscar", "traz", "traga", "trazer", "corta", "corte", "cortar", "minera", "minere", "minerar", "cava", "cave", "cavar", "colhe", "colha", "colher", "procura", "procure", "procurar", "acha", "ache", "achar", "encontra", "encontre", "farm", "farma", "farmar", "get", "collect", "mine"],
  craft: ["faz", "faca", "fazer", "fabrica", "fabrique", "fabricar", "cria", "crie", "criar", "crafta", "craft", "craftar", "monta", "monte", "montar", "produz", "make"],
  build: ["constroi", "construa", "construir", "constroe", "ergue", "levanta", "edifica", "build"],
  farmv: ["planta", "plante", "plantar", "cultiva", "cultive", "cultivar", "semeia", "semear"],
  explore: ["explora", "explore", "explorar", "vai explorar", "aventura", "viaja", "viajar", "passeia", "passear", "explore"],
  hunt: ["caca", "caca animais", "cacar", "caçar", "hunt"],
  protect: ["fica de guarda", "de guarda", "vigia", "vigiar", "me protege", "me proteja", "protege", "proteja", "proteger", "me defende", "defende", "guarda costas", "guarda-costas", "protect", "guard"],
  attack: ["ataca", "ataque", "atacar", "mata", "mate", "matar", "luta", "lutar", "attack", "kill"],
  sleep: ["dorme", "durma", "dormir", "vai dormir", "descansa um pouco", "sleep"],
  wake: ["acorda", "acorde", "acordar", "wake"],
  dismiss: ["tchau", "adeus", "pode ir", "vai embora", "some", "dispensa", "dispensar", "guarda voce", "dismiss", "bye"],
  sethome: ["aqui e a base", "aqui e nossa base", "define a base", "marca a base", "base aqui", "casa e aqui", "set home"],
  home: ["vai pra casa", "vai para casa", "volta pra base", "volta pra casa", "vai pra base", "go home"],
  torches: ["coloca tocha", "coloca tochas", "ilumina", "iluminar", "acende", "poe tochas", "bota tocha", "bota tochas"],
  deposit: ["guarda no bau", "guarda as coisas", "guarda tudo", "deposita", "esvazia", "organiza", "store"],
  turret: ["modo torreta", "torreta", "turret", "vira torreta", "vira uma torreta", "defende aqui"],
  scan: ["escaneia", "escaneie", "escanear", "me escaneia", "scan", "analisa", "analisar", "escaneamento"],
  ride: ["carona", "me leva", "me carrega", "deixa eu subir", "quero subir", "quero voar", "me da carona", "voar com voce", "subir no drone", "sobe aqui"],
  missions: ["missoes", "missao", "quests", "quest", "objetivos"],
  thanks: ["obrigado", "obrigada", "valeu", "vlw", "brigado", "thanks", "mandou bem", "parabens", "boa garota"],
  hello: ["oi", "ola", "eae", "e ai", "salve", "bom dia", "boa tarde", "boa noite", "hello", "hi"],
};

/**
 * Interpreta uma frase (pode conter várias ordens encadeadas).
 * @param {string} text
 * @returns {Intent[]}
 */
/** Já em forma de enxame: "faz uma ponte", "escudo", "tornado"... viram formas do enxame. */
export function swarmShapeOf(text) {
  const tok = tokens(normalize(text));
  return tok.length ? findKey(tok, SWARM_SHAPES) : null;
}

export function parseCommands(text) {
  const norm = normalize(text);
  if (!norm) return [];
  const parts = norm.split(SPLIT_RE).map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    // "e" simples também separa duas ordens: "pega madeira e faz uma casa"
    const sub = splitOnE(p);
    for (const s of sub) {
      const it = parseOne(s);
      if (it) out.push(it);
    }
  }
  return out;
}

function splitOnE(p) {
  const tok = p.split(" ");
  const idx = [];
  for (let i = 1; i < tok.length - 1; i++) {
    if (tok[i] !== "e") continue;
    const next = tok.slice(i + 1);
    // só separa se o que vem depois começa com um verbo conhecido
    const verbs = [...V.gather, ...V.craft, ...V.build, ...V.farmv, ...V.give, ...V.follow, ...V.stay, ...V.come, ...V.explore, ...V.sleep, ...V.protect, ...V.torches];
    if (verbs.some((v) => next.join(" ").startsWith(v))) idx.push(i);
  }
  if (!idx.length) return [p];
  const out = [];
  let last = 0;
  for (const i of idx) {
    out.push(tok.slice(last, i).join(" "));
    last = i + 1;
  }
  out.push(tok.slice(last).join(" "));
  return out.filter(Boolean);
}

/**
 * @param {string} s texto normalizado
 * @returns {Intent|null}
 */
export function parseOne(s) {
  const tok = tokens(s);
  if (!tok.length) return null;
  const here = /\baqui\b|\bnesse lugar\b|\bneste lugar\b|\bbem aqui\b|\bali\b/.test(s);
  const amount = parseAmount(s, null);

  if (has(tok, V.dismiss) && !has(tok, V.give)) return { type: "dismiss" };
  // ---- 2.0: voltar ao normal, formas, exército, kit, megaconstruções e biomas
  if (has(tok, NORMAL_WORDS)) return { type: "normal" };
  if (has(tok, KIT_WORDS)) return { type: "kit" };
  // enxame de nanorrobôs (antes de "destrói tudo": "enxame, devora tudo" é do enxame)
  if (has(tok, SWARM_WORDS) && !has(tok, V.give)) return { type: "swarm", shape: findKey(tok, SWARM_SHAPES) ?? undefined };
  // ligar / desligar o robô
  if (has(tok, OFF_WORDS)) return { type: "power", on: false };
  if (has(tok, ON_WORDS) && tok.length <= 4) return { type: "power", on: true };
  if (has(tok, VACUUM_WORDS)) return { type: "vacuum", radius: amount ?? 32 };
  if (has(tok, FLATTEN_WORDS) || has(tok, DESTROY_WORDS)) {
    const all = has(tok, DESTROY_WORDS) || has(tok, ["construcoes", "construcao", "casas", "inclusive", "ate as"]);
    return { type: "flatten", radius: amount ?? 24, all };
  }
  // velocidade de construção ("constrói devagar", "constrói na hora")
  const spd = Object.entries(SPEED_WORDS).find(([, ws]) => has(tok, ws))?.[0];
  if (spd && has(tok, ["constroi", "construir", "construcao", "constrói", "construa", "modo", "velocidade", "faz", "faca", "obra", "trabalha"]) && !findKey(tok, MEGA)) {
    return { type: "buildspeed", speed: spd };
  }
  if (has(tok, ARMY_WORDS)) {
    const style = has(tok, ["ninja", "ninjas"]) ? "ninjas" : has(tok, ["artilharia", "artilheiro", "artilheiros", "canhao", "canhoes"]) ? "artilheiros"
      : has(tok, ["medico", "medicos", "cura", "curandeiro", "curandeiros"]) ? "medicos" : has(tok, ["construtor", "construtores", "pedreiro", "pedreiros"]) ? "construtores"
        : has(tok, ["soldado", "soldados"]) && !has(tok, ["misto", "mistura"]) ? "soldados" : undefined;
    return { type: "army", count: amount ?? undefined, style };
  }
  const biome = findKey(tok, BIOMES);
  if (biome && has(tok, ["bioma", "transforma", "transformar", "transforme", "muda", "mudar", "mude", "vira", "virar", "deixa", "faz"])) {
    return { type: "biome", biome };
  }
  // catálogo de 1000+ construções: "faz uma padaria pequena estilo japonês", "constrói uma fonte"
  const ar = findArch(tok);
  if (ar.kind && (has(tok, V.build) || has(tok, V.craft) || has(tok, ["quero", "queria", "bora", "vamos", "cria", "gera", "ergue", "monta"]))) {
    const strong = !!(ar.style || ar.size);
    const megaHit = findKey(tok, MEGA);
    const megaLen = megaHit ? Math.max(...MEGA[megaHit].w.filter((w) => ` ${tok.join(" ")} `.includes(` ${w} `) || tok.includes(w)).map((w) => w.length), 0) : 0;
    const bpHit = findBlueprint(tok);
    if ((!megaHit || strong || ar.len > megaLen) && (!bpHit || strong || ar.multi)) {
      return { type: "arch", kind: ar.kind, style: ar.style ?? undefined, size: ar.size ?? undefined, here };
    }
  }
  const mega = findKey(tok, MEGA);
  if (mega && (has(tok, V.build) || has(tok, V.craft) || has(tok, ["quero", "queria", "bora", "vamos", "cria", "gera"]) || tok.length <= 3)) {
    return { type: "mega", key: mega, here };
  }
  const form = findKey(tok, FORM_WORDS);
  if (form && (has(tok, TRANSFORM) || tok.length <= 2 || form === "colossus")) return { type: "form", form };
  if (has(tok, V.turret)) return { type: "turret" };
  if (has(tok, V.scan)) return { type: "scan" };
  if (has(tok, V.ride)) return { type: "ride" };
  if (has(tok, V.missions)) return { type: "missions" };
  if (has(tok, V.sethome)) return { type: "sethome" };
  if (has(tok, V.home)) return { type: "home" };
  if (has(tok, V.deposit)) return { type: "deposit" };
  if (has(tok, V.torches)) return { type: "torches", count: amount ?? 16 };

  // construção (antes de "faz", porque "faz uma casa" é construção)
  const bp = findBlueprint(tok);
  if (bp && (has(tok, V.build) || has(tok, V.craft) || has(tok, ["quero", "queria", "precisamos", "precisa", "vamos"]))) {
    if (bp === "fazenda") return { type: "farm", here, crop: cropOf(tok) };
    return { type: "build", blueprint: bp, here };
  }
  if (has(tok, V.farmv) || (bp === "fazenda")) return { type: "farm", here, crop: cropOf(tok) };

  if (has(tok, V.give) || has(tok, ["quero", "preciso", "manda"]) && (findCreative(tok) || findTool(tok))) {
    if (has(tok, ["tudo", "todas", "todos", "everything", "all"])) return { type: "give", all: true };
    const tool = findTool(tok);
    if (tool?.armor && has(tok, ["armadura", "armaduras"]) && !has(tok, ["capacete", "peitoral", "calca", "bota", "botas"])) {
      return { type: "kit", armorOnly: true, tier: tool.tier };
    }
    const cre = !tool && findCreative(tok);
    if (cre && !findItem(tok)?.group) return { type: "give", item: { id: cre.id }, count: amount ?? cre.n ?? 1, creative: true };
    if (tool) return { type: "give", item: tool.id ? { id: tool.id } : { toolKind: tool.kind }, count: amount ?? 1 };
    const it = findItem(tok);
    if (it) {
      const food = it.group === "food";
      return { type: food ? "food" : "give", item: lexTarget(it), count: amount ?? (food ? 8 : undefined), forOwner: true };
    }
    return { type: "give", all: true };
  }

  if (has(tok, V.protect)) return { type: "protect" };
  if (has(tok, V.come)) return { type: "come" };
  if (has(tok, V.stop) || (tok.length === 1 && ["para", "deixa", "chega"].includes(tok[0]))) return { type: "stop" };
  if (has(tok, V.pause)) return { type: "pause" };
  if (has(tok, V.resume)) return { type: "resume" };
  if (has(tok, V.wake)) return { type: "wake" };
  if (has(tok, V.sleep)) return { type: "sleep" };
  if (has(tok, V.protect)) return { type: "protect" };
  if (has(tok, V.attack)) return { type: "attack" };
  if (has(tok, V.hunt)) return findItem(tok)?.group === "food" ? { type: "food", count: amount ?? 8, forOwner: true } : { type: "hunt", count: amount ?? 4 };
  if (has(tok, V.come)) return { type: "come" };
  if (has(tok, V.stay)) return { type: "stay" };
  if (has(tok, V.follow)) return { type: "follow" };
  if (has(tok, V.auto)) return { type: "auto" };
  if (has(tok, V.inventory)) return { type: "inventory" };

  // fabricar ferramenta/armadura/item
  const tool = findTool(tok);
  const item = findItem(tok);
  if (has(tok, V.craft) && (tool || item)) {
    if (tool) return { type: "craft", item: tool.id ? { id: tool.id } : { toolKind: tool.kind }, count: amount ?? 1 };
    if (item && item.group === "food") return { type: "food", count: amount ?? 8, forOwner: true };
    return { type: "craft", item: lexTarget(item), count: amount ?? item.def ?? 1 };
  }
  if (has(tok, V.explore)) {
    if (item) return { type: "gather", item: lexTarget(item), count: amount ?? item.def ?? 8, explore: true };
    return { type: "explore", here };
  }
  if (has(tok, V.gather) || item || tool) {
    if (tool) return { type: "craft", item: tool.id ? { id: tool.id } : { toolKind: tool.kind }, count: amount ?? 1 };
    if (item) {
      if (item.group === "food") return { type: "food", count: amount ?? 8, forOwner: !has(tok, ["pra voce", "para voce", "pra vc", "come voce", "se alimenta"]) };
      return { type: "gather", item: lexTarget(item), count: amount ?? item.def ?? 16 };
    }
    if (has(tok, ["minerar", "minera", "minere", "mine", "cava", "cavar", "cave"])) return { type: "gather", item: { id: "minecraft:cobblestone" }, count: amount ?? 32 };
  }
  if (has(tok, ["fome", "faminto", "faminta", "hungry"])) return { type: "food", count: 8, forOwner: true };
  if (has(tok, V.status)) return { type: "status" };
  if (has(tok, V.thanks)) return { type: "thanks" };
  if (has(tok, V.hello)) return { type: "hello" };
  return { type: "unknown", text: s };
}

function cropOf(tok) {
  if (has(tok, ["cenoura", "cenouras"])) return "minecraft:carrot";
  if (has(tok, ["batata", "batatas"])) return "minecraft:potato";
  if (has(tok, ["beterraba", "beterrabas"])) return "minecraft:beetroot_seeds";
  return "minecraft:wheat_seeds";
}

function lexTarget(e) {
  const t = {};
  if (e.id) t.id = e.id;
  if (e.group) t.group = e.group;
  if (e.ore) t.ore = e.ore;
  return t;
}

/** Descrição curta em pt-BR de uma intenção (para confirmações e o painel). */
export function describe(it) {
  switch (it.type) {
    case "gather": return `coletar ${it.count ?? ""} ${targetName(it.item)}`.replace(/\s+/g, " ");
    case "craft": return `fabricar ${it.count > 1 ? it.count + " " : ""}${targetName(it.item)}`;
    case "build": return `construir ${it.blueprint}${it.here ? " aqui" : ""}`;
    case "farm": return "fazer uma plantação";
    case "food": return it.forOwner ? "arranjar comida pra você" : "arranjar comida";
    case "give": return it.all ? "te entregar tudo" : `te entregar ${targetName(it.item)}`;
    case "mega": return `construir: ${MEGA[it.key]?.name ?? it.key}`;
    case "biome": return `transformar o lugar em ${BIOMES[it.biome]?.name ?? it.biome}`;
    case "form": return `virar ${it.form}`;
    case "army": return "modo exército";
    case "kit": return "te deixar mais forte";
    case "flatten": return it.all ? "destruir tudo em volta e deixar plano" : "aplainar o terreno em volta";
    case "vacuum": return "recolher os itens do chão";
    case "arch": return `construir: ${it.kind.replace(/_/g, " ")}${it.size ? ` ${it.size}` : ""}${it.style ? ` (${it.style})` : ""}`;
    case "swarm": return "enxame de nanorrobôs";
    case "power": return it.on ? "ligar" : "desligar";
    case "explore": return "explorar";
    case "hunt": return "caçar";
    case "torches": return "iluminar a área";
    default: return it.type;
  }
}

const NAMES = {
  log: "madeira", planks: "tábuas", food: "comida", coal: "carvão", wool: "lã", sapling: "mudas",
};
export function targetName(t) {
  if (!t) return "itens";
  if (t.toolKind) return { pickaxe: "picareta", axe: "machado", shovel: "pá", hoe: "enxada", sword: "espada" }[t.toolKind] ?? t.toolKind;
  if (t.group) return NAMES[t.group] ?? t.group;
  const id = String(t.id ?? "").replace("minecraft:", "");
  for (const e of ITEMS) if (e.id === t.id) return e.words[0];
  return id.replace(/_/g, " ");
}
