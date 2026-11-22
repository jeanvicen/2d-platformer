// Catálogo dos 600 poderes (100 por raça). Cada raça escreve os seus em kits/<raça>.js como linhas
// "Nome|categoria|forma|efeitos no alvo;efeitos em você|recarga(s)|custo|parâmetros". Aqui elas
// viram objetos validados. Nada roda por tick sobre este catálogo: ele é dado estático.
//
// FORMAS (como o poder acha os alvos):
//   target   alvo na mira (alcance r)          proj      projétil que voa (r, spd)
//   volley   leque de n projéteis              lob       projétil em arco que estoura (blast)
//   boomerang vai e volta acertando             beam      raio instantâneo em linha
//   cone     cone na frente                    nova      explosão em volta de você
//   wave     onda que corre pelo chão           cross     cruz de 4 ondas
//   pillar   coluna que sobe sob o alvo         rain      n impactos caindo numa área
//   chain    salta entre n alvos               grab      puxa o alvo até você e golpeia
//   throw    agarra e arremessa                 slam      salta e cai com impacto
//   leapslam salto alto + meteoro               dash      avanço que atropela
//   leap     salto para frente com impacto      blink     teleporte curto
//   swap     troca de lugar com o alvo          tether    gancho: te puxa até o ponto mirado
//   orbit    lâminas girando em volta (dur)     zone      área persistente (dur)
//   vortex   redemoinho que puxa (dur)          trap      armadilha que dispara quando alguém pisa
//   dome     domo protetor temporário           wall      muro temporário
//   aura     alterna uma aura contínua          summon    invoca aliados de sombra/luz (dur)
//   self     efeitos em você                    ally      efeitos em você e aliados por perto
//   mark     marca o alvo (leva +25% de dano)   firetrail rastro de fogo por onde você passa
//   scan / orescan  revela criaturas / minérios  vacuum  puxa itens do chão
//   bridge / platform  constrói blocos temporários  light  luz que te acompanha
//   dig / clear / ashclear  abre caminho (respeita blocos protegidos)
//   recall  volta ao ponto de nascimento   calm  acalma monstros   smelt  funde minérios da mão
//   trade   troca vida por recurso          bloom  faz plantar florescer
//   special:<nome>  poderes únicos (morcego, dreno, voo, arma...)   passive:<nome> passivas
//
// EFEITOS: dmg (dano), heal, steal (% roubo de vida), bleed (sangramento s), burn (s), decay (s),
// blast (raio do estouro), kb/up/pull (empurrão/lançar/puxar), slow/weak/poison/wither/haste/
// strength/speed/jump/res/regen/slowfall (nível/ticks), stun/root/silence/lev/blind/dark/glow/
// invis/fireres/nv/wb (ticks), shield/absorb (nível), thorns (dano/ticks), mark, fear, cleanse,
// cleansefoe, execute (% da vida máxima), ignite, holy (bônus contra demônios/trevas/mortos-vivos),
// ash (cinzas: criaturas comuns fracas viram cinza), sat (comida), hurtself/weakself (custo em você),
// glowself, silencez (zona que silencia).
import vampire from "./kits/vampire.js";
import giant from "./kits/giant.js";
import angel from "./kits/angel.js";
import demon from "./kits/demon.js";
import god from "./kits/god.js";
import dark from "./kits/dark.js";

export const RACE_KITS = { vampire, giant, angel, demon, god, dark };
export const CATEGORIES = { pas: "Passiva", mov: "Movimento", off: "Ataque", def: "Defesa", uti: "Utilidade", sup: "Apoio", ctl: "Controle",
  tra: "Transformação", ult: "Suprema" };
export const SHAPES = ["target", "proj", "volley", "lob", "boomerang", "beam", "cone", "nova", "wave", "cross", "pillar", "rain", "chain", "grab", "throw",
  "slam", "leapslam", "dash", "leap", "blink", "swap", "tether", "orbit", "zone", "vortex", "trap", "dome", "wall", "aura", "summon", "self", "ally",
  "mark", "firetrail", "scan", "orescan", "vacuum", "bridge", "platform", "light", "dig", "clear", "ashclear", "recall", "calm", "smelt", "trade", "bloom", "pull"];
export const SPECIALS = ["bat", "drain", "sprint5x", "superjump", "flight", "weapon"];
export const PASSIVES = ["nv", "nightdmg", "lifesteal", "killheal", "nofall", "dodge", "lowhpres", "sprint", "giantstep", "giantstr", "giantres", "giantmine",
  "fallslam", "kbres", "ragedmg", "critkb", "fireimm", "halo", "winggrowth", "regenrace", "dayregen", "holyhit", "poisonimm", "burnhit", "lavaswim",
  "witherhit", "fearaura"];
export const EFFECTS = ["dmg", "heal", "steal", "bleed", "burn", "decay", "blast", "kb", "up", "pull", "slow", "weak", "poison", "wither", "haste", "strength",
  "speed", "jump", "res", "regen", "slowfall", "stun", "root", "silence", "lev", "blind", "dark", "glow", "invis", "fireres", "nv", "wb", "shield", "absorb",
  "thorns", "mark", "fear", "cleanse", "cleansefoe", "execute", "ignite", "holy", "ash", "sat", "hurtself", "weakself", "glowself", "silencez"];

function parseEffects(s) {
  const out = [];
  for (const raw of (s ?? "").split(",").map((x) => x.trim()).filter(Boolean)) {
    const m = /^([a-z]+?)(-?[\d.]+)?(?:\/(\d+))?$/.exec(raw);
    if (!m) throw new Error(`efeito inválido: ${raw}`);
    out.push({ k: m[1], a: m[2] !== undefined ? Number(m[2]) : 1, t: m[3] !== undefined ? Number(m[3]) : 0 });
  }
  return out;
}

function parseParams(s) {
  const p = {};
  for (const raw of (s ?? "").split(",").map((x) => x.trim()).filter(Boolean)) {
    const m = /^([a-z]+)([\d.]+)?$/.exec(raw);
    if (!m) throw new Error(`parâmetro inválido: ${raw}`);
    p[m[1]] = m[2] !== undefined ? Number(m[2]) : true;
  }
  return p;
}

/** @returns {any[]} */
function build() {
  const all = [];
  for (const [race, lines] of Object.entries(RACE_KITS)) {
    lines.forEach((line, i) => {
      const parts = line.split("|");
      if (parts.length === 8 && parts[4] === "") parts.splice(4, 1); // "efeitos||recarga" (sem efeitos em você)
      if (parts.length !== 7) throw new Error(`linha inválida (${race} #${i + 1}): ${line}`);
      const [name, cat, shape, fx, cd, cost, params] = parts;
      const [foe, self] = (fx ?? "").split(";");
      const id = `${race}:${String(i + 1).padStart(3, "0")}`;
      const a = {
        id, race, index: i, name, cat, shape, foe: parseEffects(foe), self: parseEffects(self), cd: Number(cd) || 0, cost: Number(cost) || 0,
        p: parseParams(params),
      };
      a.special = shape.startsWith("special:") ? shape.slice(8) : null;
      a.passive = shape.startsWith("passive:") ? shape.slice(8) : null;
      a.mode = a.passive ? "passiva" : a.p.toggle ? "alternar" : a.special === "drain" ? "segurar" : ["target", "grab", "throw", "swap", "mark", "chain"].includes(shape) ? "alvo"
        : ["zone", "orbit", "vortex", "aura", "summon", "trap", "dome", "wall"].includes(shape) ? "duração" : "instantâneo";
      // assinatura de comportamento: forma + efeitos (sem números) + marcas especiais
      a.sig = `${shape}|${a.foe.map((e) => e.k).sort().join("+")}|${a.self.map((e) => e.k).sort().join("+")}|${a.p.toggle ? "T" : ""}${a.p.allies ? "A" : ""}`;
      a.desc = describe(a);
      all.push(a);
    });
  }
  return all;
}

const FX_WORDS = {
  dmg: (e) => `${e.a} de dano`, heal: (e) => `cura ${e.a}`, steal: (e) => `rouba ${e.a}% em vida`, bleed: (e) => `sangramento ${e.a}s`, burn: (e) => `queima ${e.a}s`,
  decay: (e) => `decomposição ${e.a}s`, blast: (e) => `estouro de ${e.a} blocos`, kb: () => "empurra", up: () => "lança para o alto", pull: () => "puxa",
  slow: (e) => `lentidão ${e.a}`, weak: (e) => `fraqueza ${e.a}`, poison: () => "veneno", wither: () => "murchar", haste: () => "pressa", strength: (e) => `força ${e.a}`,
  speed: (e) => `velocidade ${e.a}`, jump: () => "super pulo", res: (e) => `resistência ${e.a}`, regen: (e) => `regeneração ${e.a}`, slowfall: () => "queda lenta",
  stun: (e) => `atordoa ${(e.a / 20).toFixed(1)}s`, root: (e) => `prende ${(e.a / 20).toFixed(1)}s`, silence: (e) => `silencia ${(e.a / 20).toFixed(1)}s`, lev: () => "levita",
  blind: () => "cega", dark: () => "escuridão", glow: () => "revela", invis: () => "invisível", fireres: () => "imune a fogo", nv: () => "visão noturna",
  wb: () => "respira na água", shield: () => "escudo", absorb: (e) => `+${e.a * 2} de vida extra`, thorns: (e) => `devolve ${e.a} de dano`, mark: () => "marca (+25% dano)",
  fear: () => "medo", cleanse: () => "limpa efeitos ruins", cleansefoe: () => "tira efeitos bons do alvo", execute: (e) => `executa abaixo de ${e.a}% de vida`,
  ignite: () => "incendeia", holy: () => "sagrado", ash: () => "vira cinzas", sat: () => "sacia a fome", hurtself: (e) => `custa ${e.a} de vida`, weakself: () => "te enfraquece",
  glowself: () => "você brilha", silencez: () => "silencia quem está dentro",
};
const SHAPE_WORDS = {
  target: "No alvo da mira", proj: "Projétil", volley: "Leque de projéteis", lob: "Projétil em arco", boomerang: "Vai e volta", beam: "Raio em linha", cone: "Cone à frente",
  nova: "Explosão ao redor", wave: "Onda pelo chão", cross: "Cruz de ondas", pillar: "Coluna sob o alvo", rain: "Chuva de impactos", chain: "Salta entre alvos",
  grab: "Puxa e golpeia", throw: "Agarra e arremessa", slam: "Salta e cai com impacto", leapslam: "Meteoro", dash: "Avanço", leap: "Salto com impacto", blink: "Teleporte",
  swap: "Troca de lugar com o alvo", tether: "Gancho até a mira", orbit: "Lâminas girando", zone: "Área persistente", vortex: "Redemoinho", trap: "Armadilha", dome: "Domo",
  wall: "Muro", aura: "Aura (liga/desliga)", summon: "Invocação", self: "Em você", ally: "Em você e aliados", mark: "Marca", firetrail: "Rastro de fogo", scan: "Revela criaturas",
  orescan: "Revela minérios", vacuum: "Puxa itens", bridge: "Ponte temporária", platform: "Plataforma temporária", light: "Luz que acompanha", dig: "Túnel", clear: "Abre caminho",
  ashclear: "Desfaz em cinzas", recall: "Volta ao lar", calm: "Acalma monstros", smelt: "Funde minérios da mão", trade: "Troca vida por energia", bloom: "Faz florescer",
};

function describe(a) {
  if (a.passive) return `Passiva: ${PASSIVE_TEXT[a.passive] ?? a.passive}.`;
  if (a.special) return SPECIAL_TEXT[a.special] ?? a.special;
  const parts = [...a.foe, ...a.self].filter((e) => FX_WORDS[e.k]).map((e) => FX_WORDS[e.k](e));
  const reach = a.p.r ? ` · ${a.p.r} blocos` : "";
  const n = a.p.n ? ` · ${a.p.n}×` : "";
  const dur = a.p.dur ? ` · ${(a.p.dur / 20).toFixed(0)}s` : "";
  return `${SHAPE_WORDS[a.shape] ?? a.shape}${reach}${n}${dur}: ${parts.join(", ") || "efeito especial"}.`;
}

const SPECIAL_TEXT = {
  bat: "Vira um morcego de verdade (pequeno, voa, imune ao sol). Usar de novo volta ao normal.",
  drain: "Segure o Núcleo mirando numa criatura perto: suga o sangue até ela morrer (para se ela fugir, sair da mira ou você soltar).",
  sprint5x: "Rajada: sua velocidade vai a 5× a de um jogador normal por alguns segundos.",
  superjump: "Super pulo de vampiro, sem dano de queda.",
  flight: "Liga/desliga o voo com as asas: olhe e ande para voar, pule sobe, agache desce.",
  weapon: "Chama a sua arma da raça de volta para a mão (a cópia antiga some: nunca duplica).",
};
const PASSIVE_TEXT = {
  nv: "visão noturna automática no escuro", nightdmg: "+% de dano à noite", lifesteal: "rouba vida em todo golpe", killheal: "cura ao abater", nofall: "sem dano de queda",
  dodge: "chance de esquivar de golpes", lowhpres: "resiste mais com pouca vida", sprint: "corre 2× mais rápido que um jogador", giantstep: "passadas que tremem o chão",
  giantstr: "3× a força de um jogador", giantres: "3× a resistência de um jogador", giantmine: "quebra blocos com estilhaços gigantes", fallslam: "cair de alto causa impacto",
  kbres: "não é empurrado", ragedmg: "mais dano quanto menos vida", critkb: "golpes arremessam longe", fireimm: "imune a fogo e lava", halo: "auréola/coroa sobre a cabeça",
  winggrowth: "as asas crescem com XP próprio (0→20) e nunca encolhem", regenrace: "regeneração da raça", dayregen: "regenera mais de dia",
  holyhit: "golpes sagrados ferem mais demônios, trevas e mortos-vivos", poisonimm: "imune a veneno e murchar", burnhit: "golpes incendeiam", lavaswim: "nada na lava",
  witherhit: "golpes fazem murchar", fearaura: "monstros perto ficam com medo",
};

export const ABILITIES = build();
export const BY_ID = new Map(ABILITIES.map((a) => [a.id, a]));
export const BY_RACE = Object.fromEntries(Object.keys(RACE_KITS).map((r) => [r, ABILITIES.filter((a) => a.race === r)]));

/** Validação do catálogo (usada no autoteste e no teste unitário). */
export function validateCatalog() {
  const errors = [];
  const ids = new Set();
  for (const [race, list] of Object.entries(BY_RACE)) {
    if (list.length !== 100) errors.push(`${race}: ${list.length} poderes (precisa de 100)`);
    const sigs = new Map();
    const names = new Set();
    for (const a of list) {
      if (ids.has(a.id)) errors.push(`id repetido ${a.id}`);
      ids.add(a.id);
      if (!a.name || !CATEGORIES[a.cat]) errors.push(`${a.id}: nome/categoria inválidos`);
      if (names.has(a.name)) errors.push(`${a.id}: nome repetido na raça (${a.name})`);
      names.add(a.name);
      if (a.special ? !SPECIALS.includes(a.special) : a.passive ? !PASSIVES.includes(a.passive) : !SHAPES.includes(a.shape)) errors.push(`${a.id}: forma sem implementação (${a.shape})`);
      for (const e of [...a.foe, ...a.self]) if (!EFFECTS.includes(e.k)) errors.push(`${a.id}: efeito sem implementação (${e.k})`);
      if (!a.passive && !a.special && !a.foe.length && !a.self.length && !["scan", "orescan", "vacuum", "bridge", "platform", "light", "dig", "clear", "ashclear", "recall", "calm", "smelt", "trade", "bloom"].includes(a.shape)) {
        errors.push(`${a.id}: sem nenhum efeito`);
      }
      if (!a.passive && a.cd <= 0) errors.push(`${a.id}: sem recarga`);
      const key = a.passive ? `passive:${a.passive}` : a.special ? `special:${a.special}` : a.sig;
      if (sigs.has(key)) errors.push(`${race}: "${a.name}" tem o mesmo comportamento que "${sigs.get(key)}" (${key})`);
      sigs.set(key, a.name);
    }
  }
  return errors;
}
