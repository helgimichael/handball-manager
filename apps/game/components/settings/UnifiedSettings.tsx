"use client";
// Arena 231 -- ENT-05 A / SYS-01 A "Unified settings panel": one component for /settings and /career/settings.
// Left section nav (Visning, Match, Ekonomi, Data), grouped rows (label, real radio control, live preview), instant
// apply, reset per section. Phone: the section list pushes one section at a time. Nothing here touches a save:
// preferences are per device (lib/settings/preferences.ts + displayPreferences.ts).
import { useState, type ReactNode } from "react";
import { usePreferences } from "@/lib/settings/usePreferences";
import { DEFAULT_PREFERENCES, DISPLAY_CURRENCIES, type DisplayCurrency } from "@/lib/settings/preferences";
import { MATCH_SPEED_OPTIONS } from "@/lib/matchCenter/model";
import { EUR_TO_SEK_REFERENCE_RATE, formatEur, formatMoney } from "@/lib/economy/currency";
import { DEFAULT_DISPLAY, TEXT_SIZES, updateDisplayPreferences, useDisplayPreferences, type DensityPreference, type MotionPreference, type TextSizePreference } from "./displayPreferences";
import "./settings.css";

type SectionId = "visning" | "match" | "ekonomi" | "data";
const SECTIONS: { id: SectionId; label: string; note: string }[] = [
  { id: "visning", label: "Visning", note: "Täthet, textstorlek, rörelse, tema" },
  { id: "match", label: "Match", note: "Starthastighet för livematcher" },
  { id: "ekonomi", label: "Ekonomi", note: "Valuta för alla belopp" },
  { id: "data", label: "Data", note: "Säkerhetskopior och sparfiler" },
];
const CURRENCY_NAME: Record<DisplayCurrency, string> = { EUR: "Euro · €", SEK: "Kronor · kr" };
export type EconomyPreviewRow = { label: string; eur: number; unit: string };

export function UnifiedSettings({ scope, economyPreview, clubName, data }: {
  scope: "entry" | "career";
  /** In a career: the club's real budgets, so the currency is chosen on numbers the manager knows. */
  economyPreview?: readonly EconomyPreviewRow[];
  clubName?: string;
  data: ReactNode;
}) {
  const [preferences, update] = usePreferences();
  const display = useDisplayPreferences();
  const [note, setNote] = useState<{ section: SectionId; text: string } | null>(null);
  const [open, setOpen] = useState<SectionId | null>(null);
  const save = (section: SectionId, persisted: boolean, text: string) => setNote({ section, text: persisted ? `${text} Sparat på den här enheten.` : `${text} Webbläsaren tillåter inte att valet sparas – det gäller tills sidan laddas om.` });
  const preview = economyPreview?.length ? economyPreview : [{ label: "Exempel: en månadslön", eur: 4_400, unit: "/mån" }, { label: "Exempel: en övergångssumma", eur: 120_000, unit: "" }];
  const status = (section: SectionId) => <p className="hm-us-status" role="status">{note?.section === section ? note.text : ""}</p>;

  return <div className="hm-us" data-open={open ?? undefined}>
    <nav className="hm-us-nav" aria-label="Inställningar: avsnitt">
      <ul>{SECTIONS.map((s) => <li key={s.id}><a href={`#${s.id}`} aria-current={open === s.id ? "true" : undefined} onClick={() => setOpen(s.id)}><strong>{s.label}</strong><small>{s.note}</small><span aria-hidden="true">›</span></a></li>)}</ul>
      <p className="hm-us-scope">{scope === "career" ? "Gäller den här enheten och alla dina karriärer – samma inställningar som från huvudmenyn." : "Gäller den här enheten och alla dina karriärer."}</p>
    </nav>
    <div className="hm-us-sections">
      <Section id="visning" title="Visning" open={open} onBack={() => setOpen(null)} onReset={display.motion !== DEFAULT_DISPLAY.motion || display.density !== DEFAULT_DISPLAY.density || display.textSize !== DEFAULT_DISPLAY.textSize ? () => save("visning", updateDisplayPreferences({ ...DEFAULT_DISPLAY }), "Visningen är återställd: bekväm täthet, 100 % text, rörelse följer systemet.") : undefined}>
        <Row label="Täthet" help="Kompakt ger tätare tabellrader, en tätare meny och smalare sidmarginaler – fler spelare och matcher syns på en gång." preview={<span className="hm-us-density" data-density={display.density} aria-hidden="true"><i /><i /><i /><i /></span>}>
          <Radios<DensityPreference> name="density" label="Täthet" value={display.density} onChange={(v) => save("visning", updateDisplayPreferences({ density: v }), v === "COMPACT" ? "Täthet: kompakt." : "Täthet: bekväm.")}
            options={[{ value: "COMFORTABLE", label: "Bekväm" }, { value: "COMPACT", label: "Kompakt" }]} />
        </Row>
        <Row label="Textstorlek" help="Förstorar karriärens innehåll och den här sidan. Menyn och veckoraden behåller sin storlek. På mobil gäller telefonens egen textstorlek." preview={<span className="hm-us-textsize" style={{ fontSize: `${(13 * display.textSize) / 100}px` }}>Truppen · <span className="ce-num">24</span> spelare</span>}>
          <Radios<TextSizePreference> name="text-size" label="Textstorlek" value={display.textSize} onChange={(v) => save("visning", updateDisplayPreferences({ textSize: v }), `Textstorlek: ${v} %.`)}
            options={TEXT_SIZES.map((t) => ({ value: t, label: `${t} %` }))} />
        </Row>
        <Row label="Rörelse" help="Animationer i menyer, kalendern och matchögonblick. Systemet bestämmer om du inte väljer annat." preview={<span className="hm-us-motion" data-motion={display.motion} aria-hidden="true"><i /></span>}>
          <Radios<MotionPreference> name="motion" label="Rörelse" value={display.motion} onChange={(v) => save("visning", updateDisplayPreferences({ motion: v }), v === "REDUCED" ? "Rörelse är minskad." : "Rörelse följer systemet.")}
            options={[{ value: "SYSTEM", label: "Följ systemet" }, { value: "REDUCED", label: "Minska rörelse" }]} />
        </Row>
        <Row label="Tema" help="Spelet har ett tema: Arena Nights. Accentfärgen följer alltid klubben du leder (orange när du saknar klubb) – det går inte att stänga av."
          preview={<span className="hm-us-theme" aria-hidden="true"><i /><span>Accent</span></span>}>
          <dl className="hm-us-facts">
            <div><dt>Tema</dt><dd>Arena Nights <small>enda temat</small></dd></div>
            <div><dt>Klubbfärg som accent</dt><dd>Alltid på</dd></div>
          </dl>
        </Row>
        {status("visning")}
      </Section>

      <Section id="match" title="Match" open={open} onBack={() => setOpen(null)} onReset={preferences.defaultMatchSpeed !== DEFAULT_PREFERENCES.defaultMatchSpeed ? () => save("match", update({ defaultMatchSpeed: DEFAULT_PREFERENCES.defaultMatchSpeed }), "Matcher startar i standardhastigheten.") : undefined}>
        <Row label="Starthastighet" help="Vilken hastighet en livematch startar i. Du kan alltid ändra under matchen." preview={<span className="ce-num">{MATCH_SPEED_OPTIONS.find((o) => o.value === preferences.defaultMatchSpeed)?.note ?? ""}</span>}>
          <Radios<number> name="match-speed" label="Starthastighet" value={preferences.defaultMatchSpeed} onChange={(v) => { const o = MATCH_SPEED_OPTIONS.find((x) => x.value === v); save("match", update({ defaultMatchSpeed: v }), `Matcher startar i ${o?.label.toLowerCase() ?? `${v}×`}.`); }}
            options={MATCH_SPEED_OPTIONS.map((o) => ({ value: o.value, label: `${o.label} · ${o.value}×` }))} />
        </Row>
        {status("match")}
      </Section>

      <Section id="ekonomi" title="Ekonomi" open={open} onBack={() => setOpen(null)} onReset={preferences.displayCurrency !== DEFAULT_PREFERENCES.displayCurrency ? () => save("ekonomi", update({ displayCurrency: DEFAULT_PREFERENCES.displayCurrency }), "Belopp visas i euro.") : undefined}>
        <Row label="Valuta" help={<>Övergångar, kontrakt, löner och budgetar. Klubbens ekonomi räknas alltid i euro; kronor är en omräkning med spelets fasta kurs 1 € = {EUR_TO_SEK_REFERENCE_RATE} kr.</>}
          preview={<dl className="hm-us-money">{clubName && <dt className="hm-us-money-club">{clubName}</dt>}{preview.map((r) => <div key={r.label}><dt>{r.label}</dt><dd className="ce-num"><strong>{formatMoney(r.eur, { currency: preferences.displayCurrency })}{r.unit}</strong>{preferences.displayCurrency !== "EUR" && <small>lagras som {formatEur(r.eur)}{r.unit}</small>}</dd></div>)}</dl>}>
          <Radios<DisplayCurrency> name="display-currency" label="Valuta" value={preferences.displayCurrency} onChange={(c) => save("ekonomi", update({ displayCurrency: c }), `Belopp visas i ${c === "EUR" ? "euro" : "kronor"}.`)}
            options={DISPLAY_CURRENCIES.map((c) => ({ value: c, label: CURRENCY_NAME[c] }))} />
        </Row>
        {status("ekonomi")}
      </Section>

      <Section id="data" title="Data" open={open} onBack={() => setOpen(null)}>
        {data}
        <p className="hm-us-help">Nationer, ligor, klubb och försäsongens längd väljs per karriär när du startar ett nytt spel och kan inte ändras i efterhand.</p>
      </Section>
    </div>
  </div>;
}

function Section({ id, title, open, onBack, onReset, children }: { id: SectionId; title: string; open: SectionId | null; onBack: () => void; onReset?: () => void; children: ReactNode }) {
  return <section className="hm-us-section" id={id} aria-labelledby={`${id}-title`} data-active={open === id}>
    <header>
      <button type="button" className="hm-us-back" onClick={onBack}>‹ Alla inställningar</button>
      <h2 id={`${id}-title`}>{title}</h2>
      {onReset && <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={onReset}>Återställ</button>}
    </header>
    {children}
  </section>;
}

function Row({ label, help, preview, children }: { label: string; help: ReactNode; preview?: ReactNode; children: ReactNode }) {
  return <div className="hm-us-row">
    <div className="hm-us-label"><strong>{label}</strong><p>{help}</p></div>
    <div className="hm-us-control">{children}</div>
    {preview && <div className="hm-us-preview" aria-live="polite">{preview}</div>}
  </div>;
}

function Radios<T extends string | number>({ name, label, value, options, onChange }: { name: string; label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return <div className="hm-us-radios" role="radiogroup" aria-label={label}>{options.map((o) => <label key={String(o.value)} data-checked={o.value === value}>
    <input type="radio" name={name} checked={o.value === value} onChange={() => onChange(o.value)} />
    <span>{o.label}</span>
  </label>)}</div>;
}
