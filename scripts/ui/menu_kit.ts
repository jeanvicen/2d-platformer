/** Small builder over ActionFormData: sections (header/label/divider), icon buttons and their actions together. */
import { Player } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { show } from "./menus";

export class Menu {
  private f = new ActionFormData();
  private acts: (() => void)[] = [];

  constructor(title: string) {
    this.f.title(title);
  }
  header(t: string): this {
    this.f.header(t);
    return this;
  }
  label(t: string): this {
    this.f.label(t);
    return this;
  }
  divider(): this {
    this.f.divider();
    return this;
  }
  button(text: string, icon: string | undefined, act: () => void): this {
    this.f.button(text, icon);
    this.acts.push(act);
    return this;
  }
  get size(): number {
    return this.acts.length;
  }
  open(p: Player, onClose?: () => void): void {
    show(p, () => this.f.show(p), (r) => {
      const act = r.selection !== undefined ? this.acts[r.selection] : undefined;
      if (act) act();
      else onClose?.();
    });
  }
}
