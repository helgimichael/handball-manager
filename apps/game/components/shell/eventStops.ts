// Arena 231 -- ENT-09a C "Spine pin + event card": why time stopped, kept as typed stops pinned to the Week Spine.
// Pure helpers over the already-built ProgressionNotice (components/game/progressionPresentation.ts): the kicker by
// stop type, the inbox link, and the numbered stack of stops (newest last, de-duplicated, at most five).
import { CAREER_EVENT_LABEL, type ProgressionNotice } from "../game/progressionPresentation";

export const MAX_STOPS = 5;

export function stopKey(n: ProgressionNotice): string {
  return n.event ? `event:${n.event.id}` : `${n.kind}:${n.title}`;
}

export function stopKicker(n: ProgressionNotice): string {
  if (n.kind === "matchday") return "Matchdag";
  if (n.kind === "season") return "Säsongsavslut";
  if (n.kind === "calendar") return "Kalendern";
  const label = n.event ? CAREER_EVENT_LABEL[n.event.type] : null;
  return n.kind === "decision" ? `Ditt beslut${label ? ` · ${label}` : ""}` : label ?? "Nyhet";
}

/** The inbox message for the stop, when it came from an event (second action on the card). */
export function stopInboxHref(n: ProgressionNotice): string | null {
  return n.event ? `/career/inbox?message=${encodeURIComponent(`msg:${n.event.id}`)}` : null;
}

/** Adds a stop to the stack: an existing stop for the same event moves to the end; the oldest fall off past MAX_STOPS. */
export function pushStop(stops: readonly ProgressionNotice[], next: ProgressionNotice): ProgressionNotice[] {
  const key = stopKey(next);
  return [...stops.filter((s) => stopKey(s) !== key), next].slice(-MAX_STOPS);
}
