# NordicWatch – ADS-B feed recovery, isolated staging gate

Date: 2026-11-23. **No production changes.**

## Evidence and scope
The user's Cloudflare error logs show repeated `Unexpected token '<' ... <!DOCTYPE ... is not valid JSON` for `nordicwatch-proxy`. User-provided source shows that proxy fetches `https://globe.theairtraffic.com/data/aircraft.json` and calls `r.json()` without verifying status/content type. This explains the proxy exception; it **does not by itself explain all `nordicwatch-event-feed` errors**.

TheAirTraffic terms (updated 2026-10-31) explicitly state that the map's `/data/` endpoints are not a public API and require an approved key for third-party use. Do not retry, scrape, or rotate access to evade that policy.
- Provider: https://theairtraffic.com/terms
- Alternative: https://www.adsb.lol/docs/open-data/api
- API endpoint: https://api.adsb.lol/v2/mil (provider documents `ac[]`, accessible in public tests).

ADSB.lol's published quota is **500 requests/day per IP without a key**; API may return 429 and a Retry-After. Public flight data is **ODbL 1.0**, with attribution and potential sharing obligations. Commercial/paid NordicWatch needs a dedicated licensing and key/capacity review.

## What this PR supplies
- `cloudflare/adsb-lol-staging-smoke.mjs` – standalone Worker to paste/deploy **only to staging**, not a production proxy.
- `GET /`: health response (no external call).
- `GET /adsb-smoke`: **one** short-lived upstream read and aggregate counts; returns no aircraft IDs or coordinates and persists nothing.
- Detects HTTP errors/429/redirect/HTML/invalid JSON/invalid schema/oversized payloads/timeouts.
- Counts original records, positioned aircraft, Nordic bbox `54–71°N, 5–32°E` and Nordic records with `seen_pos <= 120s`. These are source observations, not proof of military operations.
- Mocked deterministic tests, no external API traffic in CI.

## Human staging acceptance (one-off)
1. Use the **separate** `nordicwatch-news-staging` Worker temporarily (or create a second isolated Worker). Do **not** use `nordicwatch-proxy` or `nordicwatch-event-feed`.
2. Copy the standalone .mjs file contents into staging's Cloudflare Edit code view and deploy there. This temporarily replaces the staging RSS smoke script if using that Worker. No KV bindings, API keys, or webhooks.
3. Open `/adsb-smoke` **once**. Expected: `status: OK`, `httpStatus: 200`, `records`, `positioned`, and a valid `ac[]` shape. A 429, HTML or unknown schema **blocks** migration.
4. If using the news staging Worker, restore its RSS test script afterward, or leave staging idle (do not set up periodic polling).
5. Compare against public API documentation and inspect Cloudflare invocation logs without copying sensitive credentials.

## Explicit NOT in scope
- No production deployment, no proxy replacement, no change to `index.html`, no change to `ADSB_ENDPOINT` or event-feed configuration, no cron trigger, no modified alert/scoring rules.
- Staging test success alone does not prove continuous reliability, availability in all Cloudflare regions, or suitability for 30-second polling. Current NordicWatch frontend polls every 30 seconds; at that cadence one uncached instance would need **2,880 fetches/day**, over the unkeyed 500/day provider quota. Before migration implement compatible caching, quota handling, attribution and licensing; verify source quality and stale positions.
- `nordicwatch-event-feed` has independent production errors and should be investigated separately.

## Release gate
Only after staging succeeds and capacity/licensing and traffic policies are addressed: prepare a separately reviewed replacement proxy and decide on production deployment. Keep the rollback and owner approval gates explicit.

## Follow-up: shared Cloudflare egress rate limited (23 Nov 2026)

User deployed `cloudflare/adsb-lol-staging-smoke.mjs` to the isolated
`nordicwatch-news-staging` Worker and ran `GET /adsb-smoke` at
`2026-11-23T09:30:28.273Z`.
The provider returned **429 RATE_LIMITED**, without Retry-After. That is a
confirmed provider-side refusal of this unkeyed Cloudflare request, not a
successful aircraft-data verification. Do not rerun to defeat the restriction.

The provider's official documentation describes ODbL 1.0, `x-api-key`,
500 unkeyed requests/day/IP and 1,000/day with a free adhoc key, but free
keys have no commercial SLA. A future subscription offering may require a
separate provider agreement and licensing review.
Official sources:
- https://www.adsb.lol/docs/open-data/api
- https://www.adsb.lol/request
- https://www.adsb.lol/docs/privacy-license
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://developers.cloudflare.com/kv/concepts/how-kv-works/

## Stage 2: isolated, authorized, cached collector (prepared in this PR)

`cloudflare/adsb-cached-proxy.mjs` is a **candidate**, not the live proxy.
It implements:
- **Fail closed** by default: all of `ADSB_CACHE_ENABLED=true`,
  `ADSB_PROVIDER_APPROVED=true`, `ADSB_API_KEY` as a Cloudflare secret,
  and a dedicated `ADSB_CACHE` KV binding are required for any upstream request.
- Only the Worker `scheduled()` handler requests `/v2/mil`; GET `/`,
  `/mil` and `/health` only read cache, never contact ADSB.lol.
- Nominal **5-minute cron** = 288 upstream requests/day, well below the
  documented 1,000/day adhoc-key quota. A KV cooldown gate also limits
  accidental rapid runs; 429 respects Retry-After and otherwise backs off
  until the next UTC day. Shared network, outages and quota changes can still
  cause interruption. No automatic retries.
- Stores Nordic-Baltic positional aircraft only, source timestamp, and
  minimal fields in KV. Client responses increment `seen` / `seen_pos`
  by cache age, set `live:false`, retain source/ODbL attribution, and
  return **503 without aircraft** if no valid snapshot or older than 10 min.
  Cached data must **not** be presented as near-real-time tracking.
- A diagnostic `GET /health` reports availability without exposing API keys,
  aircraft identities or precise locations. No writes except cron to staging
  KV. External monitoring must not infer "no activity" from missing data.

`wrangler.adsb-cache-staging.example.toml` is a template only: it is
**not deployed**, contains no real KV ID or API key and starts with collector
disabled. Never bind an existing production KV. Existing production
`nordicwatch-proxy` remains unchanged.

### Deployment gate (not met)
1. Obtain an expressly authorized API key and establish appropriate ODbL
   attribution/redistribution terms for NordicWatch's use.
2. Create a fresh dedicated staging Worker + KV, add API key via Cloudflare
   **secret**, not plaintext dashboard variable, public code, screenshot or chat.
3. Verify five-minute scheduled fetch with a single key; monitor for at least
   24 hours and confirm limits, positions, quality and stale markers.
4. Update the frontend on a separate reviewed PR to **label cached data age**
   rather than display "live" and to avoid polling the upstream API directly.
   Then test map, trails, alerts, UI and offline behavior.
5. Arrange explicit release approval and rollback route before production
   `ADSB_ENDPOINT` or proxy replacement.

**The user has not been asked to perform these steps and no Cloudflare
production change has been made by this PR.**
