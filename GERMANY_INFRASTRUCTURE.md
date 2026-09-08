# German Baltic coverage and infrastructure patterns

## Two separate layers

`news-routing.js` explicitly recognizes Schleswig-Holstein, Mecklenburg-Vorpommern, Kiel, Lübeck/Luebeck, Rostock, Rügen/Ruegen, Fehmarn, Greifswald, Stralsund and German Baltic ports. `germany-infrastructure.js` additionally recognizes coastal aliases such as Warnemünde, Mukran, Sassnitz, Lubmin and Puttgarden. Place coordinates propagate into official event extraction. Geography still requires a security topic; generic German politics, sports and ordinary local crime do not qualify. Freshness is evaluated separately from geography.

The infrastructure detector is independent of EventScore, the existing situational/correlation engines, aircraft logic, Daily Brief and fixed-hotspot scoring. The dedicated nationwide query writes only `NORDICWATCH_GERMANY_INFRASTRUCTURE`, never the legacy signal archive or `D.hotspots`. Existing ordinary news fetching also supplies its raw records to this detector before normalization.

## Evidence and uncertainty

Each accepted report retains its original record, original HTTP(S) URL, source name, title, description, timestamp, entities, event type(s), location, coordinates, infrastructure type(s), severity, confidence and suspected cause. Unknown/malformed timestamps and explicitly uncertain ingestion timestamps are excluded rather than dated at fetch time. Undated, future, expired and explicitly mock/seed/test-only records cannot produce a pattern.

Coordinates are source-reported when valid; otherwise named places use approximate centroids, labeled `PLACE_CENTROID`. Unknown locations retain null coordinates. A centroid is not a located facility, and the map explains that distinction. Military/logistics proximity requires the source to mention that infrastructure; no secret-node database or inferred military-site position is used.

Sabotage/arson remains `SOURCE_REPORTS_SABOTAGE_OR_ARSON` only when the reporting supports it, never a confirmed attribution. Negated sabotage, threat-only coverage and planned drone inspections are excluded or treated as ordinary failures. Routine/technical/weather causes remain low. Unknown cause remains `UNKNOWN`.

Original URLs are used in **View source ↗**. Invalid/missing URLs display **Source link unavailable**. Unknown source names are explicitly labeled. No placeholder source URL is generated.

## Conservative pattern threshold

- Rolling 72-hour evidence window, evaluated on refresh and every minute in the UI.
- At least three distinct unusual incidents in one connected component.
- At least one German Baltic incident or source-explicit military/logistics incident.
- At least two infrastructure categories or two different reported places.
- Connections require a shared infrastructure category within 72h, or drone/infrastructure or transport/energy/telecom disruptions within 24h. Connected inland records receive `correlatedStrategicRelevance` separately from `directGeographicRelevance`.
- Ordinary outages alone never satisfy the unusual-incident requirement.

URL canonicalization deduplicates repeated fetches without replacing the original clickable URL or renewing timestamps. Without an explicit incident ID, reports from the same place/day count conservatively as one incident, including differently worded descriptions of a plant/transformer/grid failure. This can undercount separate incidents at the same place; it prevents multiple headlines from manufacturing a pattern. Reports remain individually visible: `signalCount` is the full displayed evidence count, while `incidentCount` is distinct incidents.

Patterns are temporary **WATCH** assessments, with a separate `patternRelevance` (not EventScore). Relevance increases with incident count, distribution, multiple categories, drone evidence and independently corroborated reporting. Its formula is capped at 85; this is a conservative heuristic, not a calibrated threat probability. The first evidence expiry triggers reevaluation; a pattern disappears when the remaining evidence no longer satisfies the threshold.

CIC is exposed as coherence × interaction × corroboration. Coherence uses distinct incident count; interaction uses infrastructure-category diversity and spatial distribution. Corroboration requires explicitly supplied independence groups. Different domains, headlines or publishers alone do not prove independence. Unknown independence remains low; one incident with two explicit independent groups increases pattern confidence to MEDIUM. Co-occurrence does not establish a common cause or actor.

## UI and collection

Dynamic hotspots appear below fixed hotspots and as dashed map circles in the existing Hotspots layer. The evidence count expands all contributing records using the existing `hotspotSignalMarkup` renderer. Each record shows title, source, timestamp, match reason and original link/fallback. Disclosure state survives refresh, with a ≥44px Close control and Escape support. The map popup also exposes the evidence list. Coverage is displayed even when no hotspot is supported.

The dedicated client GDELT query runs every 15 minutes, offset six seconds from startup to avoid coinciding with the main query. The Worker adds `GET /germany-infrastructure`, deriving structured candidates from its pre-geographic-filter rolling archive, including inland German evidence otherwise omitted by `/news`. It uses the existing Worker source coverage and CORS policy. No notifications or new third-party credentials are added. Worker collection remains limited to its configured sources; broad infrastructure coverage depends on GDELT or future configured feeds.

The service-worker cache version and shell include both new scripts. Deployment of the changed Worker is required for its new endpoint. This implementation has not been deployed or pushed as part of this task.

## Verification

Run `node --test tests/*.test.js tests/*.test.mjs`.

Deterministic unit cases cover all required places/categories, generic-news rejection, single and multiple routine failures, unusual distributed incidents, inland propagation, deduplication, timestamp expiry, negation, source independence, Worker plumbing and original URLs. These cases are only unit inputs and are never inserted into a running app.

The legacy score regression evaluates all configured fixed hotspots before/after independent German pattern evaluation on the same inputs. The Kaliningrad case remains exactly 83 with one signal. Existing scoring functions are unchanged.

`GERMANY_RUNTIME_AUDIT.json` records actual public-service fetching at **2026-09-08 14:11:59 UTC**: **44 articles + 1 event**. The only explicitly German record was a DVIDS retirement ceremony in Kaiserslautern; it was correctly rejected by the detector. No German infrastructure incident or temporary hotspot was supported by that fetched set. The dedicated GDELT request returned **HTTP 429**; this is a collection limitation, not evidence of no incidents.

Local browser smoke testing verified mobile intelligence opening/closing and the visible message `German infrastructure: insufficient coverage · 0/2 feeds · 0 temporary patterns`. The local-origin feeds were unavailable and the deployed Worker does not yet expose the new route. No German synthetic incident was inserted; pre-existing demo layers were not treated as evidence. Consequently, a positive German hotspot from current live data and its live source-click path remain unverified. Positive pattern behavior is covered by unit tests only.
