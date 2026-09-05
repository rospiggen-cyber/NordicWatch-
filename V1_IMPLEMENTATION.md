# NordicWatch v1.0 — implementation and validation

## Changed files

- `intelligence-core.js`: shared signal lifecycle, archive deduplication, event lifecycle, material fingerprints, change classification, security perimeter, CIC and hybrid clusters.
- `index.html`: current-news filtering, durable signal/event/notification storage, history viewer, state comparisons, brief deltas, expanded Baltic coastal queries, air-package explanations and compact expandable cards.
- `event-engine.js`: lifecycle delegation and preservation of observation metadata.
- `situational-engine.js`: same-domain complementary air packages, restricted to 200 km and one hour; future observations excluded.
- `cloudflare/event-feed-worker.js`: signal archive, observation-based event metadata, persistent notification journal and removal of event-record TTL.
- `sw.js`: v1.0 shell, new core cached, cache cleanup limited to NordicWatch caches.
- `manifest.webmanifest`, `README.m`: v1.0 identification.
- `tests/intelligence-core.test.js`: lifecycle, persistence, perimeter and package regression cases.
- `tests/special-mission-analysis.test.js`: expected application version updated.

## Models and persistence

Signals retain publishedAt, ingestedAt, lastUpdatedAt, eventTime, expiresAt, signalId, eventId, freshness and timeStatus. Missing publication time receives TIME_UNCERTAIN and reduced confidence. Re-fetching never resets ingestion time. Explicit historical occurrence time controls freshness even if publication is recent.

Events carry eventId, status, firstObservedAt, lastObservedAt, startDate, endDate, locations, entities, sourceSignals, confidence, severity and eventScore. Ordinary events become INACTIVE after 48 hours without a new dated observation. Exercises, deployments and other persistent categories use their declared end date, or seven days when no end exists. An ACTIVE exercise is context, not a new detection.

Notification records contain firstNotifiedAt, lastNotifiedAt, lastNotifiedVersion and notificationFingerprint. The fingerprint excludes polling time, ingestion time and calendar day. Browser journal keys and Worker KV notification keys have no version suffix or expiry. The service-worker cache lifecycle does not delete these stores.

New browser keys: NORDICWATCH_SIGNAL_ARCHIVE, NORDICWATCH_NEWS_EVENTS, NORDICWATCH_EVENT_ARCHIVE, NORDICWATCH_EVENT_NOTIFICATIONS, NORDICWATCH_CHANGES_STATE. Existing histories and preferences remain intact. Worker keys: signals:archive and notification:<eventId>, plus existing event:<id> records without TTL.

## Tests

Run `node --test tests/*.test.js tests/*.test.mjs`.

25 test entries passed: all 14 existing regression files and 11 new lifecycle/pattern cases. The new cases cover five-day-old reports, republishing, duplicate feeds, uncertain timestamps, new observations reactivating an event, inactivity, long exercises, unchanged NAMEJS over five days, serialized restart state, severity/scope changes, multiple signals per event, geographic clusters, recurring ISR and ISR/AWACS/tanker packages. Restart tests exercise serialized notification state; they do not simulate an installed mobile operating system.

Browser smoke testing on localhost verified v1.0 loads, live ADS-B renders, NAMEJS fallback renders, Morning Brief opens and reload succeeds. A 390 × 844 viewport verified collapsed event Evidence/History/Correlations/Sources sections. The remote event endpoint failed during the smoke test; fallback stayed operational. No real notifications were sent, and no production deployment was performed.

## Migration risks and remaining work

- Browser localStorage is device-local and quota-limited. Archives are never intentionally pruned, but indefinite production retention needs IndexedDB/server storage and export/backup. Already expired historical Worker records cannot be recovered by this update.
- Old notification journals lack material fingerprints. The first v1.0 qualifying event may notify once while the new journal is initialized. Independent browser/Worker notification channels do not share a single delivery transaction. Concurrent tabs or Worker runs can race; exactly-once delivery requires an atomic coordinator/outbox.
- Deduplication uses canonical URL, normalized headline and conservative token similarity with time/place/entity/type checks. This is heuristic similarity, not multilingual embeddings or complete named-entity extraction. Distinct articles require a supplied shared eventId to guarantee grouping beyond duplicate coverage. Same-URL updates require both an explicit new-development indication, a newer source update timestamp and changed content; they are retained as separate source revisions linked to the original event.
- The perimeter is a text-based geographic classification with named coastal locations, not administrative boundary polygons. German/Polish coastal terms are permanently included in the foreground query; complete unattended regional coverage depends on configured upstream sources and deployed scheduled Workers.
- CIC and hybrid clusters are heuristic assessments. No common actor or hostile intent is asserted. Air-package detection uses proximity, simultaneity and complementary roles; existing recurrence/baseline analyses remain separate supporting evidence. Further calibration needs regional labeled datasets.
- GNSS and external AIS retain their previous connection state: no live feed is configured. Production push delivery, an actual installed PWA restart/update, offline CDN availability, and provider integration require testing in the deployed environment.

These limitations mean v1.0 is a tested local implementation increment, not certification that every production acceptance criterion is complete.
