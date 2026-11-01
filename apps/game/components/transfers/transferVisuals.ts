// HM-ALPHA2-05F: shared visual assets and urgency helpers for Transfer
// Management. The two photographs were generated with Higgsfield (GPT
// Image 2.5) for this milestone and optimised to small WebP variants
// (negotiation room: 42 KB / 15 KB, signed deal: 36 KB / 11 KB); they are
// static imports so Next fingerprints and caches them. Both keep a dark,
// empty left side so text can sit on a navy gradient over them -- reusable
// for any future "management room" or "milestone" hero.
import type { CSSProperties } from "react";
import roomWide from "./assets/negotiation-room-1920.webp";
import roomNarrow from "./assets/negotiation-room-960.webp";
import signedWide from "./assets/deal-signed-1600.webp";
import signedNarrow from "./assets/deal-signed-800.webp";
import { daysBetween } from "@/lib/career/dateUtils";

/** CSS custom properties consumed by .tc-photo-hero (image-set picks the variant by pixel density / width via the media rules in transfer-centre.css). */
export const NEGOTIATION_ROOM_BACKDROP: CSSProperties = {
  ["--tc-photo-wide" as string]: `url(${roomWide.src})`,
  ["--tc-photo-narrow" as string]: `url(${roomNarrow.src})`,
};

export const DEAL_SIGNED_BACKDROP: CSSProperties = {
  ["--tc-photo-wide" as string]: `url(${signedWide.src})`,
  ["--tc-photo-narrow" as string]: `url(${signedNarrow.src})`,
};

export type Urgency = "calm" | "soon" | "urgent" | "overdue";

/** Days left until `deadline` (inclusive of the deadline day) and how urgent that is: 0-1 days urgent, 2-3 soon. */
export function deadlineUrgency(today: string, deadline: string | undefined): { daysLeft: number; urgency: Urgency } | null {
  if (!deadline) return null;
  const daysLeft = daysBetween(today, deadline);
  const urgency: Urgency = daysLeft < 0 ? "overdue" : daysLeft <= 1 ? "urgent" : daysLeft <= 3 ? "soon" : "calm";
  return { daysLeft, urgency };
}

export function daysLeftLabel(daysLeft: number): string {
  if (daysLeft < 0) return "Tidsfristen har passerat";
  if (daysLeft === 0) return "Sista dagen idag";
  if (daysLeft === 1) return "1 dag kvar";
  return `${daysLeft} dagar kvar`;
}

/** 0..1 progress of `today` between `start` and `end` -- for pending-answer and loan-period bars. */
export function periodProgress(start: string, end: string, today: string): number {
  const total = daysBetween(start, end);
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, daysBetween(start, today) / total));
}
