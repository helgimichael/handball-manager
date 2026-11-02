"use client";
// HM-ALPHA3-M09 (9D): Klubbhuset -- the club's home. The building grows
// with the club's economic band; the rooms lead to the screens that run
// each part of the club; identity, the stands, rivals, honours and the
// national team's calendar sit alongside.
import Link from "next/link";
import ClubCrest, { CrestPlaceholderNote } from "@/components/ClubCrest";
import { MomentHero } from "@/components/experience/Moment";
import { MeterBar } from "@/components/experience/primitives";
import { HQ_BACKDROP } from "@/components/clubhq/ClubHq";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { getClub } from "@/lib/game-data";
import { ECONOMIC_BAND_LABEL } from "@/lib/economy/clubEconomyLabels";
import { clubHq, TIER_LABEL } from "@/lib/clubhq/clubhq";
import { SWEDEN } from "@/lib/nationalTeam/nationalTeam";

export default function KlubbhusetPage() {
  const { career } = useCareer();
  const hq = clubHq(career);
  const name = (id: string) => { const p = getCareerPlayer(career, id); return p ? `${p.firstName} ${p.lastName}` : id; };
  const style = { ...HQ_BACKDROP[hq.tier], ["--kh-club" as string]: hq.colors.primary ?? "#c0612b" };
  return (
    <div className="kh-page">
      <div className="kh-hero" style={style}>
        <MomentHero tone="ink" backdrop={{ kind: "photo", style: HQ_BACKDROP[hq.tier] }} tags={[false, "Klubbhuset", hq.town, TIER_LABEL[hq.tier]]} stamp={null} headline={hq.name}
          lede={[hq.venue, hq.capacity ? `${hq.capacity.toLocaleString("sv-SE")} platser` : null, hq.founded ? `Grundad ${hq.founded}` : null].filter(Boolean).join(" · ") || "Föreningens hemvist"}
          aside={<div className="kh-crest"><ClubCrest shortName={getClub(hq.clubId)?.shortName ?? ""} primaryColor={hq.colors.primary ?? "#c0612b"} clubId={hq.clubId} size={88} /><CrestPlaceholderNote clubId={hq.clubId} /></div>} />
      </div>

      <section aria-labelledby="kh-rooms-h">
        <h2 id="kh-rooms-h" className="kh-h">Rummen</h2>
        <ul className="kh-rooms">
          {hq.rooms.map((r) => (
            <li key={r.id}><Link className="kh-room" href={r.href}><b>{r.name}</b><span>{r.purpose}</span>{r.status && <small>{r.status}</small>}</Link></li>
          ))}
        </ul>
      </section>

      <div className="kh-grid">
        <section className="bd-panel" aria-labelledby="kh-id-h">
          <header><span className="xp-eyebrow">Identitet</span><h3 id="kh-id-h">Klubben</h3></header>
          <dl className="kh-facts">
            <div><dt>Hemort</dt><dd>{hq.town}</dd></div>
            {hq.venue && <div><dt>Arena</dt><dd>{hq.venue}</dd></div>}
            <div><dt>Ekonomisk nivå</dt><dd>{hq.band ? ECONOMIC_BAND_LABEL[hq.band] : "–"}</dd></div>
            <div><dt>Klubbfärger</dt><dd className="kh-colors">{[hq.colors.primary, hq.colors.secondary].filter(Boolean).map((c) => <i key={c} style={{ background: c }} aria-label={c} />)}</dd></div>
          </dl>
          <p className="pd-note">Anläggningen växer med klubbens ekonomiska nivå: föreningshall (E5–E7), professionell anläggning (E3–E4), arena i toppklass (E1–E2).</p>
        </section>

        <section className="bd-panel" aria-labelledby="kh-fans-h">
          <header><span className="xp-eyebrow">Läktaren</span><h3 id="kh-fans-h">Supportrarna: {hq.supporters.label}</h3></header>
          <MeterBar value={(hq.supporters.score + 50) / 100} label="Stämningen bland supportrarna" figure={hq.supporters.score > 0 ? `+${hq.supporters.score}` : String(hq.supporters.score)} tone={hq.supporters.score >= 8 ? "success" : hq.supporters.score <= -8 ? "loss" : undefined} />
          <p className="pd-note">Stämningen följer resultaten mot förväntningarna, derbyn och säsongens utfall, och klingar av med tiden. Ord i media lyfter mindre ju högre den redan är.</p>
          {hq.rivals.length > 0 && <><h4 className="kh-sub">Rivaler</h4><ul className="kh-list">{hq.rivals.map((r) => <li key={r.clubId}><Link href={`/career/clubs/${r.clubId}`}>{getClub(r.clubId)?.name}</Link> <small>{r.reasons.join(" · ")}</small></li>)}</ul></>}
          <h4 className="kh-sub">Meriter i din tid</h4>
          {hq.honours.length ? <ul className="kh-list">{hq.honours.map((h) => <li key={h.seasonId + h.text}>{h.seasonId}: {h.text}</li>)}</ul> : <p className="pd-note">Inga titlar ännu. Prisskåpet väntar.</p>}
        </section>

        <section className="bd-panel" aria-labelledby="kh-nt-h">
          <header><span className="xp-eyebrow">Landslaget</span><h3 id="kh-nt-h">Landslagsuppehåll</h3></header>
          {hq.national.upcoming.length === 0 && <p className="pd-note">Inga fler publicerade landslagsfönster. Senare fönster läggs in när förbunden har fastställt dem.</p>}
          <ul className="kh-windows">
            {hq.national.upcoming.map(({ window: w, state: st, own }) => (
              <li key={w.id}>
                <b>{w.title}</b><span>{w.competition}</span>
                <small>Handbollsligan gör uppehåll {w.start}–{w.end}{w.group ? ` · ${w.group.name} i ${w.group.venue}: ${SWEDEN}, ${w.group.opponents.join(", ")}` : ""}</small>
                {w.matches && <small>{w.matches.filter((m) => m.home === SWEDEN || m.away === SWEDEN).map((m) => `${m.dateLabel}: ${m.home}–${m.away}${m.venue ? ` (${m.venue})` : ""}`).join(" · ")}</small>}
                {st?.status === "CALLED" ? <p>Uttagna från din klubb: {own.length ? own.map(name).join(", ") : "ingen"}.</p> : st?.status === "NOT_QUALIFIED" ? <p>{st.summary}</p> : <p className="pd-note">Truppen tas ut när samlingen börjar.</p>}
              </li>
            ))}
          </ul>
          {hq.national.last?.state.summary && <p className="kh-last"><b>Senast, {hq.national.last.window.title}:</b> {hq.national.last.state.summary}{hq.national.last.own.length ? ` Från din klubb: ${hq.national.last.own.map(name).join(", ")}.` : ""}</p>}
          <p className="pd-note">Kalendern är verklig (EHF och IHF). Sverige tar ut svenska spelare i spelets klubbar; spelare från andra länder kallas av sina landslag (vilka nationer som spelar mästerskapen är delvis spelets antagande). Resultaten är spelets egen simulering. Uttagna spelare missar klubbens matcher under fönstret och kommer tillbaka tröttare, dina egna med en viss skaderisk. Allsvenskan spelar vidare under fönstren.</p>
        </section>
      </div>
    </div>
  );
}
