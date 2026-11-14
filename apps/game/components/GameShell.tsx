"use client";

import { useCallback, useEffect, useState } from "react";
import { useMoney } from "@/lib/settings/usePreferences";
import { usePathname, useRouter } from "next/navigation";
import Link from 'next/link';
import type { ReactNode } from "react";
import ClubCrest from "./ClubCrest";
import CareerSaveControl from './CareerSaveControl';
import CommandPalette, { useCommandPaletteHotkey } from './shell/CommandPalette';
import WeekSpine from './shell/WeekSpine';
import NavIcon, { type NavIconName } from "./NavIcon";
import ContinueProcessingOverlay, { type ProcessingDay } from "./ContinueProcessingOverlay";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub } from "@/lib/career/careerWorld";
import { activeClubVisualIdentity, clubIdentityStyle } from "@/lib/career/activeClubIdentity";
import { ClubIdentityTags } from "./game/ClubIdentityTags";
import type { CSSProperties } from "react";
import { getNextEventDate } from "@/lib/career/calendar";
import { addDays, formatGameDate } from "@/lib/career/dateUtils";
import { CAREER_NAV_ITEMS, resolveActiveNavId } from "@/lib/career/navigation";
import { CAREER_HUBS, MOBILE_TAB_HUBS, hubHref, hubTabs, resolveHubRoute } from "@/lib/career/hubs";
import { COMPETITIONS, getClub } from "@/lib/game-data";
import { computeLiveMatchView } from "@/lib/liveMatch/liveMatchView";
import { formatMatchMinute } from "@/lib/liveMatch/commentary";
import { progressionNotice, type ProgressionNotice } from './game/progressionPresentation';
import { resolveContextualContinueAction } from '@/lib/career/contextualContinueAction';
import { matchDayHref } from '@/lib/career/fixtureRoutes';

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
  const money = useMoney();
  const { career, save, continueCareer } = useCareer();
  const unread = career.inbox.filter((m) => !m.read && !m.archived).length;
  const editorEnabled = useEditorEnabled();
  const nav = useNav(unread, editorEnabled);
  const club = getCareerClub(career);
  // Club Identity C5: the whole experience follows the club the manager actually leads (clubless: orange).
  const identity = activeClubVisualIdentity(career);
  const { style: identityStyle, dataIdentity } = clubIdentityStyle(identity);
  const clubless = identity.kind === "clubless";
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
  const liveMatchHref = career.productionMatch ? matchDayHref(career.productionMatch.fixture.id) : activeSession ? matchDayHref(activeSession.fixtureId) : null;
  const isOnLiveMatchRoute = liveMatchHref !== null && pathname === liveMatchHref;
  const contextualAction = resolveContextualContinueAction(
    career,
    activeSession ? { fixtureId: activeSession.fixtureId, clock: { phase: activeSession.clock.phase } } : null,
    pathname
  );
  // Part F: "MATCH PÅGÅR / Hammarby 7–5 Skånela · 13:00" -- a visible,
  // non-obnoxious banner replacing the ordinary date/next-event subline
  // whenever the manager has navigated away from an in-progress match.
  // Reuses the exact same pure selector Live Match itself uses
  // (liveMatchView.ts) rather than re-deriving score from events itself.
  const liveMatchFixture = activeSession ? career.fixtures.find((f) => f.id === activeSession.fixtureId) : undefined;
  const liveMatchResult = activeSession ? career.results[activeSession.fixtureId] : undefined;
  const liveMatchBanner =
    isLiveMatchActive && !isOnLiveMatchRoute
      ? career.productionMatch
        ? (() => {
            const pm = career.productionMatch;
            const home = getClub(pm.fixture.homeClubId);
            const away = getClub(pm.fixture.awayClubId);
            const mins = Math.floor(pm.core.officialClock.timeMs / 60000);
            const secs = String(Math.floor(pm.core.officialClock.timeMs / 1000) % 60).padStart(2, "0");
            return `MATCH PÅGÅR · ${home?.shortName ?? "?"} ${pm.core.score.HOME}–${pm.core.score.AWAY} ${away?.shortName ?? "?"} · ${mins}:${secs}`;
          })()
        : liveMatchFixture && liveMatchResult
          ? (() => {
              const view = computeLiveMatchView(liveMatchResult, activeSession!.clock);
              const home = getClub(liveMatchFixture.homeClubId);
              const away = getClub(liveMatchFixture.awayClubId);
              return `MATCH PÅGÅR · ${home?.shortName ?? "?"} ${view.homeScore}–${view.awayScore} ${away?.shortName ?? "?"} · ${formatMatchMinute(view.clockMinute)}`;
            })()
          : null
      : null;
  // HM-CAREER-0.5: while non-null, the processing overlay is showing a
  // day-by-day replay of a CONTINUE press that has ALREADY fully run and
  // committed (see ContinueProcessingOverlay.tsx's own doc) -- navigation
  // is deferred until the reveal finishes or the manager skips it.
  const [processing, setProcessing] = useState<{ days: ProcessingDay[]; notice: ProgressionNotice } | null>(null);
  const [notice, setNotice] = useState<ProgressionNotice | null>(null);
  // HM-ALPHA3-M10: a matchday notice is shown only while that match is still to be played (it stayed up after the match).
  // HM-ALPHA3-M10: on a phone the sidebar is a menu the header opens; it closes on navigation and Escape.
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => { setNavOpen(false); }, [pathname]);
  // ENT-08a: Ctrl/Cmd+K opens the command palette anywhere in the career.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const openPalette = () => { setNavOpen(false); setPaletteOpen(true); };
  useCommandPaletteHotkey(openPalette);
  // ENT-07: keys 1-6 jump to the six hubs (never while typing, never during a live match).
  const { hub: activeHub } = resolveHubRoute(pathname);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || paletteOpen || isOnLiveMatchRoute) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > CAREER_HUBS.length) return;
      e.preventDefault();
      router.push(hubHref(CAREER_HUBS[n - 1]!));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, isOnLiveMatchRoute, router]);
  // Desktop rail: collapsed (64px) or pinned open (220px); a per-device convenience only.
  // The shell only renders on the client (after the save loads), so the lazy initialisers can read the device.
  const [railPinned, setRailPinned] = useState<boolean | null>(() => { try { const v = window.localStorage.getItem("hm-rail-pinned"); return v === null ? null : v === "1"; } catch { return null; } });
  // Default by width: pinned open from 1360px, collapsed below (tables get the room); the toggle overrides it.
  const [wide, setWide] = useState(() => typeof window === "undefined" || window.matchMedia("(min-width: 1360px)").matches);
  useEffect(() => { const mq = window.matchMedia("(min-width: 1360px)"); const on = () => setWide(mq.matches); mq.addEventListener("change", on); return () => mq.removeEventListener("change", on); }, []);
  const railOpen = railPinned ?? wide;
  const toggleRail = () => { const next = !railOpen; setRailPinned(next); try { window.localStorage.setItem("hm-rail-pinned", next ? "1" : "0"); } catch { /* convenience only */ } };
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setNavOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  function handleContinue() {
    // If the contextual action targets a specific destination route, navigate directly
    if (contextualAction.targetHref) {
      router.push(contextualAction.targetHref);
      return;
    }
    // Hard invariant: never advance if live match is active or season is complete
    if (isLiveMatchActive || career.seasonComplete) {
      return;
    }
    const { events, stopReason, daysProcessed, startDate } = continueCareer();
    const summary = progressionNotice(events, stopReason, career.careerEvents.find(e => e.requiresAction && !e.resolved));
    if (daysProcessed === 0) {
      setNotice(summary);
      router.push(summary.navigateHref);
      return;
    }
    const days: ProcessingDay[] = [];
    for (let i = 0; i < daysProcessed; i += 1) {
      const date = addDays(startDate, i);
      days.push({ date, events: events.filter((e) => e.date === date) });
    }
    setProcessing({ days, notice: summary });
  }

  const handleProcessingFinished = useCallback(() => {
    if (!processing) return;
    setNotice(processing.notice);
    setProcessing(null);
    router.push(processing.notice.navigateHref);
  }, [processing, router, setNotice, setProcessing]);

  const gameState = career.productionMatch ? 'live' : career.seasonComplete ? 'season-complete' : career.fixtures.some(f => f.date===career.gameDate && !career.results[f.id] && (f.homeClubId===career.playerClubId || f.awayClubId===career.playerClubId)) ? 'matchday' : 'season';
  const inboxBadge = unread ? <span className="hm-nav-badge" aria-hidden="true">{unread}</span> : null;
  const continueButton = (className: string) => <button
    type="button"
    className={`hm-btn hm-btn-primary game-continue ${className}`}
    aria-label={contextualAction.ariaLabel}
    onClick={handleContinue}
    disabled={contextualAction.disabled || processing !== null}
    title={contextualAction.tooltip}
  >
    {contextualAction.label}
    <small>{contextualAction.sublabel}</small>
  </button>;
  const activeTab = nav.find(item => item.id === activeNavId);
  return (
    <div className="hm-shell" data-club-identity={dataIdentity} style={identityStyle as CSSProperties} data-game-state={gameState} data-rail={railOpen ? 'pinned' : 'collapsed'} data-spine={isOnLiveMatchRoute ? 'hidden' : 'shown'} data-route={isOnLiveMatchRoute ? 'live-match' : pathname === '/career/match-preview' ? 'matchday' : undefined}>
      <a href="#manager-content" className="hm-skip-link">Till innehållet</a>
      {navOpen && <div className="hm-nav-scrim" aria-hidden="true" onClick={() => setNavOpen(false)} />}
      <aside className="hm-sidebar" id="hm-sidebar" data-open={navOpen} aria-label="Huvudnavigering">
        <Link href="/career" className="hm-wordmark"><span className="hm-monogram">HM</span><span>HANDBALL<br /><strong>MANAGER</strong></span></Link>
        <div className="hm-club-badge">
          {clubless ? <span className="hm-clubless-mark" aria-hidden="true">HM</span> : <ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={64} />}
          <div>
            <div className="hm-club-name">{clubless ? "Utan klubb" : club.name}</div>
            <div className="hm-club-sub">{clubless ? `Tidigare ${club.shortName}` : competitionName}</div>
            {!clubless && <ClubIdentityTags clubId={club.id} seasonId={career.seasonId} compact />}
          </div>
        </div>
        <nav className="hm-nav-group hm-rail" aria-label="Hubbar">
          {CAREER_HUBS.map((hub, index) => {
            const active = activeHub?.id === hub.id;
            return (
              <div key={hub.id} className="hm-rail-hub" data-active={active}>
                <Link className="hm-nav-item hm-rail-link" data-active={active} href={hubHref(hub)} aria-label={hub.label} aria-current={active ? 'page' : undefined} title={`${hub.label} (${index + 1})`}>
                  <span className="hm-nav-icon"><NavIcon name={hub.icon} /></span>
                  <span className="hm-rail-label">{hub.label}</span>
                  <kbd className="hm-rail-key" aria-hidden="true">{index + 1}</kbd>
                </Link>
                <ul className="hm-rail-sub" aria-label={`${hub.label}: sidor`}>
                  {hubTabs(hub).map((tab) => <li key={tab.id}><Link href={tab.href} data-active={tab.id === activeNavId} aria-current={tab.id === activeNavId ? 'page' : undefined}>{tab.label}{tab.id === 'inbox' ? inboxBadge : null}</Link></li>)}
                </ul>
              </div>
            );
          })}
        </nav>
        <div className="hm-rail-foot">
          <Link className="hm-nav-item hm-rail-link" href="/career/inbox" data-active={activeNavId === 'inbox'} aria-label={`Inkorg, ${unread} olästa`} title="Inkorg">
            <span className="hm-nav-icon"><NavIcon name="inbox" /></span><span className="hm-rail-label">Inkorg</span>{inboxBadge}
          </Link>
          {nav.filter(item => item.id === 'settings' || item.id === 'editor').map(item => (
            <Link key={item.id} className="hm-nav-item hm-rail-link" href={item.href} data-active={item.id === activeNavId || (item.id === 'editor' && pathname.startsWith('/editor'))} aria-label={item.label} title={item.label}>
              <span className="hm-nav-icon"><NavIcon name={item.icon} /></span><span className="hm-rail-label">{item.label}</span>
            </Link>
          ))}
          <button type="button" className="hm-rail-pin" onClick={toggleRail} aria-expanded={railOpen} aria-label={railOpen ? 'Fäll ihop menyn' : 'Fäst menyn öppen'} title={railOpen ? 'Fäll ihop menyn' : 'Fäst menyn öppen'}><span aria-hidden="true">{railOpen ? '«' : '»'}</span></button>
        </div>
        <div className="hm-sidebar-footer"><span>{save.manager.name}</span><Link href="/load-game">Sparade karriärer →</Link>{navOpen && <div className="hm-sidebar-save"><CareerSaveControl /></div>}</div>
      </aside>

      <header className="hm-header">
        <div className="hm-header-title">
          <div className="hm-header-title-text">{clubless ? "Utan klubb" : club.name} <span className="hm-text-muted"> / {career.seasonId}</span></div>
          <div className="hm-header-sub">
            {liveMatchBanner ?? (
              <>
                {formatGameDate(career.gameDate)}
                {career.seasonComplete ? " · Säsongen avslutad" : nextEventDate ? ` · Nästa: ${formatGameDate(nextEventDate)}` : ""}
              </>
            )}
          </div>
        </div>
        <button type="button" className="hm-palette-trigger" onClick={openPalette} aria-haspopup="dialog" aria-label="Sök spelare, klubbar, tävlingar och sidor (Ctrl+K)">
          <span aria-hidden="true">⌕</span><span className="hm-palette-trigger-text">Sök eller gå till…</span><kbd aria-hidden="true">Ctrl K</kbd>
        </button>
        <div className="hm-header-meta">
          <CareerSaveControl compact />
          {continueButton('hm-continue-header')}
        </div>
      </header>

      {!isOnLiveMatchRoute && <div className="hm-spine-row"><WeekSpine career={career} expanded={pathname === '/career'} /></div>}

      <main className="hm-main" id="manager-content">
        <div className="hm-context-bar hm-hub-header">
          <div className="hm-actions"><button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => router.back()} aria-label="Tillbaka i navigationen">←</button><button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => router.forward()} aria-label="Framåt i navigationen">→</button>
            <nav aria-label="Brödsmulor" className="hm-breadcrumb"><Link href="/career">Kontoret</Link><span aria-hidden="true">›</span><span>{activeHub?.label ?? 'Spelet'}</span><span aria-hidden="true">›</span><span>{activeTab?.label ?? 'Detalj'}</span></nav>
          </div>
          <Link href="/career/inbox">{unread} olästa meddelanden</Link>
        </div>
        {activeHub && hubTabs(activeHub).length > 1 && <nav className="hm-hub-tabs" aria-label={`${activeHub.label}: flikar`}>
          {hubTabs(activeHub).map((tab) => <Link key={tab.id} href={tab.href} data-active={tab.id === activeNavId} aria-current={tab.id === activeNavId ? 'page' : undefined}>{tab.label}{tab.id === 'inbox' && unread ? <span className="hm-nav-badge" aria-hidden="true">{unread}</span> : null}</Link>)}
        </nav>}
        {notice && (notice.kind !== 'matchday' || career.careerEvents.some(e => e.id === notice.event?.id && !e.resolved)) && <aside className="game-progression-notice" aria-label="Senaste tidsförflyttningen"><div role="status"><strong>{money.text(notice.title)}</strong><p>{money.text(notice.detail)}</p></div><Link className="hm-btn hm-btn-sm" href={notice.actionHref}>{notice.actionLabel}</Link><button className="hm-btn hm-btn-sm hm-btn-ghost" aria-label="Stäng händelsebesked" onClick={() => setNotice(null)}>×</button></aside>}
        {children}
      </main>

      <div className="hm-mobile-dock">
        {continueButton('hm-continue-dock')}
        <nav className="hm-mobile-tabs" aria-label="Hubbar (mobil)">
          {MOBILE_TAB_HUBS.map((id) => CAREER_HUBS.find(h => h.id === id)!).map((hub) => (
            <Link key={hub.id} href={hubHref(hub)} data-active={activeHub?.id === hub.id} aria-current={activeHub?.id === hub.id ? 'page' : undefined}>
              <NavIcon name={hub.icon} /><span>{hub.shortLabel}</span>{hub.id === 'idag' ? inboxBadge : null}
            </Link>
          ))}
          <button type="button" onClick={() => setNavOpen((o) => !o)} aria-controls="hm-sidebar" aria-expanded={navOpen} data-active={navOpen || activeHub?.id === 'klubben' || activeHub?.id === 'karriar'}>
            <span aria-hidden="true" className="hm-mobile-more">⋯</span><span>Mer</span>
          </button>
        </nav>
      </div>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {processing ? <ContinueProcessingOverlay days={processing.days} notice={processing.notice} clubName={club.name} clubShortName={club.shortName} season={career.seasonId} onFinished={handleProcessingFinished} /> : null}
    </div>
  );
}
