// Esquema do perfil do jogador (puro, testável em Node). Versionado com migrações.
export const SCHEMA = 3;

const MODE_DEFAULT = () => ({ xp: 0, level: 1, points: 0, unlocked: [] });

export function defaultProfile() {
  return {
    v: SCHEMA,
    core: "dormant", // dormant | awakened | manifested | ascendant
    mode: "eclipse",
    modes: { eclipse: MODE_DEFAULT(), god: MODE_DEFAULT(), haze: MODE_DEFAULT() },
    totalXp: 0,
    element: "fire",
    technique: { eclipse: 0, god: 0, haze: 0 },
    activeCreature: "umbra",
    companions: [], // {uid, key, id(entityId), state}
    form: null,
    formSel: "wolf",
    formChest: null, // typeId da peça de peito guardada durante a forma
    construct: "platform",
    relicFav: "eclipse_hammer",
    thrown: {}, // instanceId -> {relic, state, dim, pos, slot}
    owed: [], // relíquias a devolver (instanceIds)
    preset: "balanced",
    prefs: { aura: true, hints: true, flight: true, sounds: true },
    stats: { summons: 0, throws: 0, flightTicks: 0, forms: 0, constructs: 0, lyraTasks: 0, kills: 0, casts: 0 },
    biomes: [],
    chunks: 0,
    quests: {},
    titles: [],
    lyra: { id: null, inv: [], name: "Lyra", summoned: false, tasks: [] },
    firstJoin: true,
    lastSeen: 0,
  };
}

/** Normaliza qualquer objeto (antigo, parcial ou corrompido) para o esquema atual. */
export function migrate(raw) {
  const base = defaultProfile();
  if (!raw || typeof raw !== "object") return base;
  const p = { ...base, ...raw };
  // v1 -> v2: "race" virou "mode"; xp único virou xp por modo
  if (!raw.v || raw.v < 2) {
    if (raw.race && !raw.mode) p.mode = raw.race;
    if (typeof raw.xp === "number") {
      p.modes = { ...base.modes };
      p.modes[p.mode in base.modes ? p.mode : "eclipse"].xp = raw.xp;
      p.totalXp = raw.xp;
    }
    delete p.race;
    delete p.xp;
  }
  // v2 -> v3: companions viraram objetos, lyra ganhou fila de tarefas
  if (!raw.v || raw.v < 3) {
    if (Array.isArray(raw.companions)) {
      p.companions = raw.companions.map((c) => (typeof c === "string" ? { uid: c, key: "umbra", id: null, state: "follow" } : c));
    }
  }
  // saneamento de tipos
  if (!["eclipse", "god", "haze"].includes(p.mode)) p.mode = "eclipse";
  if (!["dormant", "awakened", "manifested", "ascendant"].includes(p.core)) p.core = "dormant";
  for (const m of ["eclipse", "god", "haze"]) {
    const mm = p.modes?.[m];
    p.modes[m] = {
      xp: Number.isFinite(mm?.xp) ? mm.xp : 0,
      level: Number.isFinite(mm?.level) ? Math.max(1, mm.level) : 1,
      points: Number.isFinite(mm?.points) ? mm.points : 0,
      unlocked: Array.isArray(mm?.unlocked) ? mm.unlocked.filter((x) => typeof x === "string") : [],
    };
  }
  p.technique = { ...base.technique, ...(typeof p.technique === "object" ? p.technique : {}) };
  p.prefs = { ...base.prefs, ...(typeof p.prefs === "object" ? p.prefs : {}) };
  p.stats = { ...base.stats, ...(typeof p.stats === "object" ? p.stats : {}) };
  p.lyra = { ...base.lyra, ...(typeof p.lyra === "object" ? p.lyra : {}) };
  if (!Array.isArray(p.companions)) p.companions = [];
  p.companions = p.companions.filter((c) => c && typeof c.key === "string" && typeof c.uid === "string");
  if (!Array.isArray(p.biomes)) p.biomes = [];
  if (!Array.isArray(p.owed)) p.owed = [];
  if (!Array.isArray(p.titles)) p.titles = [];
  if (typeof p.thrown !== "object" || Array.isArray(p.thrown) || !p.thrown) p.thrown = {};
  if (typeof p.quests !== "object" || !p.quests) p.quests = {};
  if (!Array.isArray(p.lyra.inv)) p.lyra.inv = [];
  if (!Array.isArray(p.lyra.tasks)) p.lyra.tasks = [];
  p.v = SCHEMA;
  return p;
}
