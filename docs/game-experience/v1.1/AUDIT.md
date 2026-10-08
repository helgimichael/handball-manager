# Game Experience v1.1 — rendered UX audit

Checkpoint: `e365025` on `main`, preserving the approved navy/cream/burnt-orange Game Experience v1, all pre-existing QA/engine changes and the Motion worktree.

The actual production product was visited in isolated Chromium contexts before UI edits. The four human findings were confirmed: narrow New Game forms, dropdown-led Tactics, a utility-style Continue modal and form-like live coaching. BEFORE images were retained; a capture script was corrected to accept Analysis's real empty states, which did not have page headings. No source redesign was restarted.

The route sweep covers title/load, all six setup steps, Home, Squad, Tactics, Inbox, Contracts, Training, Calendar, Schedule/Matches, all four Analysis routes, Player Search, Scouting, Recruitment, Transfers, Staff/recruitment, Medical, Club/partnerships, Competition, Statistics, History, Preview, world advance, its destination, matchday preview, live controls, post-match and populated last-match Analysis. Each was rendered at 1920×1080 and 2560×1080.

| Finding | Implemented response |
| --- | --- |
| Setup loses the game's identity and wastes desktop space | Career journey rail, broad choice area, persistent club/manager summary and visible footer |
| Tumba's default selection is below the initial club viewport | Default club first in a stable native-radio order, with persistent identity preview |
| Removed leagues can leave an invisible club eligible to start | Selected club must belong to the active league selection and be playable |
| Fictional/REAL DATA/MOCK/build labels and unsupported database promises | Honest concise setup copy based on the current catalogue and actual selection semantics |
| Load flashes an empty list and immediately deletes saves | Explicit reading state, selected career context, inline deletion confirmation, Escape/cancel focus return |
| Tactics gives controls and seven positions no spatial relationship | Handball court, six outfield roles and a separate MV, active tactics and contextual replacements |
| Live decisions lack current state and eligibility context | Active native tactic buttons, snapshot player choices, pending exchange and canonical timeout reasons |
| Continue shows a processing utility without a clear destination | Actual generated dates/events, bounded reveal, reason for stopping and retained contextual next action |
| Reading an unread item removes the visible article; query links can be stale | Retained article, explicit filter transitions and current deep-link selection |
| Profile visits discard roster/search/contract controls | Career-scoped UI memory for filters, sorting, selection and page, separate from save data |
| Calendar's future training links open today's week | Real week query links and selected-week training entry |
| Analysis is in English and spreads unavailable data across equal panels | Swedish masthead/navigation, facts-first scenes, distinct missing-data language and object/report links |
| Staff/Medical lack team identity and useful context | Recorded responsibilities, role coverage, availability, physio, rehabilitation and history |
| Schedule can highlight a world fixture rather than the manager's next match | Canonical next-player-fixture highlight and supporting booking/context |
| History mixes all world transfers and hides the season milestone | Stored season summary, own-club/world scope and retained archive/statistics links |

Rendered review also corrected the native choice hit areas, an ultrawide club-row crop, singular count labels, raw nationality code, a court caption crossed by the goal line, unclear pre-avkast timeout copy and oversized replacement-rail spacing. Existing strong Home, player, club, competition and dossier compositions were retained.

No match-engine implementation, simulation builder, statistical calculation, scouting/transfer model, save schema or career progression algorithm was changed. No imagery was downloaded and no official club colours or photographic identities were invented.
