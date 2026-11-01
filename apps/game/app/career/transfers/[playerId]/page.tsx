"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { PageHeading } from "@/components/manager/Workspace";
import { NegotiationRoom } from "@/components/transfers/NegotiationRoom";

// HM-ALPHA2-05E: the Negotiation Room -- the ONE place a negotiation is
// conducted. Transfer Centre, Recruitment Centre and the player profile
// all link here (`?deal=LOAN` pre-selects a loan for a new negotiation).
export default function NegotiationRoomPage() {
  return <Suspense><Room /></Suspense>;
}

function Room() {
  const params = useParams<{ playerId: string }>();
  const search = useSearchParams();
  const playerId = decodeURIComponent(params.playerId);
  return (
    <div className="game-transfers-page">
      <PageHeading eyebrow="Transfer Centre / förhandling" title="Förhandlingsrum" description="Klubben och spelaren svarar i kalendern. Varje bud och svar står kvar här." actions={<Link className="hm-btn" href="/career/transfers">← Transfer Centre</Link>} />
      <NegotiationRoom key={playerId} playerId={playerId} initialDeal={search.get("deal") === "LOAN" ? "LOAN" : "PERMANENT"} />
    </div>
  );
}
