# AIS provider review — 2026-09-02

## Decision

**Recommended non-production pilot: BarentsWatch.**

**Full Nordic–Baltic production provider: not selected.** BarentsWatch cannot provide the geographic coverage NordicWatch needs in the Baltic Sea. A commercial provider must confirm coverage and contract rights in writing before activation.

## BarentsWatch — verified from official sources

| Requirement | Finding | Status |
|---|---|---|
| Commercial use | Terms state API content may be used commercially under NLOD when guidelines are followed | Suitable for pilot |
| Redistribution/display | Permitted with required credit to BarentsWatch and the data owner | Suitable with attribution |
| Authentication | Registered AIS client; OAuth2/OpenID Connect client-credentials; one-hour bearer token | Worker adapter implemented |
| Live positions | Streaming endpoints and latest-position endpoint documented | Technically suitable |
| Tracks/history | Track endpoint documented; data limited to latest 14 days | Limited |
| Coverage | Norwegian economic zone, Svalbard fisheries protection zone and Jan Mayen protection zone | Insufficient for Baltic |
| Source mix | Norwegian terrestrial stations, Equinor offshore stations and Norwegian satellites | Documented |
| Vessel exclusions | Fishing vessels below 15 m; leisure/sailing vessels below 45 m | Material limitation |
| Price | API described as open and free after self-registration | Suitable for pilot |
| Attribution | “Data delivered by BarentsWatch”; underlying AIS owner is the Norwegian Coastal Administration | Mandatory |
| High traffic | Provider asks users to contact them before high-traffic use; fees may apply | Production blocker |

Official sources:

- https://www.barentswatch.no/en/articles/api-terms-and-conditions/
- https://developer.barentswatch.no/docs/appreg/
- https://developer.barentswatch.no/docs/AIS/live-ais-api/
- https://developer.barentswatch.no/docs/AIS/examples/
- https://www.barentswatch.no/en/articles/open-data-via-barentswatch/

## Implemented adapter

The dormant Worker now supports `AIS_PROVIDER=barentswatch`.

Required Cloudflare Secrets:

- `AIS_CLIENT_ID`
- `AIS_CLIENT_SECRET`

Required non-secret variables:

- `AIS_PROVIDER=barentswatch`
- `AIS_ENABLED=1`
- `APP_ORIGIN=<exact non-production NordicWatch origin>`

The Worker obtains and caches a short-lived bearer token, calls the documented latest-position endpoint, normalises the BarentsWatch camelCase fields, filters the NordicWatch bounding box, and returns mandatory source attribution. Neither client secret nor bearer token is returned to the browser.

This adapter remains source code only. It has not been deployed, registered or connected.

## Baltic candidates requiring written commercial confirmation

The following vendors publicly advertise real-time AIS products, but public marketing pages are not enough to approve redistribution, derivative risk scoring, alerting, storage or a paid NordicWatch service:

- VesselFinder real-time AIS API
- MarineTraffic/Kpler maritime data services
- Spire Maritime AIS
- Datalastic
- VT Explorer

For each candidate obtain a written answer covering:

1. Terrestrial and satellite coverage for the full Nordic–Baltic bounding box.
2. Right to show vessel positions and tracks to beta and paying users.
3. Right to create and display derived anomaly/risk scores and alerts.
4. Maximum client-side, Worker-cache and server-side retention.
5. Whether MMSI, vessel name and historical routes may be stored.
6. Attribution requirements and restrictions on screenshots/X posts.
7. Request/stream limits, latency, SLA and outage behaviour.
8. Monthly price at pilot, 100-user and 1,000-user volume.
9. GDPR roles, subprocessors and data-processing geography.
10. Termination requirements and deletion/export obligations.

## Production gate

Do not set `NORDICWATCH_AIS_PROXY` on the production app, deploy the Worker, create provider credentials or accept a paid contract until the full Baltic provider answers above have been reviewed. BarentsWatch may be used only in an isolated non-production pilot after account registration, attribution and contact-purpose details are completed.
