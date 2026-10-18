# NordicWatch – Earth Observation / Copernicus v0.1

## Intended use

Provide a read-only catalogue of **public Copernicus Emergency Management Service (CEMS) Mapping activations** whose **catalogue centroid** falls within a defined Roslagen/Uppsala/Vätö or Hälsingland/Söderhamn area, plus a separately labelled Sweden-wide context view.

**Important:** This is not continuous raw satellite imagery processing, a fire detector, a flood detector, nor proof of a roadway being blocked. It does not infer detailed event boundaries or production impacts. A catalogue activation means Copernicus published a mapping activation, not that the reported hazard is ongoing at the user’s location.

## Data source

Official documentation:
- https://mapping.emergency.copernicus.eu/about/how-to-harvest-cems-mapping-data/
- https://mapping.emergency.copernicus.eu/about/how-to-harvest-cems-mapping-data/emergency-response-data/

Preferred public rapid-mapping JSON:
https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations-info/

Fallback official all-activations API:
https://mapping.emergency.copernicus.eu/activations/api/activations/

Both endpoints were verified with read-only HTTP calls returning HTTP 200 and JSON on 18 October 2026.

No credentials or licensed commercial imagery are required for this prototype. Check Copernicus product reuse terms before redistributing product downloads or imagery.

## Boundaries

- Local monitored areas are explicit **approximate rectangles**. They are not exact administrative boundaries or routable road corridors.
- The point location comes from the published activation centroid WKT field. A mapped area can overlap our region while its centroid is outside; hence false negatives are possible.
- Sweden-wide activations whose centroid is outside the local rectangles are listed **only if the user opts into context**. They are not projected as local incidents.
- Missing activations do **not** indicate the absence of fires, flooding, storms or infrastructure damage.
- Activation time, event time and last update are preserved separately. A closed mapping activation is not equated with an ended natural hazard, and an open mapping activation is not an ongoing fire.
- The service fetches at most six 100-record pages every six hours; it indicates when the catalogue is not fully scanned. Only officially documented allowlisted HTTPS domains are fetched, with redirect checking, timeouts and a per-page payload limit.
- Copernicus API failure keeps earlier observations for history but sets source health **UNAVAILABLE**, not "all clear". No automatic military alerts, threat scores or emergency routing are modified.

## Architecture

- earth-observation-core.js: UMD/Node model normalizing the official mapping activation schema, validated WKT, source provenance, bounded AOI filters and evidence caveats.
- cloudflare/copernicus-mapping-collector.mjs: read-only official API polling and isolated eo:latest Cloudflare KV snapshot; fallback from public Rapid Mapping to combined Mapping API on source failure.
- cloudflare/event-feed-worker.js: isolated GET /earth-observation endpoint, available only when EARTH_OBSERVATION_ENABLED=true. Scheduled collector reuses the existing Worker 15-minute cron but caches results for six hours.
- earth-observation.html: mobile-first Leaflet view with regional filters, provenance cards, coverage notices and direct links to official Copernicus activation details.
- Existing event-based military Activity, Strategic Early Warning, Source Coverage and push alerts are unaffected.

## Verification tests

    node --check earth-observation-core.js
    node --check cloudflare/copernicus-mapping-collector.mjs
    node --test tests/earth-observation-core.test.js tests/copernicus-mapping-collector.test.mjs
    node --test tests/*.test.js tests/*.test.mjs

Also run the read-only actual-source GitHub Action (Copernicus actual API smoke) and verify that both GitHub Pages and the Worker endpoint return HTTP 200 after deployment.

## Next iterations

1. **AOI/product geometry**: retrieve verified product footprint polygons and layer metadata from documented Copernicus activation details, test geometry parsing, and display actual footprints rather than centroids.
2. **Flood/wildfire changes**: integrate georeferenced mapping products or NASA FIRMS, compare products across timestamps, and measure observed changes with calibrated uncertainty.
3. **Winter watch**: attach SMHI weather/warnings and Trafikverket disruptions to Uppsala–Vätö (route 77) and Uppsala–Söderhamn (E4), with documented licensing and no automatic claims about road safety.
4. **Resilience impact**: only use independently verified open transport networks and affected area footprints; never infer outages or road closures from centroid location alone.

This first version is a verifiable building block for the planned Resilience Intelligence capability, not a safety-of-life operational warning system.


## Operational data path – 18 October 2026

Read-only live tests showed HTTP 200 from Copernicus official APIs in GitHub Actions, but HTTP 403 from Cloudflare edge workers. The first Worker collection consequently reported UNAVAILABLE (correctly; no false data).

To avoid reliance on that blocked upstream route, the supported production path is now:

1. tools/copernicus-sync.mjs fetches official published mapping activation metadata in GitHub Actions.
2. .github/workflows/copernicus-sync.yml runs on changes and on a 6-hour schedule, commits a bounded public snapshot to data/copernicus-activations.json.
3. earth-observation.html reads that same-origin published JSON file before trying the legacy Worker endpoint.
4. If the static snapshot is older than 12 hours the UI explicitly marks it as historical/stale.

The Cloudflare endpoint remains an experimental fallback only; it cannot be relied on until Copernicus permits it. Disabling the blocked Cloudflare collector once the static path is verified avoids repeated 403 requests.

The real 267-entry Rapid Mapping catalogue in October 2026 contained zero activation centroids inside the local Roslagen and Hälsingland rectangles and four other Swedish activations. Missing local matches is not evidence of no flooding or no disaster.

**This v0.1 is a catalogue integration, not image-backed Earth Observation change detection.** The next phase still needs actual georeferenced product polygons and time-series change analysis.

**Production decision (18 October 2026):** The Cloudflare collector is disabled because the two official endpoints return HTTP 403 from that runtime. GitHub Actions is the active supported collector and its timestamped public JSON file is the source for the regional UI; the Worker endpoint remains disabled until upstream access is reviewed.
