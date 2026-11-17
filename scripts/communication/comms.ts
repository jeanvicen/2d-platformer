/**
 * Communication System: private messages to the OWNER only (never broadcast), progress in the
 * action bar, anti-spam throttle, and a short "talking" face animation.
 */
import type { Entity, Player } from "@minecraft/server";
import { COLORS, Mood, PROP_MOOD, type Persona } from "../core/constants";
import { safe, isValid } from "../core/mc";
import { phrase } from "./phrases";

const lastSent = new Map<string, number>();

export interface Speaker {
  persona: Persona;
  name: string;
  owner(): Player | undefined;
  body(): Entity | undefined;
  chatEnabled(): boolean;
}

export function say(sp: Speaker, text: string, opts: { key?: string; throttleMs?: number; force?: boolean } = {}): void {
  const owner = sp.owner();
  if (!owner) return;
  const tkey = owner.id + (opts.key ?? text);
  const now = Date.now();
  if (!opts.force && opts.throttleMs && (lastSent.get(tkey) ?? 0) + opts.throttleMs > now) return;
  lastSent.set(tkey, now);
  const c = COLORS[sp.persona];
  const msg = `${c.tag}[${sp.name}]§r ${text}`;
  if (sp.chatEnabled() || opts.force) safe(() => owner.sendMessage(msg), undefined);
  else safe(() => owner.onScreenDisplay.setActionBar(msg), undefined);
  talk(sp.body());
}

export function sayKey(sp: Speaker, key: string, x?: string | number, opts: { throttleMs?: number; force?: boolean } = {}): void {
  say(sp, phrase(sp.persona, key, x), { key, ...opts });
}

export function actionBar(sp: Speaker, text: string): void {
  const owner = sp.owner();
  if (!owner) return;
  safe(() => owner.onScreenDisplay.setActionBar(`${COLORS[sp.persona].tag}${sp.name}:§r ${text}`), undefined);
}

const talkUntil = new Map<string, number>();
const moodBeforeTalk = new Map<string, number>();

/** Flaps the mouth for ~1.5s, then restores the previous mood. */
export function talk(e: Entity | undefined): void {
  if (!isValid(e)) return;
  const cur = safe(() => e.getProperty(PROP_MOOD) as number, 0);
  if (cur !== Mood.Talking) moodBeforeTalk.set(e.id, cur);
  safe(() => e.setProperty(PROP_MOOD, Mood.Talking), undefined);
  talkUntil.set(e.id, Date.now() + 1500);
}

/** Called by the brain every tick group to end talking animations. */
export function updateTalk(e: Entity): void {
  const until = talkUntil.get(e.id);
  if (until !== undefined && Date.now() > until) {
    talkUntil.delete(e.id);
    safe(() => e.setProperty(PROP_MOOD, moodBeforeTalk.get(e.id) ?? Mood.Neutral), undefined);
  }
}

export function setMood(e: Entity | undefined, m: Mood, ms?: number): void {
  if (!isValid(e)) return;
  if (talkUntil.has(e.id)) {
    moodBeforeTalk.set(e.id, m);
    return;
  }
  safe(() => e.setProperty(PROP_MOOD, m), undefined);
  if (ms) {
    const id = e.id;
    const until = Date.now() + ms;
    moodTimers.set(id, until);
  }
}

const moodTimers = new Map<string, number>();
export function updateMood(e: Entity): void {
  const t = moodTimers.get(e.id);
  if (t !== undefined && Date.now() > t) {
    moodTimers.delete(e.id);
    if (!talkUntil.has(e.id)) safe(() => e.setProperty(PROP_MOOD, Mood.Neutral), undefined);
    else moodBeforeTalk.set(e.id, Mood.Neutral);
  }
}
