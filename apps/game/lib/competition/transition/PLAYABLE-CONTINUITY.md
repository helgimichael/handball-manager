# Playable Swedish continuity policy

The default career transition now uses `gameContinuityRules`, through the existing
planner, fixture qualification resolver and atomic rollover. Explicit requests can
still use the unchanged official-only package and its unresolved dependencies.
`provenance` distinguishes these paths; original regulation citations describe the
supported 2026/27 structure, not future official appointments.

## Game policy (not a federation decision)

- Four complete double round-robin leagues: 14/14/12/12 clubs. Existing direct
  and qualification formats, sporting ranking and verified home patterns remain.
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
- Entrants require seven uniquely registered, contracted players including a
  goalkeeper. Missing squads, conflicting ownership, expired contracts and
  explicit administrative ineligibility exclude them. Legitimate loans count.
  Pool insufficiency returns DIVISION2_POOL_INSUFFICIENT atomically.
- Geographic travel bands and seeded equal-band allocations fill Division 1
  12/12. The extreme northern anchor stays north. Unknown anchors/capacity
  conflicts block. These are game allocations, not official organizer rulings.
- Relegated clubs return to a regional pool; promoted clubs leave it. World
  lifecycle, market and economy enumerations follow effective membership.
- Optional dated `competitionRestriction` on the existing ClubPartnership model
  identifies evidence, origin, maximum eligible tier and optional parent-division
  restriction. Historic permanent-affiliation seeds alone impose no competition
  restriction. Existing upper-half replacement rules handle rejected upward
  entries. No currently active Hammarby/HK Cliff agreement is asserted.

## Known shipped-data blocker

The 53 mapped Division 2 identities currently have no production squads. None is
activated and no players are invented. Stock careers therefore cannot complete
this transition until enough eligible squads exist in every required region.
The unresolved Bodens registration is not conflated with another club.

The three-season competition-domain regression uses clearly labeled QA pool
squads and initially valid long contracts. Existing seeded Fast Match generates
all scores, including qualification deciders; calendar/progression and rollover
remain the actual domain functions. It tests sporting continuation, fixture and
history integrity, not the complete daily manager/AI contract lifecycle or live UI.
No existing career save is changed by the test.

Complete fixture/result snapshots join the existing season history at successful
rollover. JSON save/load, registrations, contracts and historical archive fields
remain intact. Repeated committed requests use the existing exact receipt.
