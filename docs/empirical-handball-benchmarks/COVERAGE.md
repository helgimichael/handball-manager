# Data quality and coverage

2025/26 regular seasons only. COMPLETE_SEASON describes the source season, not a promise that every metric is complete. Metric-level coverage travels with every profile row.

| Competition | Expected | Results | Protocols | Player-stat PDFs | Result coverage | Eligible keeper-match observations |
|---|---:|---:|---:|---:|---:|---:|
| se_handbollsligan_herr | 182 | 182 | 0 | 182 | 100.000% | 480 |
| swe-2 | 182 | 182 | 182 | 0 | 100.000% | 0 |
| swe-w-1 | 132 | 132 | 132 | 0 | 100.000% | 0 |
| swe-w-2 | 132 | 132 | 131 | 0 | 100.000% | 0 |

## se_handbollsligan_herr
Duplicate result records: 0. Rejected match sources: 0. PDF row/consistency issues: 0.

Missing/rejected source details:
```json
{
  "rejected": [],
  "pdfIssues": []
}
```

## swe-2
Duplicate result records: 0. Rejected match sources: 0. PDF row/consistency issues: 0.

Missing/rejected source details:
```json
{
  "rejected": [],
  "pdfIssues": []
}
```

## swe-w-1
Duplicate result records: 0. Rejected match sources: 0. PDF row/consistency issues: 0.

Missing/rejected source details:
```json
{
  "rejected": [],
  "pdfIssues": []
}
```

## swe-w-2
Duplicate result records: 0. Rejected match sources: 1. PDF row/consistency issues: 0.

Missing/rejected source details:
```json
{
  "rejected": [
    {
      "id": "profixio:32356562",
      "issues": [
        {
          "kind": "PROTOCOL_REJECTED",
          "reason": "Unattributed goal"
        }
      ]
    }
  ],
  "pdfIssues": []
}
```

## Identity and evidence

Team mappings use exact names, competition context or documented aliases; ambiguous names never resolve silently.
- se_handbollsligan_herr: 13/14 mapped to current game clubs; 0 ambiguous. Unmapped historical/women teams retain durable source team IDs.
- swe-2: 14/14 mapped to current game clubs; 0 ambiguous. Unmapped historical/women teams retain durable source team IDs.
- swe-w-1: 0/12 mapped to current game clubs; 0 ambiguous. Unmapped historical/women teams retain durable source team IDs.
- swe-w-2: 0/12 mapped to current game clubs; 0 ambiguous. Unmapped historical/women teams retain durable source team IDs.

Protocol player IDs remain source IDs; PDF player IDs remain match-local. No similarly named players are merged. Outfield match positions are unavailable; official player-season positions remain a separate, source-specific layer. Unknown/broad positions are retained without inventing V9/M9/H9.

Evidence tiers: A full shot-event context; B shot-type aggregates; C shots/saves/goals; D results and scoring/rule protocol facts. These sources provide D match/scoring/rules, C HBL keeper/outfield attempts, and a limited 7m split. No full shot-context A dataset is populated. Missing possession/whistle/transition metrics stay NO_REFERENCE.

Keeper distributions require at least 10 on-target shots and a reconciled keeper denominator. Backup keepers with fewer shots remain normalized but are outside the rate cohort. Keeper minutes are unavailable, so raw-save comparisons must consider exposure and rotations. Season cohorts require at least 10 appearances (keeper seasons also ≥100 shots faced). A season rate is never used as match-rate variance.

Confidence policy: metric match coverage ≥90% HIGH, ≥50% MEDIUM, otherwise LOW. Cross-competition keeper transfer is capped at MEDIUM, separately from source completeness. Coverage does not guarantee freedom from source recording errors; arithmetic checks and caveats remain visible.
