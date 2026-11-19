// Persistência robusta via dynamic properties (estáveis), com JSON versionado,
// fatiamento automático de strings grandes e tolerância a dados corrompidos.
import { logError } from "./log.js";

const CHUNK = 30000;

/** @param {{getDynamicProperty(id:string):any,setDynamicProperty(id:string,v?:any):void}} holder */
export function readJSON(holder, key, fallback) {
  try {
    const raw = holder.getDynamicProperty(key);
    if (raw === undefined || raw === null || raw === "") return fallback;
    let text = String(raw);
    if (text.startsWith("@chunks:")) {
      const n = parseInt(text.slice(8), 10);
      const parts = [];
      for (let i = 0; i < n; i++) parts.push(String(holder.getDynamicProperty(`${key}#${i}`) ?? ""));
      text = parts.join("");
    }
    return JSON.parse(text);
  } catch (e) {
    logError("persist.read", `${key}: ${e}`);
    return fallback;
  }
}

export function writeJSON(holder, key, value) {
  try {
    const text = JSON.stringify(value);
    if (text.length <= CHUNK) {
      holder.setDynamicProperty(key, text);
      return true;
    }
    const n = Math.ceil(text.length / CHUNK);
    for (let i = 0; i < n; i++) holder.setDynamicProperty(`${key}#${i}`, text.slice(i * CHUNK, (i + 1) * CHUNK));
    holder.setDynamicProperty(key, `@chunks:${n}`);
    return true;
  } catch (e) {
    logError("persist.write", `${key}: ${e}`);
    return false;
  }
}

export function readNumber(holder, key, fallback = 0) {
  try {
    const v = holder.getDynamicProperty(key);
    return typeof v === "number" ? v : fallback;
  } catch {
    return fallback;
  }
}

export function readString(holder, key, fallback = "") {
  try {
    const v = holder.getDynamicProperty(key);
    return typeof v === "string" ? v : fallback;
  } catch {
    return fallback;
  }
}

export function writeValue(holder, key, value) {
  try {
    holder.setDynamicProperty(key, value);
    return true;
  } catch (e) {
    logError("persist.value", `${key}: ${e}`);
    return false;
  }
}
