# NordicWatch v1.1 — consolidated update

## Delivered behavior

SituationScore sits above the existing EventScore and Activity Score. Dated observations accumulate across refreshes in seven domains: news, aviation, AIS, GNSS, infrastructure, cyber and official reporting. Static map geometry and records explicitly marked mock are excluded from the new situation engine. The deterministic browser fixture is explicitly labeled TEST ONLY and is never loaded by the application.

Situations show WATCH → DEVELOPING → ELEVATED → HIGH, a separate confidence and OBSERVED CORRELATION / POSSIBLE RELATIONSHIP / CONFIRMED RELATIONSHIP. Co-occurrence never establishes a common cause. Confirmation requires an explicit shared relationship ID and HTTPS evidence reference; importers must validate that evidence, not merely its URL format.

The score exposes seven additive contributions: accumulated incidents, temporal compression, independent source groups, CIC, baseline deviation, acceleration and individual EventScore context. CIC is Coherence × Interaction × Corroboration. Baseline uses stored reference observations from days 8–30, requires at least three observed reference days and explicitly reports insufficient coverage otherwise. Acceleration compares the latest six hours with the previous six hours. A standalone headline is capped at 25, single-source evidence below alert level, and normal recurring ISR at 30. An alert needs at least three observations, two declared independent source groups and SituationScore ≥65. These are transparent heuristic thresholds, not calibrated probabilities.

Browser Situation Alerts use the existing armed-notification preference, a persistent ledger and Web Locks where supported. Scheduled Worker Situation Alerts use the existing webhook configuration and a distinct KV ledger. Reordering, reloading and unchanged snapshots do not notify again. Delivery was tested with mocks; no real push was sent during development.

## Dedicated correlation cases

Svalbard/Barentsburg correlates legal/economic measures, official response and regional activity. Legal/economic, diplomatic, information/political, military signalling and confirmed military escalation are separate fields. Legal measures and rhetoric alone contribute zero military-signalling score. Higher SituationScore is not labeled military escalation.

The Professor Molchanov seizure on 2 September 2026 is confirmed in the [Governor of Svalbard's statement](https://prod.sysselmesteren.no/en/news/2026/09/russian-ship-seized-in-svalbard/). This establishes the legal anchor, not a military connection. No invented subsequent military observations or permanent “live” incident were seeded into the app.

High North/Jan Mayen correlates airlift, logistics/basing, maritime restrictions and supporting aviation. A single C-17 remains low. Converging signals can produce an assessment of possible temporary distributed basing or sea-denial preparation; no exact weapon or attack intent is inferred. Both case classifiers operate inside the shared clustering, CIC, score, alert and brief pipeline.

## Brief, news and UI

Daily Brief 2.0 normally shows up to three significant developments and a “What NordicWatch is watching” section. Every relevant stored article from the latest 24 hours is evaluated regardless of when the previous brief ran. Reporting aged 24–72 hours needs a genuine recent update or explicit ongoing context. All evaluated news remains accessible inside the brief. Previous live-detail functionality remains in an expandable section.

News ranking exposes geography, security relevance, EventScore, correlation, recency and source reliability. News health reports X/Y available sources, with fetched → freshness → geographic → dedup → selected diagnostics and the stored-record count. Two adapters are configured: GDELT and the event Worker's new `/news` route. A failed network request does not suppress eligible cached news. True changed-content revisions with a newer source update and explicit new-development indication survive deduplication.

The icon, navy background and cyan accents are reused. The map remains the main surface. Mobile intelligence uses a closable bottom sheet; score explanations use internally scrolling sheets with sticky ≥44 px close controls and Escape support. Situation cards and news/event scores open evidence, source links, contributions, relationship reasons and confidence. Map situation outlines are an additional layer; existing tracks, hotspots and controls remain available.

## Aircraft and maritime

France – Navy / Marine nationale operator evidence identifies CTM1717 E121 as military transport, with known military identity taking precedence over civilian-looking airframes. [French defence material identifies Xingu in naval service](https://www.defense.gouv.fr/en/node/1978). S102B metadata is recognized explicitly as Korpen; the [Swedish Armed Forces handbook identifies S 102 B as a signals-intelligence aircraft](https://www.forsvarsmakten.se/siteassets/2-om-forsvarsmakten/dokument/handbocker/fkt-fmiff.pdf). Recognized airline callsign plus airliner type can yield PROBABLE CIVILIAN; type alone remains insufficient. Military identity retains precedence. The bundled background Worker was regenerated from the shared classifier.

AIS adds rendered stored tracks, dwell/patrol-like/search-like geometry, route-baseline comparison and coverage-aware missing-observation assessment. No disappearance is inferred unless an adapter explicitly supplies healthy coverage. Pattern geometry does not establish operational purpose. Infrastructure proximity remains contextual. Geographic validators now accommodate Svalbard and the High North.

## Files

New: `situation-engine.js`, `situation-ui.js`, `brief-engine.js`, `maritime-patterns.js`, `tests/situation-engine.test.js`, `tests/browser-fixture.html`, this report.

Changed: `index.html`, `aircraft-classifier.js`, `intelligence-core.js`, `event-engine.js`, `situational-engine.js`, `maritime-core.js`, `cloudflare/event-feed-worker.js`, `cloudflare/adsb-monitor-worker-bundled.js`, `sw.js`, `manifest.webmanifest`, `README.m`, `tests/special-mission-analysis.test.js`.

The event Worker adds `/news` and `/situations` and includes weak upstream articles even when discovery produces no high-scoring military event. Deploying the Worker is a separate operation from pushing repository changes.

## Verification and limits

- `node --test tests/*.test.js tests/*.test.mjs`: 43 passing test entries, including all prior regressions and 18 new acceptance cases.
- Inline script and new modules parse successfully. Git whitespace checks pass.
- Desktop browser fixture: accumulated weak-signal situation, contribution/source drilldown, source-degraded diagnostics and Evening Brief retaining current stored news verified.
- 390 × 844 browser viewport: bottom-sheet layout, internal scrolling and closing the long evidence sheet verified.
- External event/news services were unavailable in the localhost smoke run; cached reporting and seed fallback remained usable. Live ADS-B returned data. No deployed Worker/PWA push delivery was claimed or performed.

New browser keys are `NORDICWATCH_SITUATION_SIGNALS`, `NORDICWATCH_SITUATION_STATE`, `NORDICWATCH_SITUATION_HISTORY`, `NORDICWATCH_SITUATION_ALERTS` and `NORDICWATCH_BRIEF_V2`. Existing keys are preserved. Worker keys are `situation:signals`, `situation:current`, and `situation-notification:<id>`.

Retention remains browser-local/KV and quota-limited; no existing history is deliberately deleted. Reference observations measure local feed coverage, not all regional activity. Independent-source groups depend on supplied provenance; syndicated sources should share `independenceGroup`. Unknown source relationships must not be counted as confirmed. Worker KV does not provide a transactional exactly-once outbox across concurrent runs. No new commercial AIS, live GNSS, NOTAM or cyber provider is connected; validated JSON observations can supply these domains through Import observations. Geographic grouping is approximate and threshold calibration requires operational data.
