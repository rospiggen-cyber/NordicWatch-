# Freshness repair — 7 September 2026

Scope: timestamp normalization, freshness decisions and their diagnostics. Geography, ranking weights, aircraft, hotspots and notification decisions are unchanged.

The captured live `/news` response contained 26 records. At 2026-09-07T19:37:14.803Z all 26 had valid timestamps and passed the 72-hour window; stale, invalid and future/skewed counts were zero. Six publications were dated 7 September. The unchanged relevance evaluator selected zero AOI records from this sample. The former displayed freshness count was measured after relevance routing, so it incorrectly described those exclusions as freshness failures.

`window.nordicWatchFreshnessDiagnostics` now records every fetched item before normalization/geographic filtering: raw publication/update fields, canonical UTC values, the comparison clock, age, window, timestamp source/status, PASS/FAIL and reason. The displayed freshness stage uses that count. Stored-event/dedup counts remain separate. Worker runs save the equivalent records in KV `freshness:diagnostics` for seven days and totals in `discovery:last-run.freshness`.

The parser supports ISO offsets/UTC, RSS RFC dates, GDELT compact UTC, Unix seconds/milliseconds, and publication/update field aliases. ISO datetimes without an offset are interpreted as UTC. Missing publication falls back to a valid update timestamp; ingestion and poll timestamps do not become publication evidence. Missing/invalid dates are UNKNOWN. Small future skew up to two hours passes with an explicit warning. Normal article freshness is 72 hours; developing event context remains separate.

Validation: 78 regression tests passed. Desktop and Pixel 7/Android emulation passed the actual browser normalizer with all 26 captured records, plus Morning/Evening/What Changed regression checks. Android was emulated, not a physical device. Syntax checks passed. The former test restricting ordinary 24–72h articles was updated to the requested full 72-hour window. App version remains v1.1; only the offline cache revision changes.

Captured full records and per-item results are local diagnostics under `.wrangler/freshness-live-sample.json` and `.wrangler/freshness-live-diagnostics.json`; they are not source fixtures. The optional `NORDICWATCH_FRESHNESS_SAMPLE` environment variable runs a current 26-record sample through the browser test; the sample ages naturally and must be recaptured for later live checks.
