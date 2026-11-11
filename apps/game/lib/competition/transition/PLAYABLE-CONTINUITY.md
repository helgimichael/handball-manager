# Playable Swedish continuity policy

The default career transition now uses `gameContinuityRules`, through the existing
planner, fixture qualification resolver and atomic rollover. Explicit requests can
still use the unchanged official-only package and its unresolved dependencies.
`provenance` distinguishes these paths; original regulation citations describe the
supported 2026/27 structure, not future official appointments.

## Game policy (not a federation decision)

- Four complete double round-robin leagues: 14/14/12/12 clubs. Existing direct
  and qualification formats, sporting ranking and verified home patterns remain.
- Qualification entries can schedule once their own sources are ready, while
  other published league calendars are still finishing. The whole-season
  postseason gate does not delay independent pool qualifiers.
- Future spring qualifier slots inherit month/day from the supported profile.
  Generated league calendars start September 1, six days between rounds, with
  existing national breaks and fixed Cup scheduling. Published/played fixtures
  are never rewritten. Cup future profiles retain their provisional designation.
- Unverified northern home reference and equal source ranks after replacements
  use a persisted-seed home draw, explicitly GAME_CONTINUITY. Official-only
  requests retain the blocker.
- Five Division 2 regions use the 53 sourced canonical registrations. Their
  simplified season is an aggregate seeded double round-robin at neutral equal
  strength; no CA/PA, reputation or catalog ordering selects promotions. Results
  and rankings persist by season. Unresolved sporting ties block rather than
  award a place by identity. The existing twelve external ports and qualification
  graph determine which entrants actually reach Division 1.
- Division 2 remains a club-level pool. Eligible canonical identities do not
  need player records to contest its aggregate rankings or qualification scores.
  Qualification fixtures reuse the existing Fast Match path and its neutral
  empty-roster strength; no player statistics or identities are invented for
  pool-only participants. Official-only requests still require supplied squads.
  Administrative exclusions and cooperation checks remain mandatory.
- A validated GAME_CONTINUITY promotion from a pool into Division 1 creates a
  candidate squad inside atomic rollover only when no playable squad exists.
  The default is 16 fictional senior players: two goalkeepers, two per outfield
  position and additional central back/pivot coverage. Partial valid squads are
  supplemented; existing records are preserved. Conflicting registrations or
  invalid contracts block rather than being repaired by generation.
- Fictional names reuse the youth-name generator. Ratings reuse the unchanged
  DIVISION_1 population prior and career fallback attribute pipeline; contracts
  reuse the existing salary/contract generator (the economy model's existing
  unspecified-tier fallback; no financial tier model is changed). No CA/PA baseline is
  recalibrated. Players carry MOCK plus explicit DIVISION2_PROMOTION provenance.
  IDs include model, save seed, club, first simulated season and slot; collisions
  are avoided against persisted player maps. Existing playable squads are never
  regenerated. Candidate records are discarded if final rollover validation fails.
- Geographic travel bands and seeded equal-band allocations fill Division 1
  12/12. The extreme northern anchor stays north. Unknown anchors/capacity
  conflicts block. These are game allocations, not official organizer rulings.
- Relegated clubs return to a regional pool; promoted clubs leave it. World
  lifecycle, market and economy enumerations follow effective membership.
- Optional dated `competitionRestriction` on the existing ClubPartnership model
  identifies evidence, origin, maximum eligible tier and optional parent-division
  restriction. Existing ACTIVE AFFILIATED_B_TEAM career rows also enforce SHF
  9:1, 9:4-7 without optional metadata. Ending after December 31 does not restore
  spring advancement. Past inactive agreements are not reactivated. The same
  checks apply to caller/QA evidence and the final atomic target membership.
  Existing upper-half replacement rules handle rejected upward entries. No
  historical register is imported as a currently active real-world agreement.

## Validation paths

The mapped Division 2 identities start without squads. Stock careers now rank
those eligible identities without QA players. The unresolved Bodens registration
is not conflated with another club. No researched affiliation dates or statuses
are added or inferred.

`division2-stock-career.ts` loads the shipped Swedish squads and ratings, starts
an ordinary New Game career, and uses Continue plus production quick matches.
Manager lineups and retention decisions use existing APIs; CPU recruitment,
contracts, injuries and development use the normal daily tick. It verifies
promotion squads, membership sizes, cooperation eligibility, historical match
snapshots, JSON migration, receipt retries and duplicate identities at rollover.
Set HM_SEASON_QA_DIR under C:/DEV/QA/reports for its reports and checkpoints.
The older three-season domain regression retains its labeled QA fixture and is
separate from stock-career validation.

Complete fixture/result snapshots join the existing season history at successful
rollover. JSON save/load, registrations, contracts and historical archive fields
remain intact. Repeated committed requests use the existing exact receipt.
