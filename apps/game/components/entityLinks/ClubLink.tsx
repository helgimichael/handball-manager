"use client";

// HM-UX-0.3 + HM-RICH-EXPERIENCE-01: reusable club-name navigation with inline
// club identity mark. Routes by clubId: the manager's own club goes to
// /career/club; every other club goes to /career/clubs/[clubId].
import Link from "next/link";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { useCareer } from "@/lib/career/CareerContext";
import { getClub } from "@/lib/game-data";
import ClubCrest from "@/components/ClubCrest";

export interface ClubLinkProps {
  clubId: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Stops the click from also triggering an ancestor's own onClick (e.g. a clickable fixture row). */
  stopPropagation?: boolean;
  /** Whether to show the inline club crest next to the club name (default true for text labels). */
  showCrest?: boolean;
  crestSize?: number;
}

export function clubProfileHref(clubId: string, playerClubId: string): string {
  return clubId === playerClubId ? "/career/club" : `/career/clubs/${clubId}`;
}

export function ClubLink({
  clubId,
  children,
  className,
  style,
  stopPropagation,
  showCrest = true,
  crestSize = 20,
}: ClubLinkProps) {
  const { career } = useCareer();
  const href = clubProfileHref(clubId, career.playerClubId);
  const club = getClub(clubId);
  const isTextChild = typeof children === "string" || typeof children === "number";

  return (
    <Link
      href={href}
      className={`hm-club-link${className ? ` ${className}` : ""}`}
      style={style}
      onClick={stopPropagation ? (e: MouseEvent) => e.stopPropagation() : undefined}
    >
      {showCrest && isTextChild && club && (
        <span className="hm-club-link-crest" aria-hidden="true">
          <ClubCrest
            clubId={club.id}
            shortName={club.shortName}
            primaryColor={club.primaryColor}
            secondaryColor={club.secondaryColor}
            size={crestSize}
          />
        </span>
      )}
      <span>{children}</span>
    </Link>
  );
}
