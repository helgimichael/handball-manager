"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from 'next/link';
import type { ReactNode } from "react";
import ClubCrest from "./ClubCrest";
import CareerSaveControl from './CareerSaveControl';
import NavIcon, { type NavIconName } from "./NavIcon";
import ContinueProcessingOverlay, { type ProcessingDay } from "./ContinueProcessingOverlay";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub } from "@/lib/career/careerWorld";
import { getNextEventDate } from "@/lib/career/calendar";
import { addDays, formatGameDate } from "@/lib/career/dateUtils";
import { CAREER_NAV_ITEMS, resolveActiveNavId } from "@/lib/career/navigation";
import { COMPETITIONS, getClub } from "@/lib/game-data";
import { computeLiveMatchView } from "@/lib/liveMatch/liveMatchView";
import { formatMatchMinute } from "@/lib/liveMatch/commentary";
import type { CareerEvent } from "@/lib/career/careerEvents";
import type { ContinueStopReason } from "@/lib/career/continueController";

type NavEntry = { id: string; href: string; label: string; icon: NavIconName; badge?: number };

function useNav(unread: number, editorEnabled: boolean): readonly NavEntry[] {
  const nav: NavEntry[] = CAREER_NAV_ITEMS.map((item) => ({
    id: item.id,
    href: item.href,
    label: item.label,
    icon: item.icon,
    badge: item.id === "inbox" ? unread || undefined : undefined,
  }));
  // Development-only (HM-DATA-EDITOR-0.1): hiding this link is a
  // convenience, not the real guard -- /editor/* and /api/editor/* both
  // independently re-check the same flag server-side regardless of
  // whether this item is rendered. Kept out of CAREER_NAV_ITEMS entirely
  // (Spec §32: derive dev visibility from the editor flag, never mix it
  // into normal career navigation's source of truth).
  if (editorEnabled) {
    nav.push({ id: "editor", href: "/editor", label: "Editor", icon: "editor" });
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
  const competitionName = COMPETITIONS.find((c) => c.id === career.competitionId)?.name ?? "Ligan";
  const nextEventDate = getNextEventDate(career);
  const activeNavId = resolveActiveNavId(pathname);
  // HM-MATCH-1.3A Part F/G: "a live match is a persistent career
  // session, not a page" -- the global shell must know one is in
  // progress (Part F: a visible route back) and must never let the
  // global Continue control silently advance/finish it (Part G: a hard
  // invariant). PRE_MATCH/FULL_TIME are excluded -- PRE_MATCH is
  // transient (a session always kicks off immediately on creation), and
  // once FULL_TIME is reached Continue is explicitly allowed again
  // (Part I).
  const activeSession = career.activeMatchSession;
  const isLiveMatchActive = Boolean(career.productionMatch) || (activeSession !== null && activeSession.clock.phase !== "PRE_MATCH" && activeSession.clock.phase !== "FULL_TIME");
  const liveMatchHref = career.productionMatch ? `/career/match-day/${career.productionMatch.fixture.id}` : activeSession ? `/career/match-day/${activeSession.fixtureId}` : null;
  const isOnLiveMatchRoute = liveMatchHref !== null && pathname === liveMatchHref;
  // Part F: "MATCH PÅGÅR / Hammarby 7–5 Skånela · 13:00" -- a visible,
  // non-obnoxious banner replacing the ordinary date/next-event subline
  // whenever the manager has navigated away from an in-progress match.
  // Reuses the exact same pure selector Live Match itself uses
  // (liveMatchView.ts) rather than re-deriving score from events itself.
  const liveMatchFixture = activeSession ? career.fixtures.find((f) => f.id === activeSession.fixtureId) : undefined;
  const liveMatchResult = activeSession ? career.results[activeSession.fixtureId] : undefined;
  const liveMatchBanner =
    isLiveMatchActive && !isOnLiveMatchRoute && liveMatchFixture && liveMatchResult
      ? (() => {
          const view = computeLiveMatchView(liveMatchResult, activeSession!.clock);
          const home = getClub(liveMatchFixture.homeClubId);
          const away = getClub(liveMatchFixture.awayClubId);
          return `MATCH PÅGÅR · ${home?.shortName ?? "?"} ${view.homeScore}–${view.awayScore} ${away?.shortName ?? "?"} · ${formatMatchMinute(view.clockMinute)}`;
        })()
      : null;
  // HM-CAREER-0.5: while non-null, the processing overlay is showing a
  // day-by-day replay of a CONTINUE press that has ALREADY fully run and
  // committed (see ContinueProcessingOverlay.tsx's own doc) -- navigation
  // is deferred until the reveal finishes or the manager skips it.
  const [processing, setProcessing] = useState<{ days: ProcessingDay[]; navigate: () => void } | null>(null);

  function navigateAfterContinue(events: CareerEvent[], stopReason: ContinueStopReason) {
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

  function handleContinue() {
    // HM-MATCH-1.3A Part G (hard invariant): while a match is actively
    // live, this button must never call continueCareer() -- outside the
    // Live Match route it instead navigates back to the match (Part F);
    // on the route itself it is disabled entirely (see the button's own
    // `disabled` below), so this branch only ever handles the
    // off-route case.
    if (isLiveMatchActive) {
      if (liveMatchHref && !isOnLiveMatchRoute) {
        router.push(liveMatchHref);
      }
      return;
    }
    const { events, stopReason, daysProcessed, startDate } = continueCareer();
    if (daysProcessed === 0) {
      // ACTION_REQUIRED_PENDING (an unresolved matchday) or SEASON_COMPLETE -- nothing was actually processed, so nothing to visibly replay.
      navigateAfterContinue(events, stopReason);
      return;
    }
    const days: ProcessingDay[] = [];
    for (let i = 0; i < daysProcessed; i += 1) {
      const date = addDays(startDate, i);
      days.push({ date, events: events.filter((e) => e.date === date) });
    }
    setProcessing({ days, navigate: () => navigateAfterContinue(events, stopReason) });
  }

  function handleProcessingFinished() {
    const navigate = processing?.navigate;
    setProcessing(null);
    navigate?.();
  }

  return (
    <div className="hm-shell">
      <aside className="hm-sidebar">
        <div className="hm-club-badge">
          <ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} size={32} />
          <div>
            <div className="hm-club-name">{club.name}</div>
            <div className="hm-club-sub">{competitionName}</div>
          </div>
        </div>
        <div className="hm-nav-group">
          {nav.map((item) => {
            const active = item.id === activeNavId || (item.id === "editor" && pathname.startsWith("/editor"));
            return (
              <Link
                key={item.href}
                className="hm-nav-item"
                data-active={active}
                href={item.href}
              >
                <span className="hm-nav-icon">
                  <NavIcon name={item.icon} />
                </span>
                <span>{item.label}</span>
                {item.badge ? <span className="hm-nav-badge">{item.badge}</span> : null}
              </Link>
            );
          })}
        </div>
      </aside>

      <header className="hm-header">
        <div className="hm-header-title">
          <div className="hm-header-title-text">{club.name}</div>
          <div className="hm-header-sub">
            {liveMatchBanner ?? (
              <>
                {formatGameDate(career.gameDate)}
                {career.seasonComplete ? " · Säsongen avslutad" : nextEventDate ? ` · Nästa: ${formatGameDate(nextEventDate)}` : ""}
              </>
            )}
          </div>
        </div>
        <div className="hm-header-meta">
          <span>Manager: Du</span>
          <button
            type="button"
            className="hm-btn hm-btn-primary"
            onClick={handleContinue}
            disabled={career.seasonComplete || processing !== null || (isLiveMatchActive && isOnLiveMatchRoute)}
            title={isLiveMatchActive && !isOnLiveMatchRoute ? "En match pågår -- gå tillbaka för att fortsätta coacha." : undefined}
          >
            {isLiveMatchActive ? (isOnLiveMatchRoute ? "Match pågår" : "TILLBAKA TILL MATCH") : career.seasonComplete ? "Säsong klar" : "Fortsätt »"}
          </button>
        </div>
      </header>

      <main className="hm-main"><div style={{ display: 'flex', justifyContent: 'end', marginBottom: 12 }}><CareerSaveControl /></div>{children}</main>
      {processing ? <ContinueProcessingOverlay days={processing.days} onFinished={handleProcessingFinished} /> : null}
    </div>
  );
}
