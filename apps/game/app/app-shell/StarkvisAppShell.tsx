"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { WebsiteNavbar } from "./WebsiteNavbar.js";
import { WebsiteNavbarContext } from "./WebsiteAdapters.js";
import { WEBSITE_STYLES } from "./website-styles.js";
import { appShellLinks, shellApps, APP_SHELL_VERSION, type AppShellProps } from "./contract.js";
import "./shell.css";

function subscribe(listener: () => void) {
  document.addEventListener("fullscreenchange", listener);
  document.addEventListener("webkitendfullscreen", listener, true);
  return () => { document.removeEventListener("fullscreenchange", listener); document.removeEventListener("webkitendfullscreen", listener, true); };
}
function fullscreenHost() {
  const host = document.fullscreenElement;
  if (host && (!(host instanceof HTMLElement) || ["VIDEO", "CANVAS"].includes(host.tagName))) return null;
  return host && host !== document.documentElement ? host : document.body;
}
const serverHost = () => null;
const EXTRA_STYLES = `
:host { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size:16px; line-height:1.5; color:#f4f7f6; -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }
.sv-frame { height:100%; pointer-events:auto; }
[data-website-navbar] { pointer-events:auto; }
.sv-extras { position:absolute; top:100%; left:0; right:0; background:#0a0c0df5; border-block:1px solid #ffffff14; }
.sv-return-row { max-width:1280px; margin:auto; padding:0 max(24px, env(safe-area-inset-left,0px)) 0 max(24px, env(safe-area-inset-right,0px)); display:flex; align-items:center; justify-content:space-between; gap:16px; min-height:44px; font-size:12px; }
.sv-return { display:inline-flex;align-items:center;min-height:44px;color:#00c2b3;text-decoration:none;font-weight:600; }
.sv-context { margin-left:auto; color:#7e8884; font:10px/1.5 ui-monospace,monospace; overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.sv-hide { display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;color:#a9b1af;cursor:pointer;background:transparent;border:0;font:inherit; }
.sv-switcher { position:absolute;top:calc(100% + 4px);left:clamp(12px,var(--sv-switcher-left,24px),max(12px,calc(100vw - 572px)));width:min(560px,calc(100vw - 24px));--sv-switcher-height:min(300px,45dvh,calc(100dvh - var(--sv-navbar-height,80px) - 64px));max-height:var(--sv-switcher-height);background:#0a0c0d;border:1px solid #ffffff1a;border-radius:8px;box-shadow:0 12px 32px #0008;overflow:hidden; }
.sv-switcher-inner { display:flex;flex-direction:column;max-height:calc(var(--sv-switcher-height) - 2px);padding:10px 12px 0; }
.sv-app-groups { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;overflow:auto;overscroll-behavior:contain;min-height:0;padding:0 0 6px; }
.sv-app-group h2 { color:#7e8884;font:10px/1.5 ui-monospace,monospace;letter-spacing:.16em;margin:0 0 6px; }
.sv-app-group ul { list-style:none;margin:0;padding:0; }
.sv-app-group a { display:flex;align-items:center;min-height:32px;padding:5px 6px;color:#f4f7f6;font-size:12px;line-height:20px;text-decoration:none;border-radius:4px; }
.sv-all-apps { display:flex;flex-shrink:0;min-height:44px;align-items:center;color:#00c2b3;font-size:12px;border-top:1px solid #ffffff14; }
.sv-extras :is(a,button):focus-visible { outline:2px solid #00c2b3;outline-offset:2px; }
.sv-extras :is(a,button) { touch-action:manipulation;-webkit-tap-highlight-color:transparent; }
.sv-app-group a:active { background:#ffffff0d; }
@media(hover:hover) and (pointer:fine) { .sv-app-group a:hover,.sv-hide:hover { background:#ffffff0d;color:#00c2b3; } }
@media(min-width:1024px) { .sv-return-row { padding-inline:40px; } }
@media(max-width:767px) { .sv-app-groups { grid-template-columns:1fr;gap:8px; } .sv-context { display:none; } }
@media(pointer:coarse) { .sv-app-group a { min-height:44px; } }
@media(prefers-reduced-motion:reduce) { *,*::before,*::after { transition-duration:0s!important;animation:none!important; } }
`;

export function StarkvisAppShell({ appName, appsReturnUrl, previewDestinations, backgroundFamily }: AppShellProps) {
  const target = useSyncExternalStore(subscribe, fullscreenHost, serverHost);
  const [shadow, setShadow] = useState<ShadowRoot | null>(null);
  const [visible, setVisible] = useState(true);
  const [appsOpen, setAppsOpen] = useState(false);
  const [resolvedDestinations, setResolvedDestinations] = useState<Record<string, string> | undefined>();
  const hostRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const hoverRef = useRef(false);
  const keyboardRef = useRef(false);
  const restoringFocusRef = useRef(false);
  const revealUntilRef = useRef(0);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stateRef = useRef({ visible, appsOpen });
  useLayoutEffect(() => { stateRef.current = { visible, appsOpen }; }, [visible, appsOpen]);
  const attach = useCallback((element: HTMLDivElement | null) => {
    hostRef.current = element;
    if (element) setShadow(element.shadowRoot ?? element.attachShadow({ mode: "open" }));
  }, []);
  const focusInside = useCallback(() => Boolean(shadow?.activeElement || document.activeElement === indicatorRef.current), [shadow]);
  // Shadow portals retarget synthetic enter/leave events. Read the actual
  // pointer hit state before hiding, including the edge-to-header handoff.
  const pointerInside = useCallback(() => Boolean(hostRef.current?.matches(":hover") || indicatorRef.current?.parentElement?.matches(":hover")), []);
  const close = useCallback((restore = false) => {
    setAppsOpen(false); setVisible(false);
    if (restore && document.activeElement !== indicatorRef.current) {
      restoringFocusRef.current = true;
      indicatorRef.current?.focus({ preventScroll: true });
    }
  }, []);
  const show = useCallback(() => {
    clearTimeout(leaveTimerRef.current);
    revealUntilRef.current = performance.now() + 180;
    setVisible(true);
  }, []);
  const leave = useCallback(() => {
    hoverRef.current = false;
    clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      if (!stateRef.current.appsOpen && !pointerInside() && !(keyboardRef.current && focusInside())) close();
    }, Math.max(0, revealUntilRef.current - performance.now()));
  }, [close, focusInside, pointerInside]);
  useEffect(() => () => clearTimeout(leaveTimerRef.current), []);

  useLayoutEffect(() => {
    if (!backgroundFamily) return;
    const body = document.body;
    const previous = body.getAttribute("data-starkvis-app-family");
    body.setAttribute("data-starkvis-app-family", backgroundFamily);
    return () => { if (previous === null) body.removeAttribute("data-starkvis-app-family"); else body.setAttribute("data-starkvis-app-family", previous); };
  }, [backgroundFamily]);

  useLayoutEffect(() => {
    if (!target) return;
    const previous = target.getAttribute("data-starkvis-app-shell-host");
    target.setAttribute("data-starkvis-app-shell-host", "");
    return () => { if (previous === null) target.removeAttribute("data-starkvis-app-shell-host"); else target.setAttribute("data-starkvis-app-shell-host", previous); };
  }, [target]);

  useLayoutEffect(() => {
    if (!shadow) return;
    const header = shadow.querySelector<HTMLElement>("[data-website-navbar]");
    const extras = shadow.querySelector<HTMLElement>(".sv-extras");
    if (!header || !extras) return;
    const measure = () => {
      const height = header.getBoundingClientRect().height;
      hostRef.current?.style.setProperty("--sv-navbar-height", height + "px");
      if (hostRef.current) hostRef.current.style.height = height + extras.getBoundingClientRect().height + "px";
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(header); observer.observe(extras);
    return () => observer.disconnect();
  }, [shadow, target, visible]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      keyboardRef.current = true;
      if (event.key !== "Escape" || !stateRef.current.visible || !focusInside() && !stateRef.current.appsOpen) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (stateRef.current.appsOpen) {
        setAppsOpen(false);
        const trigger = triggerRef.current?.isConnected ? triggerRef.current : shadow?.querySelector<HTMLElement>('[data-website-navbar] button[aria-label="Öppna navigationsmeny"]');
        trigger?.focus({ preventScroll: true });
      }
      else close(true);
    };
    const work = (event: PointerEvent) => {
      keyboardRef.current = false;
      if (event.composedPath().includes(hostRef.current as EventTarget) || event.composedPath().includes(indicatorRef.current as EventTarget)) return;
      close();
    };
    window.addEventListener("keydown", keyboard, true);
    document.addEventListener("pointerdown", work, true);
    return () => { window.removeEventListener("keydown", keyboard, true); document.removeEventListener("pointerdown", work, true); };
  }, [close, focusInside, shadow]);
  useEffect(() => {
    const timer = window.setTimeout(() => { if (!stateRef.current.appsOpen && !pointerInside() && !focusInside()) close(); }, 3000);
    return () => window.clearTimeout(timer);
  }, [close, focusInside, pointerInside, target]);

  useEffect(() => {
    if (!appsReturnUrl || previewDestinations && Object.keys(previewDestinations).length) return;
    if (appShellLinks(appsReturnUrl, window.location.href)[0].href !== appsReturnUrl) return;
    const controller = new AbortController();
    // Only a loopback return URL supplied by the development host can reach here.
    fetch(new URL("/api/apps-preview", appsReturnUrl), { signal: controller.signal, cache: "no-store" })
      .then(response => response.ok ? response.json() : undefined)
      .then(value => { if (value?.appsUrl === appsReturnUrl) setResolvedDestinations(value.destinations); })
      .catch(() => { /* Keep approved production links when no local map exists. */ });
    return () => controller.abort();
  }, [appsReturnUrl, previewDestinations]);

  if (!target) return null;
  const appsUrl = appShellLinks(appsReturnUrl, window.location.href)[0].href;
  const families = ["FIELD", "LENS", "SIGNAL"] as const;
  const apps = shellApps(previewDestinations && Object.keys(previewDestinations).length ? previewDestinations : resolvedDestinations, window.location.href).filter(app => app.launchHref && families.some(family => family === app.family));
  const toggleApps = (element: HTMLElement, focusFirst = false) => {
    triggerRef.current = element; show();
    hostRef.current?.style.setProperty("--sv-switcher-left", Math.max(12, element.getBoundingClientRect().left - 12) + "px");
    setAppsOpen(value => focusFirst || !value);
    if (focusFirst) requestAnimationFrame(() => shadow?.querySelector<HTMLElement>("#sv-app-switcher a")?.focus());
  };
  const extras = <div className="sv-extras">
    <div className="sv-return-row"><a className="sv-return" href={appsUrl}>← Tillbaka till Apps</a><span className="sv-context">{appName}</span><button type="button" className="sv-hide" onClick={() => close(true)} aria-label="Dölj STARKVIS-navigation">⌃</button></div>
    {appsOpen && <nav id="sv-app-switcher" className="sv-switcher" aria-label="Växla app"><div className="sv-switcher-inner">
      <div className="sv-app-groups">{families.map(family => <section key={family} className="sv-app-group"><h2>{family}</h2><ul>{apps.filter(app => app.family === family).map(app => <li key={app.id}><a href={app.launchHref} data-app-id={app.id}>{app.name}</a></li>)}</ul></section>)}</div>
      <a className="sv-all-apps" href={appsUrl}>Visa hela Apps Launcher →</a>
    </div></nav>}
  </div>;
  return createPortal(<>
    <div ref={attach} data-starkvis-shell={APP_SHELL_VERSION} data-revealed={visible} className="sv-website-shell" inert={!visible ? true : undefined}>
      {shadow && createPortal(<><style>{WEBSITE_STYLES + EXTRA_STYLES}</style><div className="sv-frame" onPointerEnter={() => { hoverRef.current = true; }} onPointerLeave={event => {
        if (event.pointerType !== "touch") leave();
      }} onFocusCapture={show} onBlurCapture={() => {
        requestAnimationFrame(() => { if (!stateRef.current.appsOpen && !focusInside() && !pointerInside()) close(); });
      }} onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
        <WebsiteNavbarContext.Provider value={{ appsUrl, appsOpen, onApps: toggleApps }}><WebsiteNavbar onOpenNotify={() => window.location.assign("https://starkv.is")} appExtras={extras} /></WebsiteNavbarContext.Provider>
      </div></>, shadow)}
    </div>
    <div className="sv-reveal-edge" data-header-visible={visible} onPointerEnter={event => { if (event.pointerType !== "touch") { hoverRef.current = true; show(); } }} onPointerLeave={event => { if (event.pointerType !== "touch") leave(); }}>
      <button ref={indicatorRef} type="button" aria-label="Visa STARKVIS-navigation" aria-expanded={visible} className="sv-reveal-control" onFocus={() => { if (restoringFocusRef.current) restoringFocusRef.current = false; else if (keyboardRef.current) show(); }} onClick={() => { if (visible) close(); else show(); }} onKeyDown={event => {
        if (["Enter", " ", "ArrowDown"].includes(event.key)) { event.preventDefault(); show(); requestAnimationFrame(() => shadow?.querySelector<HTMLElement>("[data-website-navbar] a")?.focus()); }
      }}><span aria-hidden="true">⌄</span></button>
    </div>
  </>, target);
}
