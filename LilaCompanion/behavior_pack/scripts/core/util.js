// Utilitários puros + vetores (sem dependência do motor, testáveis em Node).

export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const len = (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
export const lenXZ = (a) => Math.sqrt(a.x * a.x + a.z * a.z);
export const dist = (a, b) => len(sub(a, b));
export const distXZ = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
export const norm = (a) => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerpV = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) });
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const floorV = (a) => ({ x: Math.floor(a.x), y: Math.floor(a.y), z: Math.floor(a.z) });
export const center = (b) => ({ x: b.x + 0.5, y: b.y, z: b.z + 0.5 });
export const keyOf = (p) => `${p.x},${p.y},${p.z}`;
export const parseKey = (k) => {
  const [x, y, z] = k.split(",").map(Number);
  return { x, y, z };
};

/** Direção horizontal (unitária) a partir do yaw do Minecraft (graus). */
export function yawDir(yawDeg) {
  const r = (yawDeg * Math.PI) / 180;
  return { x: -Math.sin(r), y: 0, z: Math.cos(r) };
}

/** Vetor "direita" de uma direção horizontal. */
export function rightOf(dir) {
  return { x: -dir.z, y: 0, z: dir.x };
}

/** Converte uma direção em um dos 4 cardinais (0=+z sul,1=-x oeste,2=-z norte,3=+x leste). */
export function cardinal(dir) {
  if (Math.abs(dir.x) > Math.abs(dir.z)) return dir.x > 0 ? 3 : 1;
  return dir.z > 0 ? 0 : 2;
}

/** Rotaciona um offset local (x direita, z frente) para o cardinal dado. */
export function rotateLocal(local, card) {
  // frente local = +z; direita local = +x
  switch (card) {
    case 0: return { x: -local.x, y: local.y, z: local.z }; // frente sul
    case 2: return { x: local.x, y: local.y, z: -local.z }; // frente norte
    case 3: return { x: local.z, y: local.y, z: local.x }; // frente leste
    case 1: return { x: -local.z, y: local.y, z: -local.x }; // frente oeste
    default: return local;
  }
}

export function randRange(a, b) {
  return a + Math.random() * (b - a);
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function uid(prefix = "e") {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e8).toString(36)}`;
}

export function formatTicks(ticks) {
  const s = Math.ceil(ticks / 20);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
}

export function titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function bar(frac, width = 10, on = "§d█", off = "§8█") {
  const n = Math.round(clamp(frac, 0, 1) * width);
  return on.repeat(n) + off.repeat(width - n);
}

/** Direção cardinal em português a partir de um vetor (para relatórios). */
export function directionName(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const ang = (Math.atan2(dx, -dz) * 180) / Math.PI; // 0 = norte (-z)
  const names = ["norte", "nordeste", "leste", "sudeste", "sul", "sudoeste", "oeste", "noroeste"];
  const idx = Math.round(((ang + 360) % 360) / 45) % 8;
  return names[idx];
}
