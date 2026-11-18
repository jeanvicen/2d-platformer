// Leitor do Códice do Eclipse (índice + páginas com navegação).
import { ActionFormData } from "@minecraft/server-ui";
import { CODEX } from "../data/codex.js";
import { show } from "./forms.js";
import { playerSound } from "../core/fx.js";

export async function openCodex(player, page = -1) {
  playerSound(player, "item.book.page_turn", 1, 1);
  if (page < 0) {
    const f = new ActionFormData().title("§5§lCódice do Eclipse").body("§7Toque em um capítulo. Tudo aqui funciona no celular, sem teclado.");
    for (const c of CODEX) f.button(`§l${c.t}`);
    const r = await show(player, f);
    if (!r || r.canceled || r.selection === undefined) return;
    return openCodex(player, r.selection);
  }
  const c = CODEX[page];
  const f = new ActionFormData().title(`§5${c.t}`).body(c.b);
  const nav = [];
  if (page + 1 < CODEX.length) {
    f.button(`§lPróximo ▶§r\n§7${CODEX[page + 1].t}`);
    nav.push(page + 1);
  }
  if (page > 0) {
    f.button(`§l◀ Anterior§r\n§7${CODEX[page - 1].t}`);
    nav.push(page - 1);
  }
  f.button("§l☰ Índice");
  nav.push(-1);
  const r = await show(player, f);
  if (!r || r.canceled || r.selection === undefined) return;
  return openCodex(player, nav[r.selection]);
}
