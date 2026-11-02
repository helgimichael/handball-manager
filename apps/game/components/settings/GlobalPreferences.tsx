"use client";
// HM-PLAYTEST-01 5.1: device-level preferences, reachable from the start
// screen and New Game as well as from inside a career. Only settings that
// actually change something are offered.
import { useState } from "react";
import { usePreferences } from "@/lib/settings/usePreferences";
import { DISPLAY_CURRENCIES, type DisplayCurrency } from "@/lib/settings/preferences";
import { MATCH_SPEED_OPTIONS } from "@/lib/matchCenter/model";

const CURRENCY_NAME: Record<DisplayCurrency, string> = { EUR: "Euro (EUR)", SEK: "Svenska kronor (SEK)" };

export function GlobalPreferences() {
  const [preferences, update] = usePreferences();
  const [note, setNote] = useState<string | null>(null);
  const save = (patch: Parameters<typeof update>[0], text: string) => setNote(update(patch) ? `${text} Sparat på den här enheten.` : `${text} Webbläsaren tillåter inte att valet sparas – det gäller tills sidan laddas om.`);
  return (
    <div className="hm-settings-global">
      <section className="hm-plan-section" aria-labelledby="pref-currency">
        <header><h2 id="pref-currency">Valuta</h2><p>Hur belopp visas i hela spelet. Klubbarnas ekonomi räknas alltid i samma underliggande värden; bara visningen ändras.</p></header>
        <div className="hm-subnav" role="radiogroup" aria-label="Valuta">{DISPLAY_CURRENCIES.map((c) => <a key={c} href="#pref-currency" role="radio" aria-checked={preferences.displayCurrency === c} aria-current={preferences.displayCurrency === c ? "page" : undefined} onClick={(e) => { e.preventDefault(); save({ displayCurrency: c }, `Belopp visas i ${CURRENCY_NAME[c]}.`); }}>{CURRENCY_NAME[c]}</a>)}</div>
      </section>
      <section className="hm-plan-section" aria-labelledby="pref-speed">
        <header><h2 id="pref-speed">Matchhastighet</h2><p>Vilken hastighet en livematch startar i. Du kan alltid ändra under matchen.</p></header>
        <label className="hm-plan-field" style={{ maxWidth: 360 }}><span>Starthastighet</span>
          <select className="hm-select" value={preferences.defaultMatchSpeed} onChange={(e) => { const v = Number(e.target.value); const o = MATCH_SPEED_OPTIONS.find((x) => x.value === v); save({ defaultMatchSpeed: v }, `Matcher startar i ${o?.label.toLowerCase() ?? v + "×"}.`); }}>
            {MATCH_SPEED_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label} – {o.value}× (en match tar ca {o.note})</option>)}
          </select>
        </label>
      </section>
      <section className="hm-plan-section" aria-labelledby="pref-world">
        <header><h2 id="pref-world">Karriärens världsinställningar</h2><p>Nationer, ligor, klubb och försäsongens längd väljs per karriär när du startar ett nytt spel och sparas i den karriären. De påverkar inte andra sparfiler och kan inte ändras i efterhand.</p></header>
      </section>
      {note && <p role="status" className="hm-status" data-tone="ok">{note}</p>}
    </div>
  );
}
