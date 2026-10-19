# News relevance and routing repair

Both Daily Brief and What Changed use `news-routing.js`, including events returned by `/events` and articles in the local signal archive. The event Worker imports the same relevance evaluator. Collection remains broad; routing requires an AOI location or an established named event association and a security topic. Publisher location, a global deployment keyword or generic NATO membership does not establish AOI relevance.

NAMEJS 2026 maps to Latvia and one military exercise. Other events merge through explicit event IDs, source signal links, canonical URLs or identical titles within the same publication day. Different descriptions are not assumed to describe the same incident without one of those links. Source count counts distinct hosts, not independent ownership; it is not proof of independent corroboration.

Normal routing evaluates evidence updated within 72 hours. Developing/ongoing context can remain for seven days. A polling timestamp alone never renews the evidence window. Resolved, stale and future records have explicit exclusion reasons. Original event storage is retained; irrelevant records are excluded from the normal views.

## Bounded NATO Black Sea shipping spillover (19 October 2026)

The Nordic–Baltic AOI remains the primary geography. A separate low-volume, 72-hour GDELT query looks for Black Sea/Romania/Bulgaria maritime-security reporting. Its results still pass through the same freshness, source/dedup and news-routing stages. Black Sea articles are admitted as **correlated strategic relevance** (not as direct Nordic geographic incidents) only when they combine:

1. An explicit Black Sea maritime/coastal location (or named southeastern NATO port/waters);
2. A maritime merchant-shipping or maritime-security topic;
3. A reported kinetic/drone threat or defensive interception/response; and
4. An explicit Romania, Bulgaria or NATO actor/link.

A generic NATO reference, shipbuilding press release, routine naval exercise, Ukraine-only attack, or Hormuz incident does not qualify on its own. The news and briefs label these items **Black Sea / NATO southeastern flank**. The position shown when focusing such an article is only broad regional context, **not** a verified incident coordinate.

This is a relevance/source-discovery improvement, not AIS tracking, verified attribution, a maritime alert feed, or proof of complete coverage. Existing military push thresholds and EventScore are unchanged. Query and filter tests use fixtures; production freshness and GDELT accessibility must still be checked after deployment.

## Developer diagnostics

Open the app with `?debugNews=1` to display routing counts. In DevTools inspect `window.nordicWatchNewsDiagnostics` for per-item source, publication time, normalized location, region/topic matches, score/reasons, event ID/status, inclusion flags and exclusion reasons. `dailyBriefEvaluated` counts deduplicated events; `aoiRelevant` counts records before event grouping. `whatChanged` indicates candidate material changes relative to the previous routing snapshot; the actual changed view compares against its own last-view snapshot.

Browser fetch/parse counters describe returned JSON records. RSS parser counts and source failures belong to the Worker, not the browser. Worker KV `routing:diagnostics` contains detailed decisions (seven-day TTL), `routing:events` the normalized relevant store, and `discovery:last-run.routingCounters` the stage totals. Failed relevance processing excludes the affected item; a pipeline failure yields degraded coverage, not a global feed or a no-change conclusion.

## Validation

- `node --test tests/*.test.js tests/*.test.mjs`
- `node tests/news-routing.browser.cjs` with Playwright available via Node module resolution and Microsoft Edge installed. Uses an isolated local server, mocked data, desktop and Pixel 7/Android viewport emulation; no user browser profile or notifications. This is viewport emulation, not a physical Android device test.

The app remains v1.1; the service-worker cache revision includes the shared routing module for offline use. These local source changes require normal frontend publication and Worker deployment to reach production.
