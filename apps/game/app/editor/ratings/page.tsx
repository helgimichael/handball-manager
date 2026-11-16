"use client";

// HM-EDITOR-0.2: Rating Review roster list. Every value shown here is either a
// HM-RATINGS-0.3 pipeline proposal (recomputed fresh every load, never persisted)
// or a reviewer's own recorded status -- never invented, never a filled-in average.
//
// Arena Nights SYS-02c (A) "Review queue": club list (3) + roster (9) in the dev
// shell, status filter Ej granskad / Granskad / Låst with the unreviewed count first.
// Per-club progress comes from rosters actually loaded in this session (the API
// is per club); clubs not opened yet say so instead of showing a guessed number.
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DevPageHead } from "@/components/dev/DevShell";
import { filterQueue, queueProgress, REVIEW_BUCKET_LABEL, REVIEW_BUCKETS, reviewBucket, type QueueProgress, type ReviewBucket } from "@/lib/editor/ratingQueue";
import "./ratings.css";

interface CatalogClub {
  clubId: string;
  clubName: string;
  competitionId: string;
  nation: string;
  season: string;
  competitionSlug: string;
  playerCount: number;
}

interface RatingRow {
  profile: {
    playerId: string;
    position: string;
    ca: { value: number | null; confidence: string };
    pa: { value: number | null; confidence: string };
  };
  matchedCalibration: boolean;
  status: string;
  locked: unknown;
}

const BUCKET_CLASS: Record<ReviewBucket, string> = { UNREVIEWED: "hm-dev-warn", REVIEWED: "hm-dev-pos", LOCKED: "hm-dev-muted" };

export default function RatingReviewRosterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clubs, setClubs] = useState<CatalogClub[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string>(() => searchParams.get("clubId") ?? "");
  const [rows, setRows] = useState<RatingRow[]>([]);
  const [namesById, setNamesById] = useState<Record<string, string>>({});
  const [progressByClub, setProgressByClub] = useState<Record<string, QueueProgress>>({});
  const [search, setSearch] = useState("");
  const [clubSearch, setClubSearch] = useState("");
  const [bucket, setBucket] = useState<ReviewBucket | null>("UNREVIEWED");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/editor/catalog")
      .then((res) => res.json())
      .then((data) => {
        setClubs(data.clubs ?? []);
        if (data.clubs?.length) setSelectedClubId((current) => current || data.clubs[0].clubId);
      })
      .catch(() => setError("Kunde inte läsa klubblistan."));
  }, []);

  useEffect(() => {
    if (!selectedClubId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot client-only load, matches players/page.tsx's own rationale.
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/editor/ratings/clubs/${encodeURIComponent(selectedClubId)}`).then((res) => res.json()),
      fetch(`/api/editor/clubs/${encodeURIComponent(selectedClubId)}/players`).then((res) => res.json()),
    ])
      .then(([ratingData, playerData]) => {
        if (ratingData.error) {
          setError(ratingData.error);
          setRows([]);
          return;
        }
        const loaded: RatingRow[] = ratingData.players ?? [];
        setRows(loaded);
        setProgressByClub((current) => ({ ...current, [selectedClubId]: queueProgress(loaded) }));
        const names: Record<string, string> = {};
        for (const p of playerData.players ?? []) names[p.playerId] = p.fullName;
        setNamesById(names);
      })
      .catch(() => setError("Kunde inte läsa truppen."))
      .finally(() => setLoading(false));
  }, [selectedClubId]);

  const progress = useMemo(() => queueProgress(rows), [rows]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return filterQueue(rows, bucket, (r) => !term || (namesById[r.profile.playerId] ?? r.profile.playerId).toLowerCase().includes(term));
  }, [rows, bucket, search, namesById]);

  const visibleClubs = useMemo(() => {
    const term = clubSearch.trim().toLowerCase();
    return term ? clubs.filter((c) => c.clubName.toLowerCase().includes(term)) : clubs;
  }, [clubs, clubSearch]);

  const selectedClub = clubs.find((c) => c.clubId === selectedClubId);
  const countFor = (b: ReviewBucket) => (b === "UNREVIEWED" ? progress.unreviewed : b === "REVIEWED" ? progress.reviewed : progress.locked);
  const donePct = Math.round(progress.done * 100);

  return (
    <>
      <DevPageHead
        eyebrow="Data · Betyg"
        title="Betygsgranskning"
        note="Föreslagna CA/PA kommer från HM-RATINGS-0.3-pipelinen och beräknas alltid på nytt -- de sparas aldrig här. Endast granskningsstatus, anteckning, överstyrningar och lås sparas."
      />
      <div className="hm-dev-split hm-dev-split--3-9">
        <aside className="hm-dev-panel hm-dev-sticky">
          <div className="hm-dev-panel-head">
            <span className="hm-dev-panel-title">Klubbar</span>
            <span className="hm-dev-num hm-dev-muted">{clubs.length}</span>
          </div>
          <div className="hm-dev-panel-body" style={{ paddingBottom: 6 }}>
            <input type="search" value={clubSearch} onChange={(e) => setClubSearch(e.target.value)} placeholder="Filtrera klubbar…" aria-label="Filtrera klubbar" style={{ width: "100%" }} />
          </div>
          <ul className="rv-clubs">
            {visibleClubs.map((c) => {
              const p = progressByClub[c.clubId];
              return (
                <li key={c.clubId}>
                  <button type="button" className="rv-club" aria-current={c.clubId === selectedClubId ? "true" : undefined} onClick={() => setSelectedClubId(c.clubId)}>
                    <span className="rv-club-name">{c.clubName}</span>
                    {p ? (
                      <span className="rv-club-progress" title={`${p.unreviewed} ej granskade av ${p.total}`}>
                        <span className="hm-dev-num hm-dev-warn">{p.unreviewed}</span>
                        <span className="rv-bar" aria-hidden="true"><span style={{ width: `${Math.round(p.done * 100)}%` }} /></span>
                      </span>
                    ) : (
                      <span className="hm-dev-num hm-dev-muted" title="Öppna klubben för att läsa in granskningsstatus">{c.playerCount} sp.</span>
                    )}
                  </button>
                </li>
              );
            })}
            {visibleClubs.length === 0 ? <li className="hm-dev-empty">Inga klubbar matchar.</li> : null}
          </ul>
          <p className="rv-clubs-note hm-dev-muted">Framsteg (ej granskade + stapel) visas för klubbar du öppnat i den här sessionen; övriga visar antal spelare.</p>
        </aside>

        <section className="hm-dev-panel">
          <div className="hm-dev-panel-head">
            <span className="hm-dev-panel-title">{selectedClub ? selectedClub.clubName : "Välj klubb"}</span>
            {rows.length > 0 ? (
              <span className="hm-dev-num hm-dev-muted">
                {donePct} % klart · {progress.total} spelare
              </span>
            ) : null}
          </div>
          {rows.length > 0 ? (
            <div className="rv-summary">
              <div className="rv-unreviewed">
                <span className="hm-dev-eyebrow">Ej granskade</span>
                <span className="rv-unreviewed-value hm-dev-num">{progress.unreviewed}</span>
              </div>
              <div className="rv-bar rv-bar--wide" role="img" aria-label={`${donePct} procent granskat eller låst`}>
                <span style={{ width: `${donePct}%` }} />
              </div>
              <div className="hm-dev-muted hm-dev-num">
                Granskade {progress.reviewed} · Låsta {progress.locked}
              </div>
            </div>
          ) : null}
          <div className="hm-dev-panel-body rv-filters">
            <div className="hm-dev-chips" role="group" aria-label="Statusfilter">
              {REVIEW_BUCKETS.map((b) => (
                <button key={b} type="button" className="hm-dev-chip" aria-pressed={bucket === b} onClick={() => setBucket(b)}>
                  {REVIEW_BUCKET_LABEL[b]} <span className="hm-dev-num">{countFor(b)}</span>
                </button>
              ))}
              <button type="button" className="hm-dev-chip" aria-pressed={bucket === null} onClick={() => setBucket(null)}>
                Alla <span className="hm-dev-num">{progress.total}</span>
              </button>
            </div>
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Sök spelare…" aria-label="Sök spelare" style={{ minWidth: 220 }} />
          </div>

          {error ? (
            <div className="hm-dev-panel-body"><div className="hm-dev-alert">{error}</div></div>
          ) : loading ? (
            <div className="hm-dev-empty">Läser in…</div>
          ) : (
            <div className="hm-dev-table-wrap">
              <table className="hm-dev-table">
                <thead>
                  <tr>
                    <th className="hm-dev-sticky-col">Namn</th>
                    <th>Status</th>
                    <th>Pos</th>
                    <th className="hm-dev-num">CA</th>
                    <th>CA-konf.</th>
                    <th className="hm-dev-num">PA</th>
                    <th>PA-konf.</th>
                    <th>Kalibrering</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => {
                    const b = reviewBucket(r);
                    const href = `/editor/ratings/${r.profile.playerId}?clubId=${encodeURIComponent(selectedClubId)}`;
                    return (
                      <tr key={r.profile.playerId} className="rv-row" onClick={() => router.push(href)}>
                        <td className="hm-dev-sticky-col">
                          <a
                            href={href}
                            className="rv-name"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              router.push(href);
                            }}
                          >
                            {namesById[r.profile.playerId] ?? r.profile.playerId}
                          </a>
                        </td>
                        <td>
                          <span className={BUCKET_CLASS[b]}>{REVIEW_BUCKET_LABEL[b]}</span> <span className="hm-dev-muted hm-dev-num">{r.status}</span>
                        </td>
                        <td>{r.profile.position}</td>
                        <td className="hm-dev-num">{r.profile.ca.value ?? "—"}</td>
                        <td className="hm-dev-muted">{r.profile.ca.confidence}</td>
                        <td className="hm-dev-num">{r.profile.pa.value ?? "—"}</td>
                        <td className="hm-dev-muted">{r.profile.pa.confidence}</td>
                        <td>{r.matchedCalibration ? <span className="hm-dev-pos">TRÄFF</span> : <span className="hm-dev-muted">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visibleRows.length === 0 ? (
                <div className="hm-dev-empty">
                  {rows.length === 0
                    ? "Ingen trupp inläst -- välj en klubb till vänster."
                    : bucket === "UNREVIEWED" && !search
                      ? "Alla spelare i klubben är granskade eller låsta. Välj nästa klubb till vänster."
                      : "Inga spelare matchar filtret."}
                  {bucket !== null && rows.length > 0 ? (
                    <div style={{ marginTop: 8 }}>
                      <button type="button" className="hm-dev-btn hm-dev-btn--sm" onClick={() => setBucket(null)}>Visa alla</button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
