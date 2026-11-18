/** Minimal @minecraft/server-ui simulator: forms resolve with queued answers (or closed). */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const FormCancelationReason = { UserBusy: "UserBusy", UserClosed: "UserClosed" };
export const answers: any[] = [];
export type Item = { t: "header" | "label" | "divider" | "button" | "body"; text?: string; icon?: string };
export const shown: { kind: string; title: string; buttons: string[]; icons: (string | undefined)[]; items: Item[] }[] = [];

class Base {
  title_ = "";
  buttons: string[] = [];
  icons: (string | undefined)[] = [];
  items: Item[] = [];
  title(t: string) {
    this.title_ = t;
    return this;
  }
  body(t?: string) {
    this.items.push({ t: "body", text: t });
    return this;
  }
  button(t: string, icon?: string) {
    this.buttons.push(t);
    this.icons.push(icon);
    this.items.push({ t: "button", text: t, icon });
    return this;
  }
  textField() {
    return this;
  }
  toggle() {
    return this;
  }
  slider() {
    return this;
  }
  dropdown() {
    return this;
  }
  submitButton() {
    return this;
  }
  label(t?: string) {
    this.items.push({ t: "label", text: t });
    return this;
  }
  divider() {
    this.items.push({ t: "divider" });
    return this;
  }
  header(t?: string) {
    this.items.push({ t: "header", text: t });
    return this;
  }
  show(): Promise<any> {
    shown.push({ kind: this.constructor.name, title: this.title_, buttons: this.buttons, icons: this.icons, items: this.items });
    const a = answers.shift();
    return Promise.resolve(a ?? { canceled: true, cancelationReason: "UserClosed" });
  }
}
export class ActionFormData extends Base {}
export class ModalFormData extends Base {}
