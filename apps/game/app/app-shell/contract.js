// Generated from contract.ts by integrate-app-shell.mjs.
import { APP_REGISTRY } from "./app-registry.js";
export const APP_SHELL_VERSION = "3.1.0";
export const APP_SHELL_LINKS = [
    { label: "← Tillbaka till Apps", href: "https://starkv.is/apps" },
    { label: "STARKVIS", href: "https://starkv.is" },
    { label: "Journal", href: "https://starkv.is/journal" },
    { label: "Sagorna", href: "https://starkv.is/sagorna" },
    { label: "STARKVIS OS", href: "https://app.starkv.is" },
];
// Hosts may supply this only in development. Both ends must be loopback.
export function appShellLinks(appsReturnUrl, currentUrl) {
    if (!appsReturnUrl || !currentUrl)
        return APP_SHELL_LINKS;
    const loopback = (url) => url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && !url.username && !url.password;
    try {
        const target = new URL(appsReturnUrl);
        if (!loopback(target) || !loopback(new URL(currentUrl)) || target.pathname !== "/apps" || target.search || target.hash)
            return APP_SHELL_LINKS;
        return APP_SHELL_LINKS.map((link, index) => index === 0 ? { ...link, href: target.href } : link);
    }
    catch {
        return APP_SHELL_LINKS;
    }
}
export function shellApps(preview, currentUrl) {
    const local = (url) => url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && !url.username && !url.password;
    return APP_REGISTRY.map(app => {
        if (app.action.kind !== "navigate")
            return { ...app, launchHref: undefined };
        let launchHref = app.action.href;
        try {
            const destination = preview?.[app.id];
            const candidate = destination ? new URL(destination) : undefined;
            if (candidate && local(new URL(currentUrl)) && local(candidate) && !candidate.search && !candidate.hash && [app.route, app.proposedRoute].includes(candidate.pathname))
                launchHref = candidate.href;
        }
        catch { /* Keep the authoritative production destination. */ }
        return { ...app, launchHref };
    });
}
