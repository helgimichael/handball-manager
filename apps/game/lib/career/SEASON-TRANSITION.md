# Atomic season transition (M1.2D)

`attemptSeasonTransition(career, request)` is pure. It returns `APPLIED`, `BLOCKED` or `ALREADY_APPLIED`, a state, dependencies, and the existing planner readiness preview when available. Only an `APPLIED` state may replace the active career and be persisted. Every blocked attempt returns the exact original object.

The request identifies the source season, current rule package, qualification/eligibility/external/group evidence, optional explicit ranking decisions, and an evidenced next-season package/kickoff. Standings are rebuilt from the career's complete league fixtures/results; callers cannot substitute unrelated tables. Profiles and imported evidence are trusted caller inputs requiring organizer verification. There is no automatic claim that a supplied profile is official.

The transaction requires `canGenerateNextSeason === true`, validates all calendar competitions, canonical membership, source/result identity, complete target sizes and unchanged competition structure, then builds one candidate containing all memberships, history and fixtures. Final double round-robin validation happens before the candidate is exposed. Calendar failure discards it. Human and AI clubs share the same claims. Registrations, contracts, ratings, match archives, existing history and the game/processing dates carry through; season statistics reset only on success. Contract expiry, recovery and other daily lifecycle actions remain in the existing daily flow.

The optional receipt stores the exact request for idempotent retries, including after JSON save/load. Retry the original blocked source with additional evidence. Retry the committed target with the same explicit source request to receive `ALREADY_APPLIED`; a conflicting request is blocked. Older saves need no schema change. Legacy `seasonOutcome.nextMembership`, strength choices and automatic Division 1 balancing do not authorize movement. The script-compatible `rolloverSeason` throws `SeasonTransitionBlockedError` on blocked completed seasons; its `.result` is structured. The existing home-page button displays dependencies without saving a blocked attempt.

## Current limits

- The shipped Swedish 2026/27 package retains all M1.2A–C blockers: administrative review, the unverified northern home reference and the unverified 2027/28 profile. The spring 2027 qualification windows and terminal-decider policy were verified in M1.2E. It cannot complete a live rollover.
- Division 1 needs actual complete calendars/results, licensed canonical district entrants, qualification evidence and organizer group allocation. No external outgoing destination registry is implemented; those exits remain blocked.
- Raw results cannot resolve `d1-n-semi-10` without verified home priority; `d1-n-final` depends on it. Equal source ranks after replacements can also block relevant Allsvenskan qualification home priority. Existing evidenced concluded-series support is unchanged.
- Every current competitive fixture must have a result. Unplayed conditional fixtures still present in the career calendar require upstream resolution/removal; the transaction never silently drops them.
- League/family/format/size restructuring is explicitly unsupported. The generated league calendar uses the existing deterministic weekly generator and national breaks; its exact official dates are not asserted. A verified next-season package and kickoff must be supplied by the caller. Cup generation and legacy postseason scheduling remain outside this milestone; their old movement suggestions cannot pass this gate.
- The button has no new evidence editor/import UI. Trusted callers can supply reviewed evidence through the API. Permanent rule-package limitations require a newly reviewed package; missing evidence alone cannot clear them.

## Reproduce

From `apps/game`, run `npm run competition:rollover-example`. It reads no live save. The success case uses the existing 28 canonical top-two-tier clubs, verified HBL/Allsvenskan interchange formats, explicitly synthetic qualification scores, and a **synthetic closed lower boundary retaining Allsvenskan 11–14**. This policy is not Swedish regulation and is never selected by the live button. It produces 14/14 clubs, 364 fresh league fixtures, 32 fixed-slot cup fixtures and one archive; the manager follows Aranäs into HBL. The second example uses the unchanged official profile and returns exact blockers with the original career preserved.

`seasonRollover.test.ts` covers atomicity (including failure after candidate generation), direct/qualification/human/AI movement, missing/conflicting evidence, ties, incomplete pyramid, malformed membership/profile/calendar, deterministic retry, old-save compatibility, contracts/registrations and a focused two-season closed synthetic sequence. Existing planner tests remain authoritative for sporting formats and boundaries.

M1.2F adds sourced district registration snapshots and separates future sporting results (A), unverified rules (B), and administrative dependencies (C). See SWEDISH-PYRAMID-DATA-COMPLETION.md and transition/sweden2026Data.json. Provider registrations never become canonical entrants automatically. The explicit affected-league set is respected during regeneration; the published fixed cup calendar and history compaction remain active.

## Owner-authorized playable continuity (supersedes default-profile limits above)

Default requests now use the explicit GAME_CONTINUITY policy described in
[PLAYABLE-CONTINUITY.md](../competition/transition/PLAYABLE-CONTINUITY.md).
The official-only package and explicit official requests keep their original
blockers. Future publication is no longer required by the default profile.
Shipped Division 2 squad coverage remains insufficient and blocks atomically;
no fictional production squads or official decisions are supplied.
