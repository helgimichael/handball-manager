"use client";
// Employment states: what a manager without a club sees instead of a club-internal page. The page
// itself is never mounted (GameShell renders this in its place), so no former-club data reaches
// the screen -- whether the route came from a link, a direct URL, a remembered tab or history.
import Link from "next/link";
import { getClub } from "@/lib/game-data";
import ClubCrest from "../ClubCrest";
import "./no-club.css";

export function NoClubAccess({ formerClubId }: { formerClubId?: string }) {
  const former = formerClubId ? getClub(formerClubId) : undefined;
  return (
    <section className="hm-noclub" aria-labelledby="hm-noclub-title" data-testid="no-club-access">
      <div className="hm-noclub-mark" aria-hidden="true">HM</div>
      <div className="hm-noclub-body">
        <span className="hm-noclub-kicker">Utan klubb</span>
        <h1 id="hm-noclub-title">Den här delen hör till en klubb</h1>
        <p>Trupp, taktik, träning, personal, ekonomi och klubbens transfers sköts av den som leder klubben. Du får tillgång igen den dag du skriver på för en ny klubb.</p>
        {former && (
          <p className="hm-noclub-former">
            <ClubCrest clubId={former.id} shortName={former.shortName} primaryColor={former.primaryColor} size={22} />
            <span>{former.name} leds nu av klubbens egen organisation. Du kan följa klubben i tabeller, resultat och <Link href={`/career/clubs/${encodeURIComponent(former.id)}`}>klubbens profil</Link>.</span>
          </p>
        )}
        <div className="hm-noclub-actions">
          <Link className="hm-btn hm-btn-primary" href="/career/manager?tab=jobs">Jobbmarknaden →</Link>
          <Link className="hm-btn" href="/career">Till Idag</Link>
          <Link className="hm-btn hm-btn-ghost" href="/career/players">Spelarmarknaden</Link>
        </div>
      </div>
    </section>
  );
}
