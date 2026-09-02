# NordicWatch Event Engine

Event Engine adds confirmed context to observations; it is not a news feed. `EVENT` records are accepted from `GET /events` on the Cloudflare Worker. The Worker exposes only validated records stored in its `EVENTS` KV namespace and never sends credentials to the browser.

Only HTTPS source links from the configured official-source registry are promoted as `CONFIRMED`. NATO, JEF and the listed Nordic/Baltic national defence authorities have adapter slots in `cloudflare/event-feed-worker.js`. Source-specific import jobs should parse upstream publications, map them to the EVENT schema, preserve the official URL and write one `event:<id>` KV record. Social media must not be the primary confirmation source.

The client validates and sanitizes the feed again, deduplicates by event ID or source URL, and falls back to `mock/events.json` if the Worker is unavailable. NAMEJS 2026 is an official-source seed snapshot: its facts are confirmed by the Latvian Ministry of Defence, while `seed: true` makes clear that the record was bundled rather than fetched live.

Evidence is deliberately separate:

- `OBSERVED`: direct aircraft observations.
- `CONFIRMED`: an official EVENT statement.
- `INFERRED`: an Event Engine comparison or deviation.

Expected allied activity can lower an anomaly score, but never hides a contradictory deviation. Russian ISR close to an active NATO/JEF event creates an inferred high-interest deviation while retaining the underlying observed and confirmed evidence records.

## Scheduled Event Discovery

`cloudflare/event-feed-worker.js` now has a scheduled discovery pass. The example Wrangler configuration runs every 15 minutes. It polls only HTTPS endpoints whose hostname belongs to the approved registry: the existing Nordic, Baltic, NATO and JEF sources plus DVIDS, Defense.gov, Navy.mil, Marines.mil, AF.mil and Army.mil. DVIDS provides a built-in official RSS endpoint; additional official RSS/Atom URLs are configured with `SOURCE_URLS`. A URL outside the registry is rejected even if supplied through configuration.

The worker extracts locations, named exercises, units, aircraft, ships, weapon systems, deployment/logistics terms, readiness changes and live-fire language. Its local Nordic geocoder creates temporary watch zones without an API key. Relevant records are converted to `EVENT`, deduplicated by source URL and underlying-event similarity, correlated with an optional public ADS-B endpoint, novelty-scored, and stored as `event:<id>` in `EVENTS` KV. Same-exercise activity at multiple locations creates a regional posture record without inferring a common actor beyond the official exercise relationship.

The browser refreshes the event feed every minute. Each active discovered location is rendered immediately as its own clickable dynamic circle, independent of the permanent hotspot list. A normal local event starts at 100 km, live-fire activity at 175 km, and strategic/long-range activity at 250 km. Expired circles are removed on the next refresh. Events sharing a confirmed operation name are connected by a dashed relation line while retaining separate circles—for example Trondheim and Jan Mayen during Operation Atlantic City 26.

Configure `EVENT_ALERT_THRESHOLD` (default 75). Alerts below the threshold are never sent. Above-threshold alerts are posted to the optional authenticated `ALERT_WEBHOOK_URL`; set `ALERT_WEBHOOK_TOKEN` with `wrangler secret put ALERT_WEBHOOK_TOKEN`. The payload includes the score and a human-readable explanation such as `CONFIRMED official source + strategic weapon + new location + related military airlift observed`. If the webhook is not configured, discovery and KV storage continue without push delivery.

Evidence remains separate in every discovered event:

- `CONFIRMED`: title/source facts from an allowlisted official publication.
- `OBSERVED`: matching ADS-B records within the temporary watch zone.
- `INFERRED`: correlation, novelty and regional-posture interpretations.

Social media is not in the confirmation allowlist. A future lead adapter may retain a social lead separately, but it must never emit `confidence: CONFIRMED` or write it as an official EVENT.
