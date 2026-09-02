# NordicWatch v0.7

NordicWatch is a mobile-first Nordic–Baltic OSINT situational-awareness PWA.

## Current components

- Leaflet/OpenStreetMap map
- public military ADS-B feed through the NordicWatch proxy with a public fallback
- mission-role classification and local correlation alerts
- Nordic–Baltic GDELT security and defence reporting
- device-local flight and news history
- Morning Brief and Evening Brief generated from stored observations
- dormant Maritime Intelligence layer for verified AIS data, time-limited tracks and transparent behavioural indicators
- installable PWA and service-worker notification routing

## Daily Brief evidence labels

The brief deliberately separates:

- **Direct observation** — data returned by a connected live feed
- **Automatic assessment** — a local heuristic or baseline comparison
- **Confirmed external report** — a linked external publication

The AIS layer is implemented but inactive until a provider, licence, endpoint and retention policy pass the gate in [MARITIME.md](MARITIME.md). Without a configured verified Worker it reports “AIS not configured” and produces no maritime assessment. Live GNSS is not connected. Static hotspot and infrastructure scores provide analytical context only.

## Authentication and data handling

v0.7 does not yet implement user authentication or a payment wall. Browser notification permission is not authentication. Settings, deduplication state and brief history are stored in `localStorage` and must not be treated as access control.

API credentials must never be placed in `index.html`, the service worker or `localStorage`. The AIS Worker template requires `AIS_API_KEY` as a Cloudflare Worker Secret and remains disabled unless `AIS_ENABLED=1`. Future user credentials require server-side session validation, rate limiting and role checks.

## Limitations

Public ADS-B coverage is incomplete, aircraft classification is heuristic, external reports require corroboration, and device-local baselines are immature until sufficient snapshots have accumulated. NordicWatch is an analytical aid, not an authoritative intelligence source.

Copyright © 2026 Mats Pettersson / InionX. All rights reserved.
