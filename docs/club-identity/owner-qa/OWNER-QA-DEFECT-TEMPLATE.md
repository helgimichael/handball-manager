# Arena Nights 231 — Owner QA defect report

One report per finding. Every finding names the canonical surface ID(s) from `OWNER-QA-231-CHECKLIST.csv`; nothing outside the 231 recommendations is raised here. After filing, set the surface's `owner_status` to `DEFECT` (or `DEVIATION REJECTED`) and put the report ID in `defect_ref`.

```
ID:               OQA-###                       (sequential, e.g. OQA-001)
Surface ID(s):    e.g. MDY-02                   (one or more canonical IDs; first = primary)
Milestone:        e.g. M3 · Live match
Priority:         P0 / P1 / P2 / P3             (the surface's lab priority — do not re-rank here)
Recommendation:   e.g. B · Floodlight Broadcast (from the checklist, column `recommendation`)
Type:             DEFECT                        broken, wrong data, error, layout fault
                  DEVIATION                     works, but differs from the recommendation
                  MISSING                       part of the recommendation is not there
                  POLISH                        matches the recommendation, quality below the bar
Severity:         Blocker / Major / Minor / Cosmetic

Where:            route + how you got there    (e.g. /career/match-day/… via Idag › Schema → Spela)
Test career:      QA-A … QA-I                   (and game date if relevant)
Viewport:         desktop / tablet / phone (width)
Browser:          e.g. built-in browser pane, Chrome 1xx

Steps:            1. …
                  2. …
Expected:         what the recommendation says should happen (quote the checklist's
                  Intended / Look for / Delivered text)
Actual:           what happened
Evidence:         screenshot path(s) / short screen recording / console message

Owner decision:   Fix now / Fix later / Accept as is
Notes:
```

## Severity guide

| Severity | Meaning |
|---|---|
| Blocker | The surface cannot be used or reviewed (crash, data lost, wrong career shown). |
| Major | The recommendation's main purpose is not met (key information or primary action missing/wrong). |
| Minor | Secondary element missing or wrong; workaround exists. |
| Cosmetic | Visual polish only (spacing, truncation, alignment, colour). |

## Owner status values (checklist column `owner_status`)

| Value | Use when |
|---|---|
| `NOT REVIEWED` | Default. Technically verified only. |
| `APPROVED` | You reviewed it and it meets the intended experience. |
| `APPROVED WITH NOTES` | Meets it; notes are for later polish, no defect filed. |
| `DEFECT` | A defect report (OQA-###) is filed. |
| `DEVIATION ACCEPTED` | Differs from the recommendation, and you accept it (see Known deviations in the walkthrough). |
| `DEVIATION REJECTED` | Differs, and you want the recommendation delivered (file OQA-### of type DEVIATION/MISSING). |
