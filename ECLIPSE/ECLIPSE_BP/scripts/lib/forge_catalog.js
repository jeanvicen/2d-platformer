// Catálogo local da Forja de Sombras + busca por texto em PT-BR (assistente determinístico, offline).
import { normalize, similar, tokens } from "./text.js";

export const CATEGORIES = [
  { id: "relic", name: "Relíquias", icon: "textures/items/eclipse/eclipse_hammer" },
  { id: "tool", name: "Ferramentas", icon: "textures/items/eclipse/shadow_pickaxe" },
  { id: "equipment", name: "Equipamentos", icon: "textures/items/eclipse/eclipse_core" },
  { id: "wings", name: "Asas", icon: "textures/items/eclipse/wings_shadow" },
  { id: "creature", name: "Companheiros", icon: "textures/items/eclipse/legion_sigil" },
  { id: "element", name: "Elementos", icon: "textures/items/eclipse/element_prism" },
  { id: "construct", name: "Construções temporárias", icon: "textures/items/eclipse/shadow_hand" },
];

/** @typedef {{id:string,cat:string,name:string,desc:string,syn:string[],action:{type:string,key:string}}} Entry */
/** @type {Entry[]} */
export const CATALOG = [
  { id: "eclipse_hammer", cat: "relic", name: "Martelo do Eclipse", desc: "Lance e chame de volta. Raio estilizado no impacto.", syn: ["martelo", "martelo do eclipse", "hammer", "mjolnir", "martelo do thor", "thor", "marreta"], action: { type: "relic", key: "eclipse_hammer" } },
  { id: "eclipse_axe", cat: "relic", name: "Machado do Eclipse", desc: "Lançamento em espiral com retorno.", syn: ["machado", "machado do eclipse", "axe", "machadao", "stormbreaker"], action: { type: "relic", key: "eclipse_axe" } },
  { id: "shadow_sword", cat: "relic", name: "Espada Sombria", desc: "Investida cortante.", syn: ["espada", "espada sombria", "sword", "lamina", "katana"], action: { type: "relic", key: "shadow_sword" } },
  { id: "astral_spear", cat: "relic", name: "Lança Astral", desc: "Perfura em linha e volta sozinha.", syn: ["lanca", "lanca astral", "spear", "tridente", "arpao"], action: { type: "relic", key: "astral_spear" } },
  { id: "eclipse_scythe", cat: "relic", name: "Foice do Eclipse", desc: "Ceifa giratória que rouba vida.", syn: ["foice", "foice do eclipse", "scythe", "ceifadora"], action: { type: "relic", key: "eclipse_scythe" } },
  { id: "celestial_bow", cat: "relic", name: "Arco Celestial", desc: "Flechas de luz sem munição.", syn: ["arco", "arco celestial", "bow", "flecha", "flechas"], action: { type: "relic", key: "celestial_bow" } },
  { id: "guardian_shield", cat: "relic", name: "Escudo do Guardião", desc: "Égide de resistência e repulsão.", syn: ["escudo", "escudo do guardiao", "shield", "egide", "defesa"], action: { type: "relic", key: "guardian_shield" } },
  { id: "titan_gauntlets", cat: "relic", name: "Manoplas do Titã", desc: "Impacto sísmico.", syn: ["manopla", "manoplas", "luva", "luvas", "punho", "gauntlet", "soco"], action: { type: "relic", key: "titan_gauntlets" } },
  { id: "shadow_chains", cat: "relic", name: "Correntes de Sombra", desc: "Puxa criaturas ou te lança como gancho.", syn: ["corrente", "correntes", "gancho", "chain", "chains", "corda", "puxar"], action: { type: "relic", key: "shadow_chains" } },
  { id: "shadow_pickaxe", cat: "tool", name: "Picareta de Sombra", desc: "Minera muito rápido (temporária).", syn: ["picareta", "pickaxe", "minerar", "picareta de sombra"], action: { type: "tool", key: "shadow_pickaxe" } },
  { id: "shadow_axe_tool", cat: "tool", name: "Machado de Sombra (ferramenta)", desc: "Corta madeira rápido (temporária).", syn: ["machado de ferramenta", "machado de cortar", "cortar madeira", "lenhador"], action: { type: "tool", key: "shadow_axe_tool" } },
  { id: "shadow_shovel", cat: "tool", name: "Pá de Sombra", desc: "Cava terra e areia rápido (temporária).", syn: ["pa", "pa de sombra", "shovel", "cavar"], action: { type: "tool", key: "shadow_shovel" } },
  { id: "eclipse_core", cat: "equipment", name: "Núcleo do Eclipse", desc: "Seu núcleo de poder (recuperar).", syn: ["nucleo", "core", "orbe", "nucleo do eclipse"], action: { type: "item", key: "eclipse_core" } },
  { id: "codex", cat: "equipment", name: "Códice do Eclipse", desc: "O manual completo.", syn: ["codice", "livro", "manual", "grimorio", "codex", "guia"], action: { type: "item", key: "codex" } },
  { id: "legion_sigil", cat: "equipment", name: "Selo da Legião", desc: "Invocar e recolher criaturas.", syn: ["selo", "selo da legiao", "invocar", "invocacao", "legiao"], action: { type: "item", key: "legion_sigil" } },
  { id: "power_sigil", cat: "equipment", name: "Selo do Poder", desc: "Técnicas do seu Modo.", syn: ["selo do poder", "poder", "poderes", "tecnica"], action: { type: "item", key: "power_sigil" } },
  { id: "form_essence", cat: "equipment", name: "Essência da Forma", desc: "Metamorfose.", syn: ["essencia", "forma", "metamorfose", "transformar", "transformacao"], action: { type: "item", key: "form_essence" } },
  { id: "shadow_hand", cat: "equipment", name: "Mão da Sombra", desc: "Criar e manipular.", syn: ["mao", "mao da sombra", "criar", "manipular", "telecinese"], action: { type: "item", key: "shadow_hand" } },
  { id: "element_prism", cat: "equipment", name: "Prisma dos Elementos", desc: "Troca de elemento (Haze).", syn: ["prisma", "elementos", "elemento", "trocar elemento"], action: { type: "item", key: "element_prism" } },
  { id: "lyra_bond", cat: "equipment", name: "Laço de Lyra", desc: "Chame e fale com Lyra.", syn: ["laco", "laco de lyra", "fita", "amuleto da lyra"], action: { type: "item", key: "lyra_bond" } },
  { id: "wings_shadow", cat: "wings", name: "Asas Negras", desc: "Penas negras de pontas violetas.", syn: ["asas", "asa", "voar", "asas negras", "wings", "penas"], action: { type: "wings", key: "wings_shadow" } },
  { id: "wings_celestial", cat: "wings", name: "Asas Celestiais", desc: "Prata e ouro.", syn: ["asas celestiais", "asas de anjo", "anjo", "angelical", "asas douradas", "asas brancas"], action: { type: "wings", key: "wings_celestial" } },
  { id: "wings_void", cat: "wings", name: "Asas do Vazio", desc: "Energia violeta.", syn: ["asas do vazio", "asas de energia", "asas roxas", "vazio"], action: { type: "wings", key: "wings_void" } },
  { id: "wings_dragon", cat: "wings", name: "Asas de Dragão", desc: "Membrana couraçada.", syn: ["asas de dragao", "dragao asas", "asas de morcego", "membrana"], action: { type: "wings", key: "wings_dragon" } },
  { id: "c_umbra", cat: "creature", name: "Umbra — Lobo das Sombras", desc: "Lobo colossal.", syn: ["lobo", "cao sombrio", "cachorro", "cao", "wolf", "umbra"], action: { type: "creature", key: "umbra" } },
  { id: "c_nyx", cat: "creature", name: "Nyx — Pantera do Eclipse", desc: "Felina furtiva.", syn: ["pantera", "gato", "felino", "onca", "nyx"], action: { type: "creature", key: "nyx" } },
  { id: "c_aegis", cat: "creature", name: "Aegis — Guardião Blindado", desc: "Cavaleiro de aço.", syn: ["guardiao", "cavaleiro", "soldado", "armadura", "aegis"], action: { type: "creature", key: "aegis" } },
  { id: "c_nox", cat: "creature", name: "Nox — Dragão Negro", desc: "Dragão voador.", syn: ["dragao", "dragon", "nox", "dragao negro"], action: { type: "creature", key: "nox" } },
  { id: "c_vesper", cat: "creature", name: "Vesper — Fênix Sombria", desc: "Ave de chamas violetas.", syn: ["fenix", "passaro de fogo", "phoenix", "vesper"], action: { type: "creature", key: "vesper" } },
  { id: "c_corvus", cat: "creature", name: "Corvus — Corvos de Exploração", desc: "Batedores.", syn: ["corvo", "corvos", "passaro", "passaros", "raven", "corvus"], action: { type: "creature", key: "corvus" } },
  { id: "c_serpent", cat: "creature", name: "Serpent — Serpente Sombria", desc: "Serpente articulada.", syn: ["cobra", "serpente", "snake", "naja"], action: { type: "creature", key: "serpent" } },
  { id: "c_stag", cat: "creature", name: "Stag — Cervo Astral", desc: "Cervo de chifres de cristal.", syn: ["cervo", "veado", "alce", "stag", "rena"], action: { type: "creature", key: "stag" } },
  { id: "c_golem", cat: "creature", name: "Golem — Colosso de Sombra", desc: "Titã de pedra.", syn: ["golem", "colosso", "gigante", "titan de pedra"], action: { type: "creature", key: "golem" } },
  { id: "c_manta", cat: "creature", name: "Manta — Arraia das Sombras", desc: "Arraia planadora.", syn: ["manta", "arraia", "raia", "peixe voador"], action: { type: "creature", key: "manta" } },
  { id: "c_lyra", cat: "creature", name: "Lyra — a Sombra Viva", desc: "Ajudante que coleta, caça, explora e constrói.", syn: ["lyra", "garota", "menina", "ajudante", "sombra humana", "npc"], action: { type: "lyra", key: "lyra" } },
  { id: "e_fire", cat: "element", name: "Elemento: Fogo", desc: "Projéteis incendiários.", syn: ["fogo", "chama", "fire", "calor"], action: { type: "element", key: "fire" } },
  { id: "e_water", cat: "element", name: "Elemento: Água", desc: "Empurra e apaga fogo.", syn: ["agua", "water", "onda", "mare"], action: { type: "element", key: "water" } },
  { id: "e_earth", cat: "element", name: "Elemento: Terra", desc: "Pedras e muralhas.", syn: ["terra", "pedra", "earth", "rocha"], action: { type: "element", key: "earth" } },
  { id: "e_air", cat: "element", name: "Elemento: Ar", desc: "Rajadas e saltos.", syn: ["ar", "vento", "air", "rajada"], action: { type: "element", key: "air" } },
  { id: "e_lightning", cat: "element", name: "Elemento: Relâmpago", desc: "Raios em cadeia.", syn: ["raio", "relampago", "eletricidade", "lightning", "trovao"], action: { type: "element", key: "lightning" } },
  { id: "e_ice", cat: "element", name: "Elemento: Gelo", desc: "Congela e desacelera.", syn: ["gelo", "ice", "neve", "congelar"], action: { type: "element", key: "ice" } },
  { id: "e_nature", cat: "element", name: "Elemento: Natureza", desc: "Raízes e cura.", syn: ["natureza", "raiz", "raizes", "planta", "folhas", "nature"], action: { type: "element", key: "nature" } },
  { id: "k_platform", cat: "construct", name: "Plataforma de Sombra", desc: "5×5 sob/à sua frente.", syn: ["plataforma", "chao", "piso", "base"], action: { type: "construct", key: "platform" } },
  { id: "k_bridge", cat: "construct", name: "Ponte de Sombra", desc: "Ponte na direção do olhar.", syn: ["ponte", "bridge", "passarela", "travessia"], action: { type: "construct", key: "bridge" } },
  { id: "k_stairs", cat: "construct", name: "Escadaria de Sombra", desc: "Degraus subindo à frente.", syn: ["escada", "escadaria", "degrau", "degraus", "subir"], action: { type: "construct", key: "stairs" } },
  { id: "k_wall", cat: "construct", name: "Barreira de Sombra", desc: "Muro defensivo à frente.", syn: ["barreira", "muro", "parede", "muralha", "protecao"], action: { type: "construct", key: "wall" } },
  { id: "k_pillar", cat: "construct", name: "Pilar Ascendente", desc: "Ergue você no alto.", syn: ["pilar", "coluna", "torre", "elevador"], action: { type: "construct", key: "pillar" } },
  { id: "k_lantern", cat: "construct", name: "Lanterna Sombria", desc: "Luz temporária.", syn: ["lanterna", "luz", "tocha", "iluminar", "lampada"], action: { type: "construct", key: "lantern" } },
  { id: "k_dome", cat: "construct", name: "Cúpula de Refúgio", desc: "Abrigo ao seu redor.", syn: ["cupula", "abrigo", "refugio", "bolha", "esconderijo"], action: { type: "construct", key: "dome" } },
];

export const NOT_FOUND = "Ainda não existe essa criação no catálogo. Escolha uma opção disponível ou desbloqueie novas receitas.";

/** Busca por texto: retorna entradas ordenadas por relevância. */
export function searchCatalog(query, limit = 6) {
  const q = normalize(query);
  if (!q) return [];
  const qt = tokens(q).filter((t) => !["o", "a", "um", "uma", "de", "do", "da", "quero", "me", "da", "faz", "cria", "criar", "fazer", "invoca", "invocar", "materializa", "materializar", "um", "pra", "para", "mim"].includes(t));
  const scored = [];
  for (const e of CATALOG) {
    let score = 0;
    const name = normalize(e.name);
    if (name === q) score += 100;
    for (const s of e.syn) {
      const ns = normalize(s);
      if (q === ns) score += 80;
      else if (q.includes(ns) && ns.length >= 3) score += 30 + ns.length;
    }
    for (const t of qt) {
      for (const s of e.syn) {
        for (const st of tokens(s)) {
          if (t === st) score += 12;
          else if (similar(t, st)) score += 6;
        }
      }
      if (name.includes(t) && t.length >= 3) score += 4;
    }
    if (score > 0) scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.e);
}
