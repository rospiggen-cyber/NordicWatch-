# NordicWatch — Event-feed failure RCA (draft, 2026-11-23)

## What is observed
Cloudflare user screenshots show `nordicwatch-event-feed` has about 100 errors out of roughly 150 invocations in the 24h dashboard, and `nordicwatch-proxy` has repeated JSON parse failures. The latter were independently traced to the proxy requesting a map-internal HTML page; **they do not establish the cause of the event-feed errors**.

No event-feed exception stack, code, or Cloudflare event invocation log was provided in the available screenshots, so no claim of a proven event-feed root cause is supported.

## Why this change exists
Previously `/health` could say `ok:true` based on a last successful discovery snapshot even if it was days old or a later scheduled run had failed. Failure of `runDiscovery` could also leave no persisted (sanitized) evidence of the stage at which it failed.

This draft provides:
1. A fixed vocabulary of stages: read catalogue, official sources, external sources, signal ingestion, event building, persistence, routing, state reconciliation, snapshot, supplements.
2. Best-effort, exception-safe logging to `discovery:last-error` on scheduled-run failure, with just phase, classification, error type and time. **No raw exception text, URLs, tokens, request headers, or stack traces**.
3. `/health` now checks that the last successful run is recent (within six hours, pending confirmation of the actual cron cadence) and reports a later recorded failure as `COLLECTOR_FAILURE`. It does not infer empty activity from missing data.
4. If persistence of diagnostics fails (e.g. KV itself is down), it logs a generic marker without masking the real error. Cloudflare's native logs remain authoritative.
5. Deterministic unit tests for stale data, recovered failures, still-active failures and sensitive-message redaction.

## Not yet established
- The exact Cloudflare error codes for `nordicwatch-event-feed`.
- Which scheduled phase failed, and whether it is a quota, Durable Object, KV, worker CPU, data or upstream issue.
- Whether the 24h dashboard errors reflect all GET requests or mostly scheduled invocations.
- A trustworthy source of active, new events after these failures.

## Safe acceptance gates
- [ ] CI green, independent code review.
- [ ] Confirm production cron frequency and adjust six-hour freshness boundary if needed.
- [ ] Test in a separate Worker + KV/DO where available; never attach the live `EVENTS` namespace to staging.
- [ ] Review output of `/health` and the Cloudflare *per-Worker* invocation errors, not account-wide proxy logs.
- [ ] If explicitly approved for production later, deploy with rollback plan and gather error stage evidence; do not change alerts, source allowlists or historical event counts as part of observability release.
- [ ] Investigate exact cause with new evidence; fix root cause in a separate PR.

**Draft diagnostic only. No production deployment or restart.**
