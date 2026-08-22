"use client";

// HM-UX-0.3: reusable player-name navigation. Routes by playerId alone
// -- /career/squad/[playerId] already resolves ANY real player across
// every club known to this career (career/careerWorld.ts's
// getCareerPlayer searches state.worldSquads for every club, not just
// the manager's own), so this is already a universal player-profile
// link, not a manager-squad-only one. No string matching over prose;
// callers must already hold a real playerId (from a PlayerMock, a
// FastMatchResult contribution, etc.).
import Link from "next/link";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

export interface PlayerLinkProps {
  playerId: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Stops the click from also triggering an ancestor's own onClick (e.g. a clickable match-report row). */
  stopPropagation?: boolean;
}

export function playerProfileHref(playerId: string): string {
  return `/career/squad/${playerId}`;
}

export function PlayerLink({ playerId, children, className, style, stopPropagation }: PlayerLinkProps) {
  return (
    <Link href={playerProfileHref(playerId)} className={className} style={style} onClick={stopPropagation ? (e: MouseEvent) => e.stopPropagation() : undefined}>
      {children}
    </Link>
  );
}
