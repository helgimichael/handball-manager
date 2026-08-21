"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import ClubCrest from "./ClubCrest";
import NavIcon, { type NavIconName } from "./NavIcon";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub } from "@/lib/career/careerWorld";
import { getNextEventDate } from "@/lib/career/calendar";
import { formatGameDate } from "@/lib/career/dateUtils";

type NavEntry = { href: string; label: string; icon: NavIconName; badge?: number };

function useNav(unread: number, editorEnabled: boolean): readonly NavEntry[] {
  const nav: NavEntry[] = [
    { href: "/career", label: "Hem", icon: "home" },
    { href: "/career/inbox", label: "Inkorg", icon: "inbox", badge: unread || undefined },
    { href: "/career/squad", label: "Trupp", icon: "squad" },
    { href: "/career/tactics", label: "Taktik", icon: "tactics" },
    { href: "/career/training", label: "Träning", icon: "training" },
    { href: "/career/schedule", label: "Schema", icon: "schedule" },
    { href: "/career/matches", label: "Matcher", icon: "matches" },
    { href: "/career/analysis", label: "Analys", icon: "analysis" },
    { href: "/career/scouting", label: "Scouting", icon: "scouting" },
    { href: "/career/transfers", label: "Transfers", icon: "transfers" },
    { href: "/career/staff", label: "Personal", icon: "staff" },
    { href: "/career/club", label: "Klubb", icon: "club" },
    { href: "/career/competitions", label: "Tävlingar", icon: "competitions" },
  ];
  // Development-only (HM-DATA-EDITOR-0.1): hiding this link is a
  // convenience, not the real guard -- /editor/* and /api/editor/* both
  // independently re-check the same flag server-side regardless of
  // whether this item is rendered.
  if (editorEnabled) {
    nav.push({ href: "/editor", label: "Editor", icon: "editor" });
  }
  return nav;
}

/** One-shot client fetch of the server-only HM_EDITOR_ENABLED flag, purely to decide whether to show the nav link. */
function useEditorEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    fetch("/api/editor/status")
      .then((res) => res.json())
      .then((data) => setEnabled(Boolean(data.enabled)))
      .catch(() => setEnabled(false));
  }, []);
  return enabled;
}

export default function GameShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { career, continueCareer } = useCareer();
  const unread = career.inbox.filter((m) => !m.read && !m.archived).length;
  const editorEnabled = useEditorEnabled();
  const nav = useNav(unread, editorEnabled);
  const club = getCareerClub(career);
  const nextEventDate = getNextEventDate(career);

  function handleContinue() {
    const { events, stopReason } = continueCareer();
    if (stopReason === "ACTION_REQUIRED_PENDING" || events.some((e) => e.type === "MATCHDAY_READY")) {
      router.push("/career/match-preview");
      return;
    }
    if (events.some((e) => e.priority === "IMPORTANT" || e.priority === "ACTION_REQUIRED")) {
      router.push("/career/inbox");
      return;
    }
    router.push("/career");
  }

  return (
    <div className="hm-shell">
      <aside className="hm-sidebar">
        <div className="hm-club-badge">
          <ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} size={32} />
          <div>
            <div className="hm-club-name">{club.name}</div>
            <div className="hm-club-sub">Allsvenskan</div>
          </div>
        </div>
        <div className="hm-nav-group">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <div
                key={item.href}
                className="hm-nav-item"
                data-active={active}
                onClick={() => router.push(item.href)}
              >
                <span className="hm-nav-icon">
                  <NavIcon name={item.icon} />
                </span>
                <span>{item.label}</span>
                {item.badge ? <span className="hm-nav-badge">{item.badge}</span> : null}
              </div>
            );
          })}
        </div>
      </aside>

      <header className="hm-header">
        <div className="hm-header-title">
          <div className="hm-header-title-text">{club.name}</div>
          <div className="hm-header-sub">
            {formatGameDate(career.gameDate)}
            {career.seasonComplete ? " · Säsongen avslutad" : nextEventDate ? ` · Nästa: ${formatGameDate(nextEventDate)}` : ""}
          </div>
        </div>
        <div className="hm-header-meta">
          <span>Manager: Du</span>
          <button type="button" className="hm-btn hm-btn-primary" onClick={handleContinue} disabled={career.seasonComplete}>
            {career.seasonComplete ? "Säsong klar" : "Fortsätt »"}
          </button>
        </div>
      </header>

      <main className="hm-main">{children}</main>
    </div>
  );
}
