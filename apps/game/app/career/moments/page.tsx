"use client";
// HM-ALPHA3-M01: the Moment library -- a development reference page (not
// in the navigation) showing the shared experience components with the
// manager's own club. Every example is illustrative; nothing here reads or
// changes career events. Future milestones (M2 board budget meeting, M3
// promotion/title, M4 staff appointment, M7 dismissal) build on these.
import Link from "next/link";
import ClubCrest from "@/components/ClubCrest";
import { PlayerGlyph } from "@/components/game/Identity";
import { DecisionCard, EventCard, Moment, MomentHero } from "@/components/experience/Moment";
import { MeterBar, ProgressSteps, RouteLine, Stat, ValueFlow } from "@/components/experience/primitives";
import { DEAL_SIGNED_BACKDROP, NEGOTIATION_ROOM_BACKDROP } from "@/components/transfers/transferVisuals";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub, getCareerSquad } from "@/lib/career/careerWorld";
import { formatMoney } from "@/lib/economy/currency";
import { getClub } from "@/lib/game-data";
import { useMoney } from "@/lib/settings/usePreferences";

export default function MomentLibraryPage() {
  useMoney();
  const { career } = useCareer();
  const club = getCareerClub(career);
  const player = getCareerSquad(career)[0];
  const rival = getClub(career.fixtures.find((f) => f.homeClubId === club.id)?.awayClubId ?? "") ?? club;
  const crest = (id: string, size = 34) => {
    const c = getClub(id);
    return c ? <ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} clubId={c.id} size={size} /> : null;
  };

  return (
    <div className="hm-settings" style={{ gap: 26 }}>
      <header className="hm-page-heading">
        <div>
          <div className="hm-eyebrow">Utvecklarvy · exempel med {club.shortName}</div>
          <h1>Momentbiblioteket</h1>
          <p>De gemensamma byggstenarna för stora karriärhändelser. Exemplen visar presentation, inte riktiga händelser.</p>
        </div>
        <div className="hm-actions"><Link className="hm-btn" href="/career/settings">Inställningar</Link></div>
      </header>

      <Moment
        label="Exempel: värvning"
        hero={
          <MomentHero kind="SIGNING" backdrop={{ kind: "photo", style: DEAL_SIGNED_BACKDROP }} tags={[career.gameDate]} headline={player ? `${player.lastName} har skrivit på` : "Klar för klubben"} lede="Fotohero, stämpel och rutt: samma språk som Transfer Management, nu delat.">
            <RouteLine items={[crest(rival.id), player ? <PlayerGlyph key="p" player={player} size={46} /> : null, crest(club.id)]} caption={`${rival.shortName} → ${club.shortName}`} />
          </MomentHero>
        }
        next={<><button type="button" className="hm-btn hm-btn-primary tc-cta">Öppna profilen →</button><button type="button" className="hm-btn">Se truppen</button></>}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <span className="xp-eyebrow">Kontraktet</span>
          <ProgressSteps surface="paper" label="Exempelsteg" steps={[{ label: "Klubben", state: "done", detail: formatMoney(120_000) }, { label: "Spelaren", state: "done", detail: "Överens" }, { label: "Signering", state: "current" }]} />
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <span className="xp-eyebrow">Pengarna</span>
          <ValueFlow
            label="Exempel på fördelning"
            parts={[
              { label: "Övergångssumma", detail: `till ${rival.shortName}`, value: 120_000, display: formatMoney(120_000), color: "#142538" },
              { label: "Utbildningsersättning", detail: "till fostrarklubbar", value: 18_000, display: formatMoney(18_000), color: "#557557" },
              { label: "Agentarvode", detail: "till agenten", value: 6_500, display: formatMoney(6_500), color: "#c08a2c" },
            ]}
            total={formatMoney(144_500)}
          />
        </div>
      </Moment>

      <MomentHero
        kind="STAFF_APPOINTMENT"
        size="compact"
        headingLevel={2}
        backdrop={{ kind: "photo", style: NEGOTIATION_ROOM_BACKDROP }}
        headline="Ny assisterande tränare"
        lede="Kompakt hero för en anställning (M4). Samma komponent, annan ton och storlek."
        aside={<div style={{ display: "grid", gap: 14 }}><Stat label="Lön" value={formatMoney(3_200)} note="per månad" /><Stat label="Avtal" value="2 år" /></div>}
      />

      <div className="hm-settings-layout" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))" }}>
        <MomentHero kind="PROMOTION" headingLevel={2} size="compact" headline={`${club.shortName} är uppflyttade`} lede="Guldton med linjegrafik från planen (M3)." tags={["Säsongen " + career.seasonId]}>
          <RouteLine items={[crest(club.id, 44)]} />
        </MomentHero>
        <MomentHero kind="DISMISSAL" headingLevel={2} size="compact" backdrop={{ kind: "plain" }} headline="Styrelsen har fattat ett beslut" lede="Förlustton för tunga besked (M7)." />
      </div>

      <div className="hm-settings-layout" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}>
        <EventCard kind="CHAMPIONSHIP" title="SM-guld" media={crest(club.id, 56)}>Händelsekort för flöden, hemskärmen och inkorgen.</EventCard>
        <EventCard kind="ANNOUNCEMENT" title="Klubben meddelar" footer={<button type="button" className="hm-btn hm-btn-sm">Läs mer →</button>}>Utan bild blir kortet en ren textnotis.</EventCard>
        <EventCard kind="SEASON_ACHIEVEMENT" title="Säsongens skyttekung" media={player ? <PlayerGlyph player={player} size={56} /> : undefined}>Prestationer under säsongen.</EventCard>
      </div>

      <div className="hm-settings-layout" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))" }}>
        <DecisionCard title="Bekräfta budgeten" primary={{ label: "Godkänn budgeten", consequence: `Lönebudget ${formatMoney(1_250_000, { compact: true })} · transferbudget ${formatMoney(180_000)}`, onSelect: () => undefined }} secondary={<button type="button" className="hm-btn">Föreslå ändringar</button>}>
          Ett viktigt beslut: en tydlig huvudhandling med följden på andra raden.
        </DecisionCard>
        <section className="hm-settings-note" style={{ display: "grid", gap: 14 }}>
          <span className="xp-eyebrow">Status och framsteg</span>
          <MeterBar label="Styrelsens förtroende" value={0.68} figure="68 %" tone="success" />
          <MeterBar label="Transferbudget använd" value={0.82} figure={formatMoney(147_600)} tone="gold" />
          <MeterBar label="Säsongen" value={0.35} figure="Omgång 9 av 26" tone="ink" />
        </section>
      </div>
    </div>
  );
}
