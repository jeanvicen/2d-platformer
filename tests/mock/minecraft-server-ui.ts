/** Minimal @minecraft/server-ui simulator: forms resolve with queued answers (or closed). */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const FormCancelationReason = { UserBusy: "UserBusy", UserClosed: "UserClosed" };
export const answers: any[] = [];
export const shown: { kind: string; title: string; buttons: string[] }[] = [];

class Base {
  title_ = "";
  buttons: string[] = [];
  title(t: string) {
    this.title_ = t;
    return this;
  }
  body() {
    return this;
  }
  button(t: string) {
    this.buttons.push(t);
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
  label() {
    return this;
  }
  divider() {
    return this;
  }
  header() {
    return this;
  }
  show(): Promise<any> {
    shown.push({ kind: this.constructor.name, title: this.title_, buttons: this.buttons });
    const a = answers.shift();
    return Promise.resolve(a ?? { canceled: true, cancelationReason: "UserClosed" });
  }
}
export class ActionFormData extends Base {}
export class ModalFormData extends Base {}
