# NordicWatch Event Engine

Event Engine adds confirmed context to observations; it is not a news feed. `EVENT` records are accepted from `GET /events` on the Cloudflare Worker. The Worker exposes only validated records stored in its `EVENTS` KV namespace and never sends credentials to the browser.

Only HTTPS source links from the configured official-source registry are promoted as `CONFIRMED`. NATO, JEF and the listed Nordic/Baltic national defence authorities have adapter slots in `cloudflare/event-feed-worker.js`. Source-specific import jobs should parse upstream publications, map them to the EVENT schema, preserve the official URL and write one `event:<id>` KV record. Social media must not be the primary confirmation source.

The client validates and sanitizes the feed again, deduplicates by event ID or source URL, and falls back to `mock/events.json` if the Worker is unavailable. NAMEJS 2026 is an official-source seed snapshot: its facts are confirmed by the Latvian Ministry of Defence, while `seed: true` makes clear that the record was bundled rather than fetched live.

Evidence is deliberately separate:

- `OBSERVED`: direct aircraft observations.
- `CONFIRMED`: an official EVENT statement.
- `INFERRED`: an Event Engine comparison or deviation.

Expected allied activity can lower an anomaly score, but never hides a contradictory deviation. Russian ISR close to an active NATO/JEF event creates an inferred high-interest deviation while retaining the underlying observed and confirmed evidence records.
