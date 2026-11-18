/**
 * Natural Language Interpreter (PT-BR). Pure, rule-based, works offline.
 *
 * Input:  free text from the owner ("Pegue 32 troncos e volte", "consegue pegar uns troncos?").
 * Output: ParseResult with ordered intents, or a short clarification question when an essential
 *         piece is missing. It never guesses when the ambiguity matters (e.g. "pegue" with no object).
 */
import type { Clarification, Intent, IntentKind, MaterialKind, ParseResult, ResourceKind, StructureKind, TargetRef } from "../core/types";
import { firstNumber, normalize } from "./normalize";

// ---------------------------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------------------------
const RESOURCE_WORDS: [RegExp, ResourceKind][] = [
  [/\bmateria(l|is) (de|para) constru(cao|coes|ir)\b/, "wood"],
  [/\b(madeiras?|troncos?|lenha|toras?|arvores?)\b/, "wood"],
  [/\b(carnes?)\b/, "meat"],
  [/\b(comidas?|alimentos?|alimentacao|rango|comer|algo para comer)\b/, "food"],
  [/\b(paes|pao)\b/, "food"],
  [/\b(carvao|carvoes)\b/, "coal"],
  [/\b(ferros?)\b/, "iron"],
  [/\b(ouros?)\b/, "gold"],
  [/\b(cobres?)\b/, "copper"],
  [/\b(diamantes?)\b/, "diamond"],
  [/\b(redstone|pedra vermelha)\b/, "redstone"],
  [/\b(lapis|lapis lazuli)\b/, "lapis"],
  [/\b(esmeraldas?)\b/, "emerald"],
  [/\b(minerios?|minerais)\b/, "ore"],
  [/\b(pedras?|pedregulhos?|rochas?|cobblestone|cobble)\b/, "stone"],
  [/\b(areia)\b/, "sand"],
  [/\b(terra)\b/, "dirt"],
  [/\b(cascalho)\b/, "gravel"],
  [/\b(trigos?)\b/, "wheat"],
  [/\b(cenouras?)\b/, "carrot"],
  [/\b(batatas?)\b/, "potato"],
  [/\b(beterrabas?)\b/, "beetroot"],
  [/\b(frutinhas?|bagas?|amoras?|berries)\b/, "berries"],
];

const MOBS: [RegExp, string][] = [
  [/\bzumbis?\b/, "minecraft:zombie"],
  [/\besqueletos?\b/, "minecraft:skeleton"],
  [/\baranhas?\b/, "minecraft:spider"],
  [/\bcreepers?\b/, "minecraft:creeper"],
  [/\bbruxas?\b/, "minecraft:witch"],
  [/\bslimes?\b/, "minecraft:slime"],
  [/\bafogados?\b/, "minecraft:drowned"],
  [/\b(saqueadores?|pillagers?)\b/, "minecraft:pillager"],
  [/\b(phantoms?|fantasmas?)\b/, "minecraft:phantom"],
  [/\bendermans?\b/, "minecraft:enderman"],
  [/\bporcos?\b/, "minecraft:pig"],
  [/\b(vacas?|bois?)\b/, "minecraft:cow"],
  [/\bgalinhas?\b/, "minecraft:chicken"],
  [/\bovelhas?\b/, "minecraft:sheep"],
  [/\bcoelhos?\b/, "minecraft:rabbit"],
];

const STRUCTURES: [RegExp, StructureKind][] = [
  [/\b(mansao|mansoes|castelo|palacio|sobrado)\b/, "mansion"],
  [/\b(casa grande|casarao|casa bonita|casa completa|casa decorada|casa de verdade|casa boa)\b/, "house"],
  [/\b(casa|casinha|cabana|abrigo|barraco|refugio)\b/, "hut"],
  [/\b(torre|torrezinha)\b/, "tower"],
  [/\b(muro|muralha|parede)\b/, "wall"],
  [/\b(ponte)\b/, "bridge"],
  [/\b(plataforma|chao|piso|base)\b/, "platform"],
  [/\b(pilar|coluna)\b/, "pillar"],
];

const MATERIALS: [RegExp, MaterialKind][] = [
  [/\b(de|com) (tabuas?|madeira)\b/, "planks"],
  [/\b(de|com) (pedra|pedregulho|cobblestone)\b/, "cobblestone"],
  [/\b(de|com) (troncos?|toras?)\b/, "log"],
  [/\b(de|com) (pedra lisa)\b/, "stone"],
  [/\b(de|com) terra\b/, "dirt"],
];

const CRAFT_ITEMS: [RegExp, string][] = [
  [/\b(tabuas?)\b/, "planks"],
  [/\b(gravetos?|varetas?|palitos?)\b/, "stick"],
  [/\b(bancada|mesa de (trabalho|craft|criacao)|crafting table)\b/, "crafting_table"],
  [/\b(tochas?)\b/, "torch"],
  [/\b(baus?)\b/, "chest"],
  [/\b(fornalhas?|fornos?)\b/, "furnace"],
  [/\b(paes|pao)\b/, "bread"],
  [/\b(escadas? de mao|escadinhas?)\b/, "ladder"],
  [/\b(picaretas?)\b/, "pickaxe"],
  [/\b(machados?)\b/, "axe"],
  [/\b(pas)\b|\bpa de\b/, "shovel"],
  [/\b(espadas?)\b/, "sword"],
  [/\b(enxadas?)\b/, "hoe"],
];

const TIERS: [RegExp, string][] = [
  [/\bde madeira\b/, "wooden"],
  [/\bde pedra\b/, "stone"],
  [/\bde ferro\b/, "iron"],
  [/\bde ouro\b/, "golden"],
  [/\bde diamante\b/, "diamond"],
  [/\bde netherite\b/, "netherite"],
];

// verbs / phrases
const V = {
  cancel: /\b(cancel\w*|pare|parem|para tudo|para agora|para com isso|esquece\w*|chega|abort\w*|desist\w*|deixa para la)\b/,
  dismiss: /\b(pode ir|dispens\w*|some daqui|desaparec\w*|va embora|vai embora|pode sumir|descans\w+ agora)\b/,
  pause: /\b(paus\w*|espera um pouco|segura ai)\b/,
  resume: /\b(continu\w+|retom\w+|volta ao trabalho|volte ao trabalho|pode seguir com)\b/,
  why: /\bpor que (voce )?(parou|esta parad\w|nao (fez|terminou|conseguiu|foi|esta))\b|\b(o que aconteceu|qual o problema)\b/,
  progress: /\b(conseguiu|terminou|acabou|ja (pegou|terminou|acabou)|deu certo|ta pronto|esta pronto|e ai como foi)\b/,
  inventory: /\b(inventario|mochila|o que voce (tem|carrega|pegou|esta carregando)|seus itens|quais itens)\b/,
  status: /\b(status|como voce esta|como esta voce|tudo bem com voce|sua vida|sua fome|esta com fome|o que voce esta fazendo|o que esta fazendo)\b/,
  help: /\b(ajuda|comandos|o que voce (sabe|pode|consegue) fazer|como funciona)\b/,
  greet: /\b(oi|ola|eai|e ai|bom dia|boa tarde|boa noite|salve|hey)\b/,
  thanks: /\b(obrigad\w*|valeu|vlw|brigad\w*|agradec\w*)\b/,
  compliment: /\b(linda|fofa|bonita|incrivel|perfeita|mandou bem|boa garota|maravilhosa|fodona|braba)\b/,
  deliver: /\b(me (de|da|deem|de ai|entreg\w+|pass\w+|mand\w+|jog\w+)|entreg\w+|devolv\w+|da para mim|de para mim|deem para mim|passa para mim|me traga o que)\b/,
  eat: /\b(come|coma|comam|comer agora|se aliment\w+|mata (a|sua) fome|matem a fome)\b/,
  attack: /\b(ataca\w*|ataque\w*|mata|mate|matem|matar|bate|bata|batam|elimin\w+|acaba com|acabe com|acabem com|derrota\w*|luta com|lute com|lutem com)\b/,
  hunt: /\b(caca|cace|cacar|cacem|caçe)\b/,
  protect: /\b(me proteja|me protejam|protejam me|proteja me|me protege|protege\b|protejam|proteger|me defend\w+|defend\w+|guarda costas|cuide de mim|cuidem de mim|cuida de mim|fique (perto|do meu lado|comigo)|fiquem (perto|do meu lado|comigo)|fica (perto|do meu lado|comigo)|ao meu lado)\b/,
  guard: /\b(guard\w* (essa|esta|a|o|aqui|isso|area|casa|base)|vigi\w+|fique de guarda|fiquem de guarda|fica de guarda|sentinela|proteja (essa|esta|a|o) (area|casa|base|lugar)|defenda (essa|esta|a) (area|casa|base))\b/,
  stay: /\b(fica aqui|fique aqui|fiquem aqui|espera aqui|espere( aqui)?|esperem( aqui)?|nao se mexa|nao se mexam|fique parad\w|fiquem parad\w|fica parad\w|aguard\w+ aqui|parad[ao]s? ai)\b/,
  follow: /\b(me seg\w+|me sigam|sigam me|sigam|segue|segu\w+ me|siga|siga me|vem comigo|venha comigo|venham comigo|me acompanh\w+|acompanh\w+ me)\b/,
  ret: /\b(volt\w*|retorn\w+|vem aqui|venha aqui|venham aqui|vem ca|venha ca|venham ca|cola aqui|chega aqui)\b/,
  build: /\b(construa|construir|constroi|construi|construam|construe|construa|monte|montar|monta|montem|levante|levantar|ergu\w+|edifiqu\w+)\b/,
  makeStructure: /\b(fa(ca|z|zer|cam)|cria|crie|criar|criem) (uma|um|a|o)? ?(casa|casinha|casarao|mansao|castelo|cabana|abrigo|barraco|torre|muro|muralha|parede|ponte|plataforma|pilar|coluna|chao|piso)\b/,
  craft: /\b(fabriqu\w+|fabric\w+|crie|criem|criar|cria|faca|facam|faz|fazer|produz\w*|craft\w*)\b/,
  cook: /\b(cozinh\w+|asse|assa|assar|frit\w+|frite|grelh\w+|torr\w+|fund\w+|derret\w+)\b/,
  farm: /\b(plant\w+|colh\w+|replant\w+|cultiv\w+|semei\w+|horta|plantacao|fazenda)\b/,
  mine: /\b(miner\w+|cav\w+|escav\w+)\b/,
  destroy: /\b(quebr\w+|destr[uo]\w*|derrub\w+|demol\w+|arrebent\w+)\b/,
  equip: /\b(equip\w+|empunh\w+|segur\w+ (o|a|seu|sua)|use (o|a|seu|sua)|usa (o|a|seu|sua))\b/,
  gather: /\b(peg\w*|busc\w+|colet\w+|consig\w+|consegu\w+|arrum\w+|junt\w+|traz|traga|trazer|tragam|corte|cortar|corta|preciso( de)?|precisamos|quero|queria|me arranj\w+|arranj\w+|obtenha|obter|recolh\w+|cat\w+ |procur\w+|ache|achar|encontr\w+)\b/,
  keep: /\b(guarde (a|o|os|as)|fique com|fica com|pode ficar|para voce|na sua mochila)\b/,
  urgent: /\b(urgente|rapido|imediatamente|agora|ja|correndo|depressa|logo)\b/,
  thisThing: /\b(isso|isto|esse|essa|este|esta|aquele|aquela|aquilo|ele|ela|alvo)\b/,
  everything: /\b(tudo|todos|todas|todo o|toda a)\b/,
  hole: /\b(buraco|cova|vala|tunel)\b/,
};

const DEFAULT_QTY: Partial<Record<ResourceKind, number>> = {
  wood: 16, food: 6, meat: 6, stone: 32, coal: 8, iron: 8, gold: 6, copper: 8, diamond: 3, redstone: 8, lapis: 8,
  emerald: 2, ore: 8, sand: 16, dirt: 16, gravel: 8, wheat: 9, carrot: 8, potato: 8, beetroot: 8, berries: 8,
};

function findResource(s: string): ResourceKind | undefined {
  for (const [re, r] of RESOURCE_WORDS) if (re.test(s)) return r;
  return undefined;
}

function findMob(s: string): string | undefined {
  for (const [re, m] of MOBS) if (re.test(s)) return m;
  return undefined;
}

function findStructure(s: string): StructureKind | undefined {
  for (const [re, k] of STRUCTURES) if (re.test(s)) return k;
  return undefined;
}

function findMaterial(s: string): MaterialKind | undefined {
  for (const [re, k] of MATERIALS) if (re.test(s)) return k;
  return undefined;
}

function findCraftItem(s: string): { item: string; tier?: string } | undefined {
  for (const [re, k] of CRAFT_ITEMS) {
    if (re.test(s)) {
      if (["pickaxe", "axe", "shovel", "sword", "hoe"].includes(k)) {
        let tier: string | undefined;
        for (const [tr, t] of TIERS) if (tr.test(s)) tier = t;
        return { item: k, tier };
      }
      return { item: k };
    }
  }
  return undefined;
}

function quantity(s: string): number | undefined {
  const n = firstNumber(s);
  if (n !== undefined && n > 0) return Math.min(n, 512);
  if (/\b(muitos?|muitas?|bastante|um monte|varios|varias)\b/.test(s)) return 64;
  if (/\b(poucos?|poucas?|um pouco)\b/.test(s)) return 8;
  return undefined;
}

function mk(kind: IntentKind, raw: string, extra: Partial<Intent> = {}): Intent {
  return { kind, priority: "normal", raw, ...extra };
}

// ---------------------------------------------------------------------------------------------
// Clause splitting
// ---------------------------------------------------------------------------------------------
export function splitClauses(s: string): string[] {
  const marked = s
    .replace(/\s*,\s*/g, " | ")
    .replace(/\b(e depois|depois disso|depois|e entao|entao|em seguida|e em seguida|e logo apos|e por fim|por fim|e tambem|tambem)\b/g, " | ")
    .replace(/\b e (?=(volte|volta|vem|venha|retorne|me|pegue|pega|busque|traga|traz|consiga|construa|faca|faz|mate|ataque|cace|minere|cave|cozinhe|coma|entregue|siga|proteja|guarde|fique|fica|corte|colha|plante|quebre|derrube|equipe|use|depois|crie|fabrique|monte|arrume|junte))/g, " | ")
    .replace(/\s+e\s+(?=[a-z]+s?\b)/g, (m) => m); // keep "madeira e comida" for resource-level split
  return marked
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

// ---------------------------------------------------------------------------------------------
// Clause interpretation
// ---------------------------------------------------------------------------------------------
interface ClauseResult {
  intents: Intent[];
  clarification?: Clarification;
}

function clause(c: string, prev: Intent | undefined): ClauseResult {
  const urgent = V.urgent.test(c);
  const pri: Intent["priority"] = urgent ? "high" : "normal";
  const q = quantity(c);

  // --- control ---------------------------------------------------------------------------
  if (c === "para" || c === "pare" || V.cancel.test(c)) {
    const r: Intent[] = [mk("cancel", c, { priority: "high" })];
    if (V.ret.test(c)) r.push(mk("return", c, { priority: "high" }));
    return { intents: r };
  }
  if (V.dismiss.test(c)) return { intents: [mk("dismiss", c)] };
  if (V.why.test(c)) return { intents: [mk("why", c)] };
  if (V.progress.test(c) && !V.gather.test(c.replace(/\bconseguiu\b/, ""))) return { intents: [mk("progress", c)] };
  if (V.pause.test(c)) return { intents: [mk("pause", c)] };
  if (V.resume.test(c)) return { intents: [mk("resume", c)] };
  if (V.help.test(c)) return { intents: [mk("help", c)] };
  if (V.inventory.test(c)) return { intents: [mk("inventory", c)] };
  if (V.status.test(c)) return { intents: [mk("status", c)] };

  // --- delivery ("me dá madeira", "me entrega tudo") ------------------------------------------
  if (V.deliver.test(c)) {
    const res = findResource(c);
    const ci = findCraftItem(c);
    const all = V.everything.test(c) || (!res && !ci);
    return { intents: [mk("deliver", c, { resource: res, item: ci?.item, quantity: q, all, priority: pri })] };
  }

  // --- combat --------------------------------------------------------------------------------
  if (V.hunt.test(c)) {
    const mob = findMob(c);
    return { intents: [mk("hunt", c, { resource: "meat", quantity: q ?? 4, target: mob ? { kind: "mob", mob } : undefined, allowHunting: true, priority: pri, deliver: !V.keep.test(c) })] };
  }
  if (V.attack.test(c)) {
    const mob = findMob(c);
    let target: TargetRef | undefined;
    if (mob) target = { kind: "mob", mob };
    else if (/\b(monstros?|inimigos?|hostis|bichos)\b/.test(c)) target = { kind: "hostiles" };
    else if (V.thisThing.test(c)) target = { kind: "view" };
    if (!target) {
      return {
        intents: [],
        clarification: {
          question: "Atacar quem? Olhe para o alvo e diga 'ataque aquele', ou diga o tipo (zumbi, esqueleto...).",
          options: [
            { label: "O que estou olhando", text: "ataque aquele" },
            { label: "Monstros por perto", text: "ataque os monstros" },
          ],
          context: "",
        },
      };
    }
    return { intents: [mk("attack", c, { target, priority: "high" })] };
  }

  // --- modes ---------------------------------------------------------------------------------
  if (V.guard.test(c)) return { intents: [mk("guard", c, { priority: pri })] };
  if (V.protect.test(c)) return { intents: [mk("protect", c, { priority: pri })] };
  if (V.stay.test(c)) return { intents: [mk("stay", c, { priority: pri })] };
  if (V.follow.test(c)) return { intents: [mk("follow", c, { priority: pri })] };

  // --- eating ---------------------------------------------------------------------------------
  if (V.eat.test(c) && !/\b(comida|para comer|algo para comer)\b/.test(c)) return { intents: [mk("eat", c)] };

  // --- building ----------------------------------------------------------------------------
  const structure = findStructure(c);
  if (V.build.test(c) || V.makeStructure.test(c)) {
    if (!structure) {
      return {
        intents: [],
        clarification: {
          question: "Construir o quê? Tenho plantas de: casa grande, mansão, casinha, muro, plataforma, ponte, pilar e torre.",
          options: [
            { label: "Casa grande", text: "construa uma casa grande" },
            { label: "Mansão", text: "construa uma mansao" },
            { label: "Casinha", text: "construa uma casinha" },
            { label: "Muro", text: "construa um muro" },
            { label: "Plataforma", text: "construa uma plataforma" },
            { label: "Ponte", text: "construa uma ponte" },
            { label: "Torre", text: "construa uma torre" },
          ],
          context: "",
        },
      };
    }
    return { intents: [mk("build", c, { structure, material: findMaterial(c), size: q, priority: pri })] };
  }

  // --- cooking / smelting ----------------------------------------------------------------------
  if (V.cook.test(c)) {
    return { intents: [mk("cook", c, { resource: findResource(c), quantity: q, priority: pri })] };
  }

  // --- farming -------------------------------------------------------------------------------
  if (V.farm.test(c)) return { intents: [mk("farm", c, { quantity: q, priority: pri, deliver: !V.keep.test(c) })] };

  // --- equip -----------------------------------------------------------------------------------
  if (V.equip.test(c)) {
    const ci = findCraftItem(c);
    if (ci) return { intents: [mk("equip", c, { item: ci.item, tier: ci.tier })] };
    if (/\b(armadura|capacete|peitoral|calca|botas?|escudo)\b/.test(c)) return { intents: [mk("equip", c, { item: "armor" })] };
  }

  // --- destroy / dig -----------------------------------------------------------------------
  if (V.destroy.test(c) || (V.mine.test(c) && V.hole.test(c))) {
    if (V.hole.test(c)) {
      const n = q ?? 3;
      return { intents: [mk("destroy", c, { target: { kind: "area", w: Math.min(n, 7), d: Math.min(n, 7), h: Math.min(n, 5) }, priority: pri })] };
    }
    if (/\barvores?\b/.test(c)) return { intents: [mk("gather", c, { resource: "wood", quantity: q ?? 64, target: { kind: "tree" }, deliver: !V.keep.test(c), priority: pri })] };
    const res = findResource(c);
    if (res && res !== "wood") return { intents: [mk("mine", c, { resource: res, quantity: q ?? DEFAULT_QTY[res], deliver: !V.keep.test(c), priority: pri })] };
    return { intents: [mk("destroy", c, { target: { kind: "view" }, priority: pri })] };
  }

  // --- crafting ------------------------------------------------------------------------------
  const ci = findCraftItem(c);
  if (V.craft.test(c) && ci) {
    return { intents: [mk("craft", c, { item: ci.item, tier: ci.tier, quantity: q, priority: pri, deliver: !V.keep.test(c) })] };
  }

  // --- mining ----------------------------------------------------------------------------------
  const res = findResource(c);
  if (V.mine.test(c)) {
    const r = res && res !== "wood" && res !== "food" ? res : "stone";
    return { intents: [mk("mine", c, { resource: r, quantity: q ?? DEFAULT_QTY[r], deliver: !V.keep.test(c), priority: pri })] };
  }

  // --- gathering -------------------------------------------------------------------------------
  if (V.gather.test(c) || (res && (!prev || ["gather", "mine", "hunt"].includes(prev.kind)))) {
    if (!res) {
      if (ci && V.gather.test(c)) {
        return { intents: [mk("craft", c, { item: ci.item, tier: ci.tier, quantity: q, priority: pri, deliver: true })] };
      }
      return {
        intents: [],
        clarification: {
          question: "Pegar o quê? Madeira, comida, pedra, carvão, ferro...?",
          options: [
            { label: "Madeira", text: "pegue madeira" },
            { label: "Comida", text: "consiga comida" },
            { label: "Pedra", text: "pegue pedra" },
            { label: "Carvão", text: "minere carvao" },
            { label: "Ferro", text: "minere ferro" },
          ],
          context: "",
        },
      };
    }
    const deliver = !V.keep.test(c);
    const resources = allResources(c);
    const intents: Intent[] = [];
    for (const r of resources) {
      if (["coal", "iron", "gold", "copper", "diamond", "redstone", "lapis", "emerald", "ore", "stone"].includes(r)) {
        intents.push(mk("mine", c, { resource: r, quantity: q ?? DEFAULT_QTY[r], deliver, priority: pri }));
      } else if (r === "meat") {
        intents.push(mk("hunt", c, { resource: "meat", quantity: q ?? DEFAULT_QTY.meat, deliver, allowHunting: true, priority: pri }));
      } else if (["wheat", "carrot", "potato", "beetroot"].includes(r)) {
        intents.push(mk("farm", c, { resource: r, quantity: q ?? DEFAULT_QTY[r], deliver, priority: pri }));
      } else {
        intents.push(mk("gather", c, { resource: r, quantity: q ?? DEFAULT_QTY[r], deliver, priority: pri }));
      }
    }
    return { intents };
  }

  // --- return (after gather checks so "volte com madeira" still gathers first) ---------------
  if (V.ret.test(c)) return { intents: [mk("return", c, { priority: pri })] };

  if (V.thanks.test(c)) return { intents: [mk("thanks", c)] };
  if (V.compliment.test(c)) return { intents: [mk("compliment", c)] };
  if (V.greet.test(c)) return { intents: [mk("greet", c)] };
  return { intents: [mk("unknown", c)] };
}

/** "pegue madeira e comida" -> [wood, food] (keeps sentence order). */
function allResources(c: string): ResourceKind[] {
  const found: { idx: number; r: ResourceKind }[] = [];
  for (const [re, r] of RESOURCE_WORDS) {
    const m = re.exec(c);
    if (m && !found.some((f) => f.r === r)) found.push({ idx: m.index, r });
  }
  // "pao" alone counts as food; avoid double food entries
  return found.sort((a, b) => a.idx - b.idx).map((f) => f.r);
}

// ---------------------------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------------------------
export function interpret(text: string): ParseResult {
  const s = normalize(text);
  if (!s) return { intents: [], append: false, understood: false };
  const append = /^(depois|tambem|e depois|em seguida|quando terminar)\b/.test(s);
  const clauses = splitClauses(s);
  const intents: Intent[] = [];
  let clarification: Clarification | undefined;
  let prev: Intent | undefined;
  for (const c of clauses) {
    const r = clause(c, prev);
    if (r.clarification && !clarification) clarification = r.clarification;
    for (const it of r.intents) {
      intents.push(it);
      prev = it;
    }
  }
  // drop "unknown" clauses when something else was understood (e.g. "por favor")
  const known = intents.filter((i) => i.kind !== "unknown");
  const finalIntents = known.length ? known : intents;
  // An explicit trailing "volte" after work means: deliver to the owner at the end (default anyway)
  const understood = finalIntents.some((i) => i.kind !== "unknown") || !!clarification;
  return { intents: finalIntents, clarification, append, understood };
}
