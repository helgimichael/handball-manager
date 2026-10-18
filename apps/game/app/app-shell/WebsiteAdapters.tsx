"use client";
/* eslint-disable @next/next/no-img-element -- The actual website image is embedded for offline Vite/Next parity. */
import { createContext, useContext, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react";
import { WEBSITE_LOGO } from "./website-logo.js";

export const WebsiteNavbarContext = createContext<{ appsUrl: string; appsOpen: boolean; onApps: (element: HTMLElement, focusFirst?: boolean) => void }>({ appsUrl: "https://starkv.is/apps", appsOpen: false, onApps: () => {} });

export function WebsiteLink({ href = "", onClick, onKeyDown, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const context = useContext(WebsiteNavbarContext);
  const apps = href === "/apps";
  const destination = apps ? context.appsUrl : href.startsWith("/") ? "https://starkv.is" + href : href;
  return <a {...props} href={destination} data-sv-apps-trigger={apps ? "" : undefined} aria-haspopup={apps ? "true" : undefined} aria-expanded={apps ? context.appsOpen : undefined} aria-controls={apps ? "sv-app-switcher" : undefined} onClick={event => {
    if (apps) { event.preventDefault(); context.onApps(event.currentTarget, event.detail === 0); onClick?.(event); }
    // Original same-page scroll handlers belong to the website origin only.
    else if (window.location.origin === "https://starkv.is") onClick?.(event);
  }} onKeyDown={event => {
    if (apps && [" ", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      // Preserve the source mobile menu's close action, then focus the list.
      event.currentTarget.click();
    }
    else onKeyDown?.(event);
  }} />;
}

export function WebsiteImage(props: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean; quality?: number }) {
  const attributes = { ...props };
  delete attributes.priority; delete attributes.quality;
  return <img {...attributes} src={WEBSITE_LOGO} alt={props.alt} style={{ color: "transparent", ...props.style }} />;
}
