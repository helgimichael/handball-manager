"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { getCareerClub, getCareerPlayer } from "@/lib/career/careerWorld";
import { activeClubVisualIdentity, clubIdentityStyle } from "@/lib/career/activeClubIdentity";
import { ClubIdentityTags } from "./game/ClubIdentityTags";
import type { CSSProperties } from "react";
import { getNextEventDate } from "@/lib/career/calendar";
import { addDays, formatGameDate } from "@/lib/career/dateUtils";
import { CAREER_NAV_ITEMS, resolveActiveNavId } from "@/lib/career/navigation";
import { CAREER_HUBS, MOBILE_TAB_HUBS, hubHref, hubTabs, resolveHubRoute } from "@/lib/career/hubs";
import { COMPETITIONS, getClub, getCompetition } from "@/lib/game-data";
import { computeLiveMatchView } from "@/lib/liveMatch/liveMatchView";
import { formatMatchMinute } from "@/lib/liveMatch/commentary";
import { progressionNotice, type ProgressionNotice } from './game/progressionPresentation';
import { resolveContextualContinueAction } from '@/lib/career/contextualContinueAction';
import { matchDayHref } from '@/lib/career/fixtureRoutes';
import { buildBreadcrumb, parentCrumb } from './shell/breadcrumb';
import { pushStop, stopInboxHref, stopKey, stopKicker } from './shell/eventStops';
import { registerFeedbackContext } from './FeedbackModal';
import './shell/shell-231.css';

type NavEntry = { id: string; href: string; label: string; icon: NavIconName; badge?: number };

function useNav(unread: number): readonly NavEntry[] {
  // The editor is reached from the DEV corner tab (SYS-06, app/EditorModeWidget.tsx), not from career navigation.
  return CAREER_NAV_ITEMS.map((item) => ({
    id: item.id,
    href: item.href,
    label: item.label,
    icon: item.icon,
    badge: item.id === "inbox" ? unread || undefined : undefined,
  }));
}

export default function GameShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const money = useMoney();
  const { career, save, continueCareer } = useCareer();
  const unread = career.inbox.filter((m) => !m.read && !m.archived).length;
  const nav = useNav(unread);
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
  // ENT-13 A: the same facts as a structured live-score pill (crests, score, clock, state, last events).
  const liveMatch: LivePillData | null =
    isLiveMatchActive && !isOnLiveMatchRoute
      ? career.productionMatch
        ? (() => {
            const pm = career.productionMatch;
            const mins = Math.floor(pm.core.officialClock.timeMs / 60000);
            const secs = String(Math.floor(pm.core.officialClock.timeMs / 1000) % 60).padStart(2, "0");
            const phase = (pm.core as { match?: { phase?: string } }).match?.phase;
            return { homeId: pm.fixture.homeClubId, awayId: pm.fixture.awayClubId, home: pm.core.score.HOME, away: pm.core.score.AWAY, clock: `${mins}:${secs}`, state: phase === "HALFTIME" || pm.pausedAtHalf ? "Halvtid" : "Pågår", recent: "" };
          })()
        : liveMatchFixture && liveMatchResult
          ? (() => {
              const view = computeLiveMatchView(liveMatchResult, activeSession!.clock);
              const phase = activeSession!.clock.phase;
              const sideName = (side: string) => getClub(side === "home" ? liveMatchFixture.homeClubId : liveMatchFixture.awayClubId)?.shortName ?? "";
              const recent = view.revealedEvents.slice(-3).reverse().map((e) => `${formatMatchMinute(e.minute)} ${e.type === "GOAL" ? "Mål" : e.type === "SAVE" ? "Räddning" : e.type === "MISS" ? "Miss" : String(e.type)} ${sideName(String(e.side))}`).join(" · ");
              return { homeId: liveMatchFixture.homeClubId, awayId: liveMatchFixture.awayClubId, home: view.homeScore, away: view.awayScore, clock: formatMatchMinute(view.clockMinute), state: phase === "HALF_TIME" ? "Halvtid" : phase === "TIMEOUT" ? "Timeout" : activeSession!.clock.speed === "PAUSED" ? "Paus" : "Pågår", recent };
            })()
          : null
      : null;
  // HM-CAREER-0.5: while non-null, the processing overlay is showing a
  // day-by-day replay of a CONTINUE press that has ALREADY fully run and
  // committed (see ContinueProcessingOverlay.tsx's own doc) -- navigation
  // is deferred until the reveal finishes or the manager skips it.
  const [processing, setProcessing] = useState<{ days: ProcessingDay[]; notice: ProgressionNotice } | null>(null);
  // ENT-09a C: every stop is kept as a numbered pin on the Spine; one at a time expands into the event card.
  const [stops, setStops] = useState<ProgressionNotice[]>([]);
  const [openStop, setOpenStop] = useState<string | null>(null);
  const setNotice = useCallback((n: ProgressionNotice) => { setStops((prev) => pushStop(prev, n)); setOpenStop(stopKey(n)); }, []);
  // HM-ALPHA3-M10: a matchday notice is shown only while that match is still to be played (it stayed up after the match).
  // HM-ALPHA3-M10: on a phone the sidebar is a menu the header opens; it closes on navigation and Escape.
  const [navOpen, setNavOpen] = useState(false);
  const [navPath, setNavPath] = useState(pathname);
  if (navPath !== pathname) { setNavPath(pathname); setNavOpen(false); }
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
    // ENT-10a: a single-day advance shows no dialog -- only the Spine ticks and the stop lands on it.
    if (daysProcessed <= 1) {
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
  // A matchday stop disappears once the match is played (it stayed up after the match before HM-ALPHA3-M10).
  const liveStops = stops.filter((n) => n.kind !== 'matchday' || career.careerEvents.some(e => e.id === n.event?.id && !e.resolved));
  const expanded = liveStops.find((n) => stopKey(n) === openStop) ?? null;
  // ENT-09a: N cycles through the pinned stops (never while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'n' || liveStops.length === 0) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const i = liveStops.findIndex((n) => stopKey(n) === openStop);
      setOpenStop(stopKey(liveStops[(i + 1) % liveStops.length]!));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [liveStops, openStop]);
  // ENT-09: a true path from the hub map; detail pages name their object.
  const crumbs = useMemo(() => buildBreadcrumb(pathname, {
    player: (id) => { const p = getCareerPlayer(career, id); return p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || undefined : undefined; },
    club: (id) => getClub(id)?.name, competition: (id) => getCompetition(id)?.name,
  }), [pathname, career]);
  const backCrumb = parentCrumb(crumbs);
  // ENT-11: the report dialog pre-fills where the manager is.
  useEffect(() => { registerFeedbackContext({ club: club.name, gameDate: career.gameDate, season: career.seasonId }); return () => registerFeedbackContext(null); }, [club.name, career.gameDate, career.seasonId]);
  // ENT-10a: a match stop builds up to a floodlight card with both crests.
  const overlayMatch = useMemo(() => {
    if (!processing || processing.notice.kind !== 'matchday') return null;
    const last = processing.days.at(-1)?.date;
    const f = career.fixtures.find((x) => x.date === last && (x.homeClubId === career.playerClubId || x.awayClubId === career.playerClubId));
    const home = f ? getClub(f.homeClubId) : undefined, away = f ? getClub(f.awayClubId) : undefined;
    return f && home && away ? { home, away, label: f.type === 'LEAGUE' ? `${competitionName} omg ${f.round}` : undefined } : null;
  }, [processing, career.fixtures, career.playerClubId, competitionName]);

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
          {nav.filter(item => item.id === 'settings').map(item => (
            <Link key={item.id} className="hm-nav-item hm-rail-link" href={item.href} data-active={item.id === activeNavId} aria-label={item.label} title={item.label}>
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
          {!liveMatch && <div className="hm-header-sub">
            {formatGameDate(career.gameDate)}
            {career.seasonComplete ? " · Säsongen avslutad" : nextEventDate ? ` · Nästa: ${formatGameDate(nextEventDate)}` : ""}
          </div>}
        </div>
        {liveMatch && liveMatchHref && <LivePill href={liveMatchHref} m={liveMatch} className="hm-live-pill-header" />}
        <button type="button" className="hm-palette-trigger" onClick={openPalette} aria-haspopup="dialog" aria-label="Sök spelare, klubbar, tävlingar och sidor (Ctrl+K)">
          <span aria-hidden="true">⌕</span><span className="hm-palette-trigger-text">Sök eller gå till…</span><kbd aria-hidden="true">Ctrl K</kbd>
        </button>
        <div className="hm-header-meta">
          <CareerSaveControl compact />
          {continueButton('hm-continue-header')}
        </div>
      </header>

      {!isOnLiveMatchRoute && <div className="hm-spine-row">
        <WeekSpine career={career} expanded={pathname === '/career'} stopCount={liveStops.length} />
        {liveMatch && liveMatchHref && <div className="hm-live-pill-row"><LivePill href={liveMatchHref} m={liveMatch} /></div>}
        {liveStops.length > 0 && <div className="hm-stop-pins" role="group" aria-label="Därför stannade tiden">
          {liveStops.map((n, i) => { const k = stopKey(n); return <button key={k} type="button" className="hm-stop-pin" data-kind={n.kind} aria-expanded={openStop === k} onClick={() => setOpenStop(openStop === k ? null : k)} title={`${stopKicker(n)}: ${money.text(n.title)} (N bläddrar)`}><b className="ce-num">{i + 1}</b><span>{stopKicker(n)}</span></button>; })}
        </div>}
        {expanded && <aside className="game-progression-notice hm-event-card" data-kind={expanded.kind} aria-label="Därför stannade tiden">
          <div role="status"><span className="hm-event-kicker">{stopKicker(expanded)}</span><strong>{money.text(expanded.title)}</strong><p>{money.text(expanded.detail)}</p></div>
          <div className="hm-event-actions"><Link className="hm-btn hm-btn-sm hm-btn-primary" href={expanded.actionHref}>{expanded.actionLabel}</Link>{stopInboxHref(expanded) && expanded.actionHref !== stopInboxHref(expanded) && <Link className="hm-btn hm-btn-sm" href={stopInboxHref(expanded)!}>Visa i inkorg</Link>}</div>
          <button className="hm-btn hm-btn-sm hm-btn-ghost hm-event-close" aria-label="Fäll ihop händelsen till en nål" title="Fäll ihop (finns kvar som nål)" onClick={() => setOpenStop(null)}>×</button>
        </aside>}
      </div>}

      <main className="hm-main" id="manager-content">
        <nav aria-label="Brödsmulor" className="hm-crumbs">
          <ol>{crumbs.map((c, i) => <li key={`${c.label}-${i}`}>{c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}</li>)}</ol>
          {backCrumb?.href && <Link className="hm-crumbs-back" href={backCrumb.href}>‹ {backCrumb.label}</Link>}
        </nav>
        {activeHub && hubTabs(activeHub).length > 1 && <nav className="hm-hub-tabs" aria-label={`${activeHub.label}: flikar`}>
          {hubTabs(activeHub).map((tab) => <Link key={tab.id} href={tab.href} data-active={tab.id === activeNavId} aria-current={tab.id === activeNavId ? 'page' : undefined}>{tab.label}{tab.id === 'inbox' && unread ? <span className="hm-nav-badge" aria-hidden="true">{unread}</span> : null}</Link>)}
        </nav>}
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
      {processing ? <ContinueProcessingOverlay days={processing.days} notice={processing.notice} club={club} season={career.seasonId} match={overlayMatch} onFinished={handleProcessingFinished} /> : null}
    </div>
  );
}

type LivePillData = { homeId: string; awayId: string; home: number; away: number; clock: string; state: string; recent: string };

/** ENT-13 A: persistent live-score pill -- pulsing dot, both crests, score, clock and state; click returns to the match. */
function LivePill({ href, m, className = '' }: { href: string; m: LivePillData; className?: string }) {
  const home = getClub(m.homeId), away = getClub(m.awayId);
  return <Link className={`hm-live-pill ${className}`} href={href} title={m.recent ? `Senaste: ${m.recent}` : 'Tillbaka till matchen'} aria-label={`Match pågår: ${home?.shortName ?? ''} ${m.home}–${m.away} ${away?.shortName ?? ''}, ${m.clock}, ${m.state}. Tillbaka till matchen.`}>
    <i className="hm-live-dot" aria-hidden="true" />
    {home && <ClubCrest clubId={home.id} shortName={home.shortName} primaryColor={home.primaryColor} size={20} />}
    <b className="ce-num">{m.home}–{m.away}</b>
    {away && <ClubCrest clubId={away.id} shortName={away.shortName} primaryColor={away.primaryColor} size={20} />}
    <span className="ce-num">{m.clock}</span><small>{m.state}</small>
  </Link>;
}
