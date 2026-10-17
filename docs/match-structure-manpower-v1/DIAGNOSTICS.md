# Developer diagnostics and evidence scope

`apps/game/scripts/lib/matchStructureDiagnostics.ts` observes canonical V2 state and events. It does not commit decisions, draw randomness, alter possession ownership or create a separate match result. The production import graph does not reach this module or the controlled scenario helper.

For a complete live capture, construct `MatchStructureObserver` before the first tick. After each canonical tick, call `observe(state, newEvents)` with the events added by that tick, then call `report(state)`. Repeated reports are stable and preserve canonical state and RNG bytes. Enabling the observer partway through a match does not reconstruct its missing prefix; the report's `complete` flag describes engine completion, not prefix coverage. The full-match proofs in this audit capture from the beginning.

`manpowerSnapshot` reports actual court IDs, field players, keeper IDs, body limits, medical/exchange availability and suspended IDs with remaining official time. The generic field-count label is HOME v AWAY. An equal field-count label can still have different total bodies or an empty goal; `MANPOWER-CONFIGURATIONS.json` therefore stratifies keeper counts separately. Physically entering or exiting exchange bodies count as COURT, while available receiver IDs exclude active exchanges and medical ineligibility.

Events in live reports use post-tick manpower. Field attempts and their resulting goals both use shot-release manpower. Duration uses the preceding population boundary and separates official from simulation time. Recorded readers reverse canonical population events from the final core, replay them forward, and verify exact final population. Full current production proofs independently compare those intervals and court IDs against actual live snapshots.

Possessions always reuse `possessionEconomy` played records, continuation aliases and voided provisional-event IDs. Ordinary free throws continue the same possession; a manpower change does not create one. Starts are exclusive, while exposure to several configurations and transition/settled phases can overlap. Threat cycles and second attacks remain the existing observational proxies. Broad ball losses have NO DIRECT COMPARISON to official technical errors. Possession volume, duration and ordinary free throws remain NO_REFERENCE.

Foul diagnostics join committed contact opportunities, executed physical contacts, assessed infringements, whistles and personal decisions through canonical identities. Grouped unannounced discipline retains every physical foul ID while counting its personal decision once. Final role labels are not claimed to reconstruct event-time roles. Offensive fouls and post-sanction misconduct have no authentic producer in the scoped engine; their zero counts are not proof of complete rules coverage.

The retained sample is 40 HBL plus 40 Allsvenskan matches from the completed Attribute Integration phase. The after sample is a purposeful eight plus eight covering overlap defects and extreme tails, not a representative new league estimate. Source hashes, paired initial-session identities and raw core hashes are checked before aggregation. The controlled opportunities use six numerical states and 32 seeds per state, preserving profiles and context; no scoring multiplier is introduced.

Run tools from their documented working directories. For example, from `apps/game`:

```powershell
node --import tsx scripts/prove-match-structure.ts
node --import tsx scripts/prove-match-discipline.ts
node --import tsx scripts/prove-match-structure-truth.ts --league hbl
```

These commands create evidence and refuse to overwrite completed output. Reuse valid receipts rather than repeating completed simulations. The retained-reader and keeper-configuration tools aggregate existing cores without simulating new matches. Heavy jobs run sequentially. Raw cores, checkpoints and logs remain locally under ignored `raw/` and `verification/`; compact JSON evidence, reader snapshots and the report are committed. `VERIFICATION.json` records command, working directory, exit code and log hash for each successful stage, with historical failed receipts retained locally.

The recorded reader v1 `STOPPED_HALFTIME` label includes second-half preparation after the halftime notice in compressed career matches. It is not a physiological halftime-duration estimate. Actual live phase diagnostics distinguish this preparation. All stopped categories spend zero official time; running-clock restart preparation is included in official exposure.
