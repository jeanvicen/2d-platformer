/**
 * Task Planner. Pure module.
 * Turns interpreted intents into persisted Tasks with explicit steps, a completion goal,
 * limited attempts and alternative strategies. Mode intents (follow/protect/guard/stay)
 * are returned separately because they change the idle behaviour, not the task queue.
 */
import type { BehaviorMode, Intent, Task, TaskKind } from "../core/types";
import { RESOURCE_PT } from "../inventory/item_catalog";
import { TUNING } from "../core/constants";

const STRUCT_PT: Record<string, string> = { hut: "uma casinha", wall: "um muro", platform: "uma plataforma", bridge: "uma ponte", pillar: "um pilar", tower: "uma torre" };

let counter = 0;
const newId = (): string => `t${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Step lists: shown in status messages and executed by the Action Executor. */
export const STEPS: Record<TaskKind, string[]> = {
  gather_wood: ["check_inventory", "select_tool", "find_target", "goto_target", "harvest", "collect", "verify", "return", "deliver", "confirm"],
  gather_food: ["check_inventory", "find_target", "goto_target", "harvest", "collect", "process", "verify", "return", "deliver", "confirm"],
  mine: ["check_inventory", "select_tool", "find_target", "goto_target", "harvest", "collect", "verify", "return", "deliver", "confirm"],
  hunt: ["check_inventory", "select_tool", "find_target", "goto_target", "harvest", "collect", "verify", "return", "deliver", "confirm"],
  farm: ["check_inventory", "select_tool", "find_target", "goto_target", "harvest", "collect", "verify", "return", "deliver", "confirm"],
  craft: ["check_inventory", "prepare_materials", "find_station", "goto_target", "work", "verify", "return", "deliver", "confirm"],
  cook: ["check_inventory", "find_station", "goto_target", "work", "verify", "return", "deliver", "confirm"],
  build: ["check_inventory", "prepare_materials", "check_space", "work", "verify", "confirm"],
  destroy: ["find_target", "select_tool", "goto_target", "harvest", "collect", "verify", "confirm"],
  deliver: ["check_inventory", "return", "deliver", "confirm"],
  eat: ["check_inventory", "work", "confirm"],
  attack: ["find_target", "work", "confirm"],
  equip: ["check_inventory", "work", "confirm"],
  return: ["return", "confirm"],
};

export const STEP_PT: Record<string, string> = {
  check_inventory: "consultando o inventário",
  select_tool: "escolhendo a ferramenta",
  find_target: "procurando o alvo",
  goto_target: "indo até o local",
  harvest: "coletando",
  collect: "recolhendo os itens",
  process: "preparando a comida",
  verify: "verificando o resultado",
  return: "voltando até você",
  deliver: "entregando os itens",
  confirm: "confirmando",
  prepare_materials: "separando materiais",
  find_station: "procurando a estação de trabalho",
  work: "trabalhando",
  check_space: "verificando o espaço",
};

function task(kind: TaskKind, label: string, goal: Task["goal"], extra: Partial<Task> = {}): Task {
  return {
    id: newId(),
    kind,
    label,
    priority: 3,
    goal,
    steps: [...STEPS[kind]],
    stepIndex: 0,
    state: "pending",
    progress: { done: 0, total: goal.count ?? 1 },
    attempts: 0,
    maxAttempts: TUNING.maxTaskAttempts,
    strategy: 0,
    deliver: true,
    resumable: true,
    data: {},
    createdAt: Date.now(),
    ...extra,
  };
}

export interface Plan {
  tasks: Task[];
  mode?: BehaviorMode;
  control: ("cancel" | "pause" | "resume" | "dismiss")[];
  queries: ("status" | "inventory" | "why" | "progress" | "help" | "greet" | "thanks" | "compliment" | "unknown")[];
  urgent: boolean;
}

const TOOL_KEYS = ["pickaxe", "axe", "shovel", "sword", "hoe"];

export function plan(intents: Intent[]): Plan {
  const out: Plan = { tasks: [], control: [], queries: [], urgent: false };
  for (const it of intents) {
    if (it.priority === "high") out.urgent = true;
    const pri = it.priority === "high" ? 5 : 3;
    switch (it.kind) {
      case "cancel":
      case "pause":
      case "resume":
      case "dismiss":
        out.control.push(it.kind);
        break;
      case "status":
      case "inventory":
      case "why":
      case "progress":
      case "help":
      case "greet":
      case "thanks":
      case "compliment":
      case "unknown":
        out.queries.push(it.kind);
        break;
      case "follow":
      case "protect":
      case "guard":
      case "stay":
        out.mode = it.kind;
        break;
      case "return":
        out.tasks.push(task("return", "voltar até você", {}, { priority: pri, deliver: false }));
        break;
      case "gather": {
        const r = it.resource ?? "wood";
        const n = it.quantity ?? 16;
        if (r === "wood") {
          out.tasks.push(task("gather_wood", `coletar ${n} ${RESOURCE_PT.wood}`, { resource: "wood", count: n, target: it.target }, { priority: pri, deliver: it.deliver !== false }));
        } else if (r === "food" || r === "berries") {
          out.tasks.push(task("gather_food", `conseguir ${n} de ${RESOURCE_PT[r]}`, { resource: r, count: n, allowHunting: it.allowHunting }, { priority: pri, deliver: it.deliver !== false }));
        } else if (["sand", "dirt", "gravel"].includes(r)) {
          out.tasks.push(task("mine", `cavar ${n} de ${RESOURCE_PT[r]}`, { resource: r, count: n }, { priority: pri, deliver: it.deliver !== false }));
        } else {
          out.tasks.push(task("mine", `minerar ${n} de ${RESOURCE_PT[r]}`, { resource: r, count: n }, { priority: pri, deliver: it.deliver !== false }));
        }
        break;
      }
      case "mine": {
        const r = it.resource ?? "stone";
        const n = it.quantity ?? 16;
        out.tasks.push(task("mine", `minerar ${n} de ${RESOURCE_PT[r]}`, { resource: r, count: n }, { priority: pri, deliver: it.deliver !== false }));
        break;
      }
      case "hunt": {
        const n = it.quantity ?? 4;
        out.tasks.push(task("hunt", `caçar e conseguir ${n} de carne`, { resource: "meat", count: n, target: it.target, allowHunting: true }, { priority: pri, deliver: it.deliver !== false }));
        break;
      }
      case "farm": {
        const n = it.quantity ?? 9;
        const r = it.resource;
        out.tasks.push(task("farm", r ? `colher ${n} de ${RESOURCE_PT[r]}` : `colher a plantação`, { resource: r, count: n }, { priority: pri, deliver: it.deliver !== false }));
        break;
      }
      case "craft": {
        const item = it.item ?? "planks";
        const key = TOOL_KEYS.includes(item) ? `${it.tier ?? "best"}_${item}` : item;
        const n = it.quantity ?? 1;
        out.tasks.push(task("craft", `fabricar ${n}x ${key.replace(/_/g, " ")}`, { item: key, count: n, tier: it.tier }, { priority: pri, deliver: it.deliver !== false }));
        break;
      }
      case "cook": {
        const n = it.quantity ?? 8;
        out.tasks.push(task("cook", "cozinhar/fundir na fornalha", { resource: it.resource, count: n }, { priority: pri }));
        break;
      }
      case "build":
        out.tasks.push(
          task("build", `construir ${STRUCT_PT[it.structure ?? "hut"]}`, { structure: it.structure ?? "hut", material: it.material ?? "any", size: it.size }, { priority: pri, deliver: false }),
        );
        break;
      case "destroy":
        out.tasks.push(task("destroy", it.target?.kind === "area" ? "cavar a área" : "quebrar o bloco indicado", { target: it.target ?? { kind: "view" } }, { priority: pri, deliver: false }));
        break;
      case "deliver":
        out.tasks.push(
          task("deliver", "entregar itens", { resource: it.resource, item: it.item, count: it.quantity, all: it.all }, { priority: pri, resumable: true }),
        );
        break;
      case "eat":
        out.tasks.push(task("eat", "comer", {}, { priority: 4, deliver: false }));
        break;
      case "attack":
        out.tasks.push(task("attack", "atacar o alvo indicado", { target: it.target }, { priority: 5, deliver: false, resumable: false }));
        break;
      case "equip":
        out.tasks.push(task("equip", "equipar", { item: it.item, tier: it.tier }, { priority: 3, deliver: false }));
        break;
    }
  }
  // "Pegue 32 troncos e volte": the trailing return is already part of the gather task
  // (it returns and delivers), so a standalone return right after work is redundant.
  const t = out.tasks;
  if (t.length >= 2 && t[t.length - 1].kind === "return" && t[t.length - 2].deliver) t.pop();
  return out;
}

export function stepLabel(t: Task): string {
  const s = t.steps[t.stepIndex];
  return `${STEP_PT[s] ?? s} (etapa ${Math.min(t.stepIndex + 1, t.steps.length)}/${t.steps.length})`;
}
