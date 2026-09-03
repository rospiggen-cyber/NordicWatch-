# NordicWatch Detection, Correlation, Behaviour & Baseline Engine

## Architecture review

NordicWatch is a static, mobile-first PWA. `index.html` owns Leaflet rendering and orchestration. Small UMD modules provide aircraft classification, route geometry, Coast Guard behaviour, special-mission analysis, background alert analysis, Event Engine validation, UAV analysis and maritime validation/correlation. IndexedDB stores bounded aircraft tracks; bounded localStorage snapshots support device-local history and briefs. Cloudflare Workers isolate scheduled event discovery, optional ADS-B background monitoring, KV state and push subscriptions. The service worker caches the application shell and validates notification deep links against the application origin.

The existing Germany/Russia escalation-chain fields and scoring are retained unchanged. The new situational engine consumes normalized observations and event outputs; it does not replace Event Engine or its escalation analysis.

## Staged implementation

1. Add a reusable `situational-engine.js` module with strict observation, assessment and confirmed-external records.
2. Parse article and event occurrence dates separately, detect republished historical reporting and score only genuine new developments at full temporal weight.
3. Extend existing aircraft classification and geometric route analysis without replacing trail persistence or rendering.
4. Calculate bounded regional baselines and multi-day recurrence from device-local snapshots. Repeated activity gradually becomes baseline.
5. Normalize NEWS, AIRCRAFT, GNSS, HOTSPOT, INFRASTRUCTURE and MARITIME inputs into one correlation interface. Correlation requires domain diversity and caps low-confidence amplification.
6. Produce explainable EventScore 2.0 components and a bounded Activity contribution instead of summing raw scores.
7. Add material-change alert decisions, stable deduplication signatures and same-origin context deep links.
8. Feed real stored changes, recurrence, baseline deviation and correlations into existing briefs and hotspot summaries.
9. Add reusable regression fixtures for ARTEMIS II, Korpen, Coast Guard loiter, weak-signal clusters, ordinary tanker transit, recycled news, official updates, social claims and feed failure.
10. Run all existing and new tests, browser-console checks and narrow mobile checks before changing the version.

## Safety boundaries

- Aircraft presence or geometry alone never asserts attack preparation, targeting or imminent escalation.
- Low-quality signals cannot produce CRITICAL solely by accumulation.
- `localStorage` and IndexedDB are untrusted convenience storage, never authorization.
- No AIS provider is added. Maritime observations use the existing validated adapter interface.
- One failed feed degrades only its domain; other layers continue.
