"use client";
// HM-ALPHA3-M01: Inställningar -- device-level preferences. The first one is
// the display currency. Everything here describes how THIS device shows the
// game; nothing is written into the career (lib/settings/preferences.ts).
import { useMemo, useState } from "react";
import { ChoiceGroup } from "@/components/experience/ChoiceGroup";
import { CourtBackdrop } from "@/components/experience/CourtBackdrop";
import { Stat } from "@/components/experience/primitives";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub } from "@/lib/career/careerWorld";
import { getClubEconomySnapshot } from "@/lib/economy/clubEconomyIntegration";
import { EUR_TO_SEK_REFERENCE_RATE, formatEur, formatMoney } from "@/lib/economy/currency";
import type { DisplayCurrency } from "@/lib/settings/preferences";
import { usePreferences } from "@/lib/settings/usePreferences";

const CURRENCY_NAME: Record<DisplayCurrency, string> = { EUR: "Euro", SEK: "Svenska kronor" };

export default function SettingsPage() {
  const { career } = useCareer();
  const [preferences, updatePreferences] = usePreferences();
  const [status, setStatus] = useState<{ tone: "saved" | "session"; text: string } | null>(null);
  const currency = preferences.displayCurrency;
  const club = getCareerClub(career);

  // Real figures from the manager's own club, so the choice is made on numbers they know.
  const examples = useMemo(() => {
    const economy = getClubEconomySnapshot(career, club.id);
    const wages = Object.values(career.playerContracts).filter((c) => c.clubId === club.id).map((c) => c.wageEurPerMonth);
    return [
      { label: "Transferbudget", eur: economy?.budgets.transferBudgetEur, unit: "" },
      { label: "Lönebudget", eur: economy?.budgets.wageBudgetEur, unit: "/år" },
      { label: "Högsta lön i truppen", eur: wages.length ? Math.max(...wages) : undefined, unit: "/mån" },
      { label: "Kassa", eur: economy?.cashEur, unit: "" },
    ].filter((row): row is { label: string; eur: number; unit: string } => typeof row.eur === "number");
  }, [career, club.id]);
  const sampleEur = examples.find((e) => e.label === "Högsta lön i truppen")?.eur ?? 4_400;

  function choose(next: DisplayCurrency) {
    if (next === currency) return;
    const persisted = updatePreferences({ displayCurrency: next });
    setStatus(persisted
      ? { tone: "saved", text: `Visar nu belopp i ${CURRENCY_NAME[next].toLowerCase()}. Valet är sparat på den här enheten.` }
      : { tone: "session", text: `Visar nu belopp i ${CURRENCY_NAME[next].toLowerCase()}. Webbläsaren tillåter inte att valet sparas, så det gäller tills du laddar om sidan.` });
  }

  return (
    <div className="hm-settings">
      <header className="xp-band hm-settings-band" data-tone="ink">
        <CourtBackdrop />
        <div>
          <span className="xp-eyebrow">Spelet · den här enheten</span>
          <h1>Inställningar</h1>
          <p>Hur spelet visas för dig. Inställningarna sparas i den här webbläsaren och följer inte med karriären. De ändrar aldrig dina sparade karriärer eller klubbens ekonomi.</p>
        </div>
        <div className="hm-settings-band-stats">
          <Stat label="Visningsvaluta" value={currency} note={CURRENCY_NAME[currency]} />
          <Stat label="Spelkurs" value={`1 € = ${EUR_TO_SEK_REFERENCE_RATE} kr`} note="Fast, ändras aldrig" />
        </div>
      </header>

      <div className="hm-settings-layout">
        <SettingsSection
          id="currency"
          eyebrow="Visning"
          title="Valuta"
          description={<>Välj vilken valuta beloppen visas i: övergångar, lån, kontrakt, löner, budgetar och klubbens ekonomi. Klubbens ekonomi räknas alltid i euro. Kronor är en omräkning med spelets fasta kurs <b>1 € = {EUR_TO_SEK_REFERENCE_RATE} kr</b>.</>}
        >
          <ChoiceGroup<DisplayCurrency>
            legend={<span className="xp-eyebrow">Visa belopp i</span>}
            name="display-currency"
            value={currency}
            onChange={choose}
            options={[
              { value: "EUR", label: "Euro · €", description: "Spelets egen valuta. Beloppen visas precis som de är lagrade.", sample: formatMoney(sampleEur, { currency: "EUR" }) },
              { value: "SEK", label: "Kronor · kr", description: `Omräknat med den fasta spelkursen 1 € = ${EUR_TO_SEK_REFERENCE_RATE} kr och avrundat till hela kronor.`, sample: formatMoney(sampleEur, { currency: "SEK" }) },
            ]}
          />
          <p className="hm-settings-status" role="status" data-tone={status?.tone}>{status?.text ?? ""}</p>
        </SettingsSection>

        <aside className="hm-settings-rail" aria-label="Förhandsvisning">
          <section className="hm-settings-preview" aria-labelledby="preview-title">
            <span className="xp-eyebrow">Så ser det ut</span>
            <h2 id="preview-title">{club.name}</h2>
            <dl>
              {examples.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>
                    <strong>{formatMoney(row.eur, { currency })}{row.unit}</strong>
                    {currency !== "EUR" && <small>lagras som {formatEur(row.eur)}{row.unit}</small>}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="hm-settings-note" aria-label="Bra att veta">
            <span className="xp-eyebrow">Bra att veta</span>
            <ul>
              <li>Bytet gäller direkt på alla skärmar. Du behöver inte ladda om.</li>
              <li>Sparade karriärer, budgetar och avtal är oförändrade i euro.</li>
              <li>Kursen är fast och hämtas aldrig från nätet.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
