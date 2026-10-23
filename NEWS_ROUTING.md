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

## Swedish naval reporting gap — Sundsvall / Bothnian Sea (19 October 2026)

**Evidence:** On 8 October Försvarsmakten published the joint US–Swedish–Finnish naval exercise in the Bothnian Sea. DN published a fresh article on 18 October describing that earlier exercise. These are different publication dates for the *same earlier event*; an 18 October article is not evidence of new 18 October ship activity.

**Root causes in the tested code:** default GDELT news query lacked named Northern Swedish sea/locality terms, Swedish naval terms and a focused maritime query; routing lacked `Sundsvall`, `Bottenhavet`, `krigsfartyg`, `robotjagare` and Swedish exercise inflections. The official Swedish Armed Forces source was allowlisted but did not have a configured working feed; therefore the 8 October official press release was not systematically monitored.

**Fix:** allow relevant Swedish/English naval reporting for northern Bothnian locations and names; supplement broad GDELT with a *separate* focused Swedish-naval query so a large general news volume is less likely to bury a relevant item. Keep all existing verification, AOI, 72h publication freshness, deduplication and historical-event rules. The new source is displayed independently in Source diagnostics; one failed GDELT request does not skip the next. Do not fabricate a live vessel track or backdate the 18 October article's publication.

**Known remaining gap:** no verified fresh RSS/official source adapter for Försvarsmakten press releases yet. Scraped DN and search result matches cannot be assumed to appear in GDELT. Monitor deployed per-query diagnostics to confirm real fetches. Improving first-party original-source monitoring requires a separately tested original-source collector.

## First-party Försvarsmakten newsroom source (19 October 2026)

NordicWatch now collects the **actual original-publisher RSS feed** for Swedish Armed Forces announcements: `https://www.mynewsdesk.com/se/rss/current_news/441`. The URL was independently discovered from the official `https://www.mynewsdesk.com/se/forsvarsmakten` newsroom's HTML `application/rss+xml` link and verified via live HTTP 200 / XML on GitHub Actions. At verification it returned 20 items, including Försvarsmakten's 8 October USS Paul Ignatius / HMS Karlstad / FNS Hämeenmaa exercise press release and a 19 October naval-drone press invitation. No Mynewsdesk API key or browser scraping is required.

A **tenant-specific URL allowlist** associates only that exact RSS feed and articles under `/se/forsvarsmakten/(pressreleases|news)/…` with Swedish Armed Forces. Other Mynewsdesk tenants and feeds must never be treated as confirmed official reports. The collector preserves original RSS `pubDate` (including timezone) and runs on the existing 15-minute Worker cycle. Original-publisher statements confirm the publication/source, not the operational truth of every assertion. Any article must still pass AOI/topic and timestamp routing; older announcements cannot reenter the 72-hour news window as new reports.

Swedish exercise and naval vocabulary uses Unicode-aware boundaries, allowing original Swedish headlines to become mappable official events (including Bottenhavet/Sundsvall) without inferring live ship positions. Source health reports the first-party feed independently as `se`. `tools/verify-fm-source.mjs` performs a live-source smoke test in GitHub Actions, alongside fixture regression cases for spoofed tenants, original dates and a failed peer source.

**Operational limits:** The RSS feed returns a bounded set of recent articles and cannot prove complete history. Source downtime, feed truncation and publication delays must be shown as coverage gaps. AIS/visual tracking is not implied. For real-time operations, consult official navigational warnings and current operational publications rather than interpreting exercise announcements as current positions.

## Developer diagnostics

Open the app with `?debugNews=1` to display routing counts. In DevTools inspect `window.nordicWatchNewsDiagnostics` for per-item source, publication time, normalized location, region/topic matches, score/reasons, event ID/status, inclusion flags and exclusion reasons. `dailyBriefEvaluated` counts deduplicated events; `aoiRelevant` counts records before event grouping. `whatChanged` indicates candidate material changes relative to the previous routing snapshot; the actual changed view compares against its own last-view snapshot.

Browser fetch/parse counters describe returned JSON records. RSS parser counts and source failures belong to the Worker, not the browser. Worker KV `routing:diagnostics` contains detailed decisions (seven-day TTL), `routing:events` the normalized relevant store, and `discovery:last-run.routingCounters` the stage totals. Failed relevance processing excludes the affected item; a pipeline failure yields degraded coverage, not a global feed or a no-change conclusion.

## Validation

- `node --test tests/*.test.js tests/*.test.mjs`
- `node tests/news-routing.browser.cjs` with Playwright available via Node module resolution and Microsoft Edge installed. Uses an isolated local server, mocked data, desktop and Pixel 7/Android viewport emulation; no user browser profile or notifications. This is viewport emulation, not a physical Android device test.

The app remains v1.1; the service-worker cache revision includes the shared routing module for offline use. These local source changes require normal frontend publication and Worker deployment to reach production.

## Europe-wide physical hybrid campaign context (23 October 2026)

`NW-HYBRID-001` documents a false-negative from SVT/EBU's 23 October 2026 investigative roundup of 54 suspected Russian-linked incidents. The short title/description had no named Nordic/Baltic country, so the former AOI-only rule silently excluded the reporting even though it concerns European security and potential regional spillover.

The relevance evaluator now admits a tightly bounded class of **European Russia-linked physical hybrid campaign/investigative reporting** requiring all four elements in supplied title/description: Russian actor, Europe-wide scope, physical hybrid method, and campaign/aggregation cue. These are represented as `correlatedStrategicRelevance`, **not** a Nordic geographic incident, not confirmation of Russian attribution and not evidence of an individual attack. Generic political, economic and cyber-only European news, isolated overseas sabotage, and stale/recycled reports remain excluded by tests. Normal 72-hour freshness, source provenance, independence rules and EventScore thresholds remain unchanged.

**Unresolved:** This fixes routing if reporting is already collected; it does not discover missing sources, ingest the 54 individual incidents, reconstruct cross-border causal chains or verify current production coverage. Data completeness and operator review remain necessary.
