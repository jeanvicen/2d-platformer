// Agendador único: todas as rotinas periódicas passam por aqui (um só runInterval),
// com intervalos próprios, deslocamento (stagger) e isolamento de erros.
import { system } from "@minecraft/server";
import { measure } from "./log.js";
import { beginTick } from "./budget.js";

/** @type {{name:string, every:number, offset:number, fn:()=>void}[]} */
const tasks = [];
let started = false;
let intervalId = -1;

export function every(name, ticks, fn, offset = 0) {
  if (tasks.some((t) => t.name === name)) return; // proteção contra registro duplicado
  tasks.push({ name, every: Math.max(1, ticks), offset: offset % Math.max(1, ticks), fn });
}

export function startScheduler() {
  if (started) return;
  started = true;
  intervalId = system.runInterval(() => {
    beginTick();
    const t = system.currentTick;
    for (const task of tasks) {
      if ((t + task.offset) % task.every === 0) measure(task.name, task.fn);
    }
  }, 1);
}

export function schedulerInfo() {
  return { started, intervalId, tasks: tasks.map((t) => `${t.name}/${t.every}`) };
}

/** Atraso simples com proteção de erro. */
export function later(ticks, fn, scope = "later") {
  return system.runTimeout(() => measure(scope, fn), Math.max(0, ticks));
}
