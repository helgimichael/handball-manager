"use client";

// HM-UX-0.3: reusable club-name navigation. Never guesses a
// destination from prose -- it only ever routes by clubId, exactly the
// way every other career screen already resolves a club (getClub,
// getCareerClubSquad, etc.). The manager's own club keeps using the
// existing Club/Squad workflow (/career/club); every other club goes
// to the new universal club-profile route (/career/clubs/[clubId]).
// This is the ONE place that routing decision is made -- every surface
// that renders a club name should go through this component instead of
// re-deriving the manager's-own-club check itself.
import Link from "next/link";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { useCareer } from "@/lib/career/CareerContext";

export interface ClubLinkProps {
  clubId: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Stops the click from also triggering an ancestor's own onClick (e.g. a clickable fixture row) -- set this when nesting a ClubLink inside another clickable element. */
  stopPropagation?: boolean;
}

export function clubProfileHref(clubId: string, playerClubId: string): string {
  return clubId === playerClubId ? "/career/club" : `/career/clubs/${clubId}`;
}

export function ClubLink({ clubId, children, className, style, stopPropagation }: ClubLinkProps) {
  const { career } = useCareer();
  const href = clubProfileHref(clubId, career.playerClubId);
  return (
    <Link href={href} className={className} style={style} onClick={stopPropagation ? (e: MouseEvent) => e.stopPropagation() : undefined}>
      {children}
    </Link>
  );
}
