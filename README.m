# NordicWatch v1.0 — Detection, Correlation, Behaviour & Baseline Engine

NordicWatch is a mobile-first Nordic–Baltic OSINT situational-awareness PWA.

## Current components

- Leaflet/OpenStreetMap situational map
- public ADS-B feed with evidence-based military and government classification
- Swedish Coast Guard Q-300 track history and persistent-loiter observations
- confirmed military Event Engine with geographic and expected-activity context
- scheduled official-source Event Discovery with dynamic watch zones, ADS-B correlation and novelty scoring
- trusted external military reports with approximate geolocation and strict reported/observed/inferred evidence separation
- reusable RC-135/ISR/EW/AWACS/ASW special-mission normalization, strategic-area scoring and material-change alerts
- high-priority military capability-change discovery for NATO/Nordic tests, deployments, fielding and procurement beyond permanent map hotspots
- maritime behavior anomaly scoring for loitering, reversals, towing, restricted manoeuvrability, AIS gaps and strategic correlations with strict evidence separation
- persistent, bounded aircraft trails with 15-minute to 3-hour display windows
- geometry-based route-pattern assessment and mission-role correlation
- Nordic–Baltic GDELT security and defence reporting
- device-local aircraft, news and maritime-signal history
- Morning Brief and Evening Brief
- provider-independent Maritime Signals layer
- validated CSV, JSON and GeoJSON import with quarantine
- installable PWA and service-worker notification routing
- deduplicated recovered-UAV incidents with strict OBSERVED / ASSESSED / ATTRIBUTED provenance
- recovered-UAV hotspot scoring, brief context, alerts and non-attributive pattern detection
- actor-to-response event chains, source-confidence labels, change-aware escalation scoring and secondary Baltic hotspot context

## Maritime Signals

No AIS API is connected. Maritime data enters only through:

1. the bundled, clearly labelled synthetic test dataset;
2. user-imported CSV, JSON or GeoJSON records that pass validation;
3. a future adapter whose source and licence have been approved.

Every accepted record must include source name, publisher, licence, retrieval time, allowed use and source quality. The application distinguishes observation, automatic indicator and confirmed report. Risk is the visible sum of geography, temporal correlation, independent sources, source quality and freshness.

See [MARITIME.md](MARITIME.md) for schemas, adapter instructions and limitations.

## Event Engine

The Events / Exercises layer keeps official event context separate from direct observations and NordicWatch inferences. Expected allied activity can reduce an anomaly assessment only when its role and actor match the event; contradictory activity such as Russian ISR near an active NATO exercise increases interest instead. The bundled NAMEJS 2026 record is marked as an official-source seed snapshot and remains available when the Worker feed is down. See [EVENT_ENGINE.md](EVENT_ENGINE.md) for the schema and Cloudflare ingestion boundary.

## Aircraft trails

Military and Coast Guard positions are retained by ICAO hex in IndexedDB, with a bounded localStorage fallback. Tracks are capped at 360 points, 120 aircraft and six hours of persistence; the visible window is 15, 30, 60 or 180 minutes. Old geometry is simplified and rendered in four fading segments that are updated in place.

Route patterns are inferred from time-series geometry rather than callsigns. Popup evidence keeps recorded positions under `OBSERVED`, while TRANSIT, ORBIT, RACETRACK, LOITER, REPEATED PASS and HOLDING / CIRCULAR remain `INFERRED` with a 0–100 confidence value. Short tracks remain UNKNOWN.

## Mobile map popups

All Leaflet popups use a bounded internal scroll area and retain a 44×44 px close control above the scrolling content. Mobile popups remain inside the map and safe viewport, while touch scrolling is isolated from map dragging. Layers, drawers, briefs and long side cards use dynamic viewport bounds, safe-area insets, contained momentum scrolling and sticky headers. The Layers panel starts collapsed on narrow screens and collapses whenever a popup opens.

## Coast Guard behavior

Swedish Coast Guard Dash 8 Q-300 aircraft are classified as Government / Coast Guard from corroborating operator, registration, callsign and ICAO identifiers. Device-local position history can identify persistent loiter from duration, confinement, speed and accumulated turns. The result is labelled as direct observation plus automatic interpretation; it becomes a confirmed operation only when supported by a confirmed rescue or emission report. Circling alone does not raise Activity unless it persists for at least 90 minutes.

## Authentication and data handling

v1.0 does not implement user authentication or a payment wall. Browser notification permission is not authentication. Settings, deduplication state and some fallback history are stored locally and must not be treated as access control.

Credentials must never be placed in `index.html`, the service worker, imported files or `localStorage`. The dormant Worker placeholder has no upstream endpoint and always rejects maritime-data requests until a separately reviewed adapter is implemented.

## Limitations

Public ADS-B coverage is incomplete, aircraft classification is heuristic and external reports require corroboration. Imported maritime records are not made true merely by passing schema validation. Mockdata is synthetic. Infrastructure geometry is approximate analytical context and not suitable for navigation. NordicWatch is an analytical aid, not an authoritative intelligence source.

Copyright © 2026 Mats Pettersson / InionX. All rights reserved.
