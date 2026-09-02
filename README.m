# NordicWatch v0.7.2 — Maritime Signals and Coast Guard Behavior

NordicWatch is a mobile-first Nordic–Baltic OSINT situational-awareness PWA.

## Current components

- Leaflet/OpenStreetMap situational map
- public ADS-B feed with evidence-based military and government classification
- Swedish Coast Guard Q-300 track history and persistent-loiter observations
- Nordic–Baltic GDELT security and defence reporting
- device-local aircraft, news and maritime-signal history
- Morning Brief and Evening Brief
- provider-independent Maritime Signals layer
- validated CSV, JSON and GeoJSON import with quarantine
- installable PWA and service-worker notification routing

## Maritime Signals

No AIS API is connected. Maritime data enters only through:

1. the bundled, clearly labelled synthetic test dataset;
2. user-imported CSV, JSON or GeoJSON records that pass validation;
3. a future adapter whose source and licence have been approved.

Every accepted record must include source name, publisher, licence, retrieval time, allowed use and source quality. The application distinguishes observation, automatic indicator and confirmed report. Risk is the visible sum of geography, temporal correlation, independent sources, source quality and freshness.

See [MARITIME.md](MARITIME.md) for schemas, adapter instructions and limitations.

## Coast Guard behavior

Swedish Coast Guard Dash 8 Q-300 aircraft are classified as Government / Coast Guard from corroborating operator, registration, callsign and ICAO identifiers. Device-local position history can identify persistent loiter from duration, confinement, speed and accumulated turns. The result is labelled as direct observation plus automatic interpretation; it becomes a confirmed operation only when supported by a confirmed rescue or emission report. Circling alone does not raise Activity unless it persists for at least 90 minutes.

## Authentication and data handling

v0.7 does not implement user authentication or a payment wall. Browser notification permission is not authentication. Settings, deduplication state and history are stored in `localStorage` and must not be treated as access control.

Credentials must never be placed in `index.html`, the service worker, imported files or `localStorage`. The dormant Worker placeholder has no upstream endpoint and always rejects maritime-data requests until a separately reviewed adapter is implemented.

## Limitations

Public ADS-B coverage is incomplete, aircraft classification is heuristic and external reports require corroboration. Imported maritime records are not made true merely by passing schema validation. Mockdata is synthetic. Infrastructure geometry is approximate analytical context and not suitable for navigation. NordicWatch is an analytical aid, not an authoritative intelligence source.

Copyright © 2026 Mats Pettersson / InionX. All rights reserved.
