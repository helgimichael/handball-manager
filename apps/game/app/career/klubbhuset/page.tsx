"use client";
// HM-ALPHA3-M09 (9D) + HM-RICH-EXPERIENCE-02: Klubbhuset 2.0 -- Interactive
// visual headquarters with architectural spatial floorplan, live room stage,
// and photographic department gallery.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ClubCrest, { CrestPlaceholderNote } from "@/components/ClubCrest";
import { MomentHero } from "@/components/experience/Moment";
import { MeterBar } from "@/components/experience/primitives";
import { ENVIRONMENTS } from "@/components/clubhq/environments";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { getClub } from "@/lib/game-data";
import { ECONOMIC_BAND_LABEL } from "@/lib/economy/clubEconomyLabels";
import { clubHq, TIER_LABEL } from "@/lib/clubhq/clubhq";
import { SWEDEN } from "@/lib/nationalTeam/nationalTeam";

export default function KlubbhusetPage() {
  const router = useRouter();
  const { career } = useCareer();
  const hq = clubHq(career);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(hq.rooms[0]?.id ?? "manager");
  const activeRoom = hq.rooms.find((r) => r.id === selectedRoomId) ?? hq.rooms[0]!;
  const activeEnv = ENVIRONMENTS[activeRoom.environment];
  const arenaEnv = ENVIRONMENTS["arena-club"];

  const name = (id: string) => {
    const p = getCareerPlayer(career, id);
    return p ? `${p.firstName} ${p.lastName}` : id;
  };
  const clubColor = hq.colors.primary ?? "#c0612b";
  const pageStyle = { ["--kh-club" as string]: clubColor };

  return (
    <div className="kh-page" style={pageStyle}>
      <div className="kh-hero">
        <MomentHero
          tone="ink"
          backdrop={{ kind: "photo", style: arenaEnv.backdropStyle }}
          tags={[false, "Klubbhuset", hq.town, TIER_LABEL[hq.tier], `Läktaren: ${hq.supporters.label}`]}
          stamp={null}
          headline={hq.name}
          lede={
            [
              hq.venue,
              hq.capacity ? `${hq.capacity.toLocaleString("sv-SE")} platser` : null,
              hq.founded ? `Grundad ${hq.founded}` : null,
              "Interaktivt klubbhus & hemmahall",
            ]
              .filter(Boolean)
              .join(" · ") || "Föreningens hemvist"
          }
          aside={
            <div className="kh-crest">
              <ClubCrest
                shortName={getClub(hq.clubId)?.shortName ?? ""}
                primaryColor={clubColor}
                clubId={hq.clubId}
                size={84}
              />
              <CrestPlaceholderNote clubId={hq.clubId} />
            </div>
          }
        />
      </div>

      {/* Interactive Clubhouse Complex: Spatial Blueprint + Live Room Stage */}
      <section aria-labelledby="kh-complex-h">
        <div className="kh-section-head">
          <div>
            <h2 id="kh-complex-h" className="kh-h">
              Anläggningen & Avdelningarna
            </h2>
            <p className="kh-section-sub">
              Välj ett rum i anläggningsritningen för att granska aktuell status eller kliv rakt in i avdelningen.
            </p>
          </div>
          <div className="kh-blueprint-legend">
            <span>
              <i style={{ background: "#38b277" }} /> I fas
            </span>
            <span>
              <i style={{ background: "#f59e0b" }} /> Kräver uppmärksamhet
            </span>
            <span>
              <i style={{ background: "#ef4444" }} /> Kritiskt
            </span>
          </div>
        </div>

        <div className="kh-complex">
          {/* Left: Interactive Architectural Blueprint */}
          <div className="kh-blueprint" role="region" aria-label="Interaktiv översiktskarta över klubbhuset">
            <div className="kh-blueprint-head">
              <div>
                <span>ARKITEKTUR & SEKTORER · {hq.venue ?? hq.name}</span>
                <br />
                <strong>Klubbhusets planritning</strong>
              </div>
              <span>{hq.rooms.length} avdelningar</span>
            </div>

            <div className="kh-floorplan-canvas">
              {/* Central Handball Arena Court SVG */}
              <svg
                className="kh-floorplan-court"
                viewBox="0 0 400 260"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <rect x="6" y="6" width="388" height="248" rx="8" fill="none" stroke="#476891" strokeWidth="1.5" />
                {/* Center indoor handball court */}
                <rect x="136" y="42" width="128" height="176" rx="3" fill="#0d3562" fillOpacity="0.45" stroke="#6aa6e8" strokeWidth="1.2" />
                <line x1="136" y1="130" x2="264" y2="130" stroke="#6aa6e8" strokeWidth="1" />
                <circle cx="200" cy="130" r="14" fill="none" stroke="#6aa6e8" strokeWidth="1" />
                <path d="M 164 42 A 36 30 0 0 0 236 42" fill="none" stroke="#6aa6e8" strokeWidth="1" />
                <path d="M 152 42 A 48 42 0 0 0 248 42" fill="none" stroke="#6aa6e8" strokeWidth="0.9" strokeDasharray="3 3" />
                <path d="M 164 218 A 36 30 0 0 1 236 218" fill="none" stroke="#6aa6e8" strokeWidth="1" />
                <path d="M 152 218 A 48 42 0 0 1 248 218" fill="none" stroke="#6aa6e8" strokeWidth="0.9" strokeDasharray="3 3" />
              </svg>

              {hq.rooms.map((r) => {
                const isSelected = r.id === activeRoom.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className="kh-hotspot"
                    data-active={isSelected ? "true" : "false"}
                    data-room-id={r.id}
                    style={{
                      left: `${r.zone.x}%`,
                      top: `${r.zone.y}%`,
                      width: `${r.zone.w}%`,
                      height: `${r.zone.h}%`,
                    }}
                    onClick={() => setSelectedRoomId(r.id)}
                    onDoubleClick={() => router.push(r.href)}
                    aria-pressed={isSelected}
                    title={`${r.name} — Klicka för att granska, dubbelklicka för att öppna`}
                  >
                    <div className="kh-hotspot-top">
                      <span className="kh-hotspot-wing">{r.zone.wing}</span>
                      <i className="kh-hotspot-dot" data-tone={r.alertTone} aria-hidden="true" />
                    </div>
                    <strong className="kh-hotspot-name">{r.name}</strong>
                    {r.status && <span className="kh-hotspot-status">{r.status}</span>}
                  </button>
                );
              })}
            </div>

            <div className="kh-blueprint-foot">
              <span>Klicka på en rumszon för att växla vy · Dubbelklicka för direkt inträde</span>
              <Link href={activeRoom.href} className="kh-room-enter">
                Öppna {activeRoom.name} →
              </Link>
            </div>
          </div>

          {/* Right: Active Room Stage with Real Photographic Environment */}
          <article
            className="kh-stage xp-photo-hero"
            style={activeEnv.backdropStyle}
            aria-live="polite"
            data-active-room={activeRoom.id}
          >
            <div className="kh-stage-top">
              <span className="kh-stage-wing">
                <i className="hm-env-banner-dot" aria-hidden="true" />
                {activeRoom.zone.wing} · {activeEnv.department}
              </span>
              {activeRoom.status && <span className="kh-stage-badge">{activeRoom.status}</span>}
            </div>

            <div className="kh-stage-body">
              <p className="kh-stage-purpose">{activeRoom.purpose}</p>
              <h3>{activeRoom.name}</h3>
              <p className="kh-stage-summary">{activeRoom.summary}</p>
            </div>

            <dl className="kh-stage-metrics">
              {activeRoom.metrics.map((m) => (
                <div key={m.label} className="kh-stage-metric" data-tone={m.tone ?? "neutral"}>
                  <dt>{m.label}</dt>
                  <dd>{m.value}</dd>
                </div>
              ))}
            </dl>

            <div className="kh-stage-actions">
              <Link className="kh-stage-cta" href={activeRoom.href}>
                Kliv in i {activeRoom.name} →
              </Link>
              {activeRoom.secondaryHref && activeRoom.secondaryLabel && (
                <Link className="kh-stage-secondary" href={activeRoom.secondaryHref}>
                  {activeRoom.secondaryLabel}
                </Link>
              )}
            </div>
          </article>
        </div>
      </section>

      {/* Visual Room Cards Gallery (1-Click Entry + Environment Photography) */}
      <section aria-labelledby="kh-rooms-h">
        <div className="kh-section-head">
          <h2 id="kh-rooms-h" className="kh-h">
            Rummen — Direktinträde
          </h2>
          <p className="kh-section-sub">
            Varje rum är kopplat till klubbens skarpa verktyg för laguttagning, taktik, träning, scouting och styrelsearbete.
          </p>
        </div>
        <ul className="kh-rooms">
          {hq.rooms.map((r) => {
            const env = ENVIRONMENTS[r.environment];
            const isSelected = r.id === activeRoom.id;
            return (
              <li key={r.id}>
                <article
                  className="kh-room-card"
                  data-selected={isSelected ? "true" : "false"}
                  onMouseEnter={() => setSelectedRoomId(r.id)}
                >
                  <div
                    className="kh-room-visual"
                    style={{ backgroundImage: `url(${env.narrowSrc})` }}
                  >
                    <div className="kh-room-visual-top">
                      <span className="kh-room-wing">{r.zone.wing}</span>
                      {r.status && (
                        <span className="kh-room-badge" data-tone={r.alertTone}>
                          {r.status}
                        </span>
                      )}
                    </div>
                    <strong className="kh-room-title">{r.name}</strong>
                  </div>

                  <div className="kh-room-body">
                    <p className="kh-room-purpose">{r.purpose}</p>
                    <dl className="kh-room-metrics">
                      {r.metrics.map((m) => (
                        <div key={m.label}>
                          <dt>{m.label}</dt>
                          <dd>{m.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="kh-room-foot">
                      <Link className="kh-room-enter" href={r.href}>
                        Öppna {r.name} →
                      </Link>
                      <button
                        type="button"
                        className="kh-room-inspect"
                        onClick={() => setSelectedRoomId(r.id)}
                      >
                        Granska
                      </button>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="kh-grid">
        <section className="bd-panel" aria-labelledby="kh-id-h">
          <header>
            <span className="xp-eyebrow">Identitet</span>
            <h3 id="kh-id-h">Klubben</h3>
          </header>
          <dl className="kh-facts">
            <div>
              <dt>Hemort</dt>
              <dd>{hq.town}</dd>
            </div>
            {hq.venue && (
              <div>
                <dt>Arena</dt>
                <dd>{hq.venue}</dd>
              </div>
            )}
            <div>
              <dt>Ekonomisk nivå</dt>
              <dd>{hq.band ? ECONOMIC_BAND_LABEL[hq.band] : "–"}</dd>
            </div>
            <div>
              <dt>Klubbfärger</dt>
              <dd className="kh-colors">
                {[hq.colors.primary, hq.colors.secondary].filter(Boolean).map((c) => (
                  <i key={c} style={{ background: c }} aria-label={c} />
                ))}
              </dd>
            </div>
          </dl>
          <p className="pd-note">
            Anläggningen växer med klubbens ekonomiska nivå: föreningshall (E5–E7), professionell anläggning (E3–E4), arena i toppklass (E1–E2).
          </p>
        </section>

        <section className="bd-panel" aria-labelledby="kh-fans-h">
          <header>
            <span className="xp-eyebrow">Läktaren</span>
            <h3 id="kh-fans-h">Supportrarna: {hq.supporters.label}</h3>
          </header>
          <MeterBar
            value={(hq.supporters.score + 50) / 100}
            label="Stämningen bland supportrarna"
            figure={hq.supporters.score > 0 ? `+${hq.supporters.score}` : String(hq.supporters.score)}
            tone={hq.supporters.score >= 8 ? "success" : hq.supporters.score <= -8 ? "loss" : undefined}
          />
          <p className="pd-note">
            Stämningen följer resultaten mot förväntningarna, derbyn och säsongens utfall, och klingar av med tiden. Ord i media lyfter mindre ju högre den redan är.
          </p>
          {hq.rivals.length > 0 && (
            <>
              <h4 className="kh-sub">Rivaler</h4>
              <ul className="kh-list">
                {hq.rivals.map((r) => (
                  <li key={r.clubId}>
                    <Link href={`/career/clubs/${r.clubId}`}>{getClub(r.clubId)?.name}</Link>{" "}
                    <small>{r.reasons.join(" · ")}</small>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h4 className="kh-sub">Meriter i din tid</h4>
          {hq.honours.length ? (
            <ul className="kh-list">
              {hq.honours.map((h) => (
                <li key={h.seasonId + h.text}>
                  {h.seasonId}: {h.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="pd-note">Inga titlar ännu. Prisskåpet väntar.</p>
          )}
        </section>

        <section className="bd-panel" aria-labelledby="kh-nt-h">
          <header>
            <span className="xp-eyebrow">Landslaget</span>
            <h3 id="kh-nt-h">Landslagsuppehåll</h3>
          </header>
          {hq.national.upcoming.length === 0 && (
            <p className="pd-note">
              Inga fler publicerade landslagsfönster. Senare fönster läggs in när förbunden har fastställt dem.
            </p>
          )}
          <ul className="kh-windows">
            {hq.national.upcoming.map(({ window: w, state: st, own }) => (
              <li key={w.id}>
                <b>{w.title}</b>
                <span>{w.competition}</span>
                <small>
                  Handbollsligan gör uppehåll {w.start}–{w.end}
                  {w.group ? ` · ${w.group.name} i ${w.group.venue}: ${SWEDEN}, ${w.group.opponents.join(", ")}` : ""}
                </small>
                {w.matches && (
                  <small>
                    {w.matches
                      .filter((m) => m.home === SWEDEN || m.away === SWEDEN)
                      .map((m) => `${m.dateLabel}: ${m.home}–${m.away}${m.venue ? ` (${m.venue})` : ""}`)
                      .join(" · ")}
                  </small>
                )}
                {st?.status === "CALLED" ? (
                  <p>Uttagna från din klubb: {own.length ? own.map(name).join(", ") : "ingen"}.</p>
                ) : st?.status === "NOT_QUALIFIED" ? (
                  <p>{st.summary}</p>
                ) : (
                  <p className="pd-note">Truppen tas ut när samlingen börjar.</p>
                )}
              </li>
            ))}
          </ul>
          {hq.national.last?.state.summary && (
            <p className="kh-last">
              <b>Senast, {hq.national.last.window.title}:</b> {hq.national.last.state.summary}
              {hq.national.last.own.length ? ` Från din klubb: ${hq.national.last.own.map(name).join(", ")}.` : ""}
            </p>
          )}
          <p className="pd-note">
            Kalendern är verklig (EHF och IHF). Sverige tar ut svenska spelare i spelets klubbar; spelare från andra länder kallas av sina landslag.
          </p>
        </section>
      </div>
    </div>
  );
}
