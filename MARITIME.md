# NordicWatch v0.7 — Maritime Intelligence verification gate

The maritime feature is implemented but intentionally inactive. It must not be connected to production until every item below is recorded and approved.

## Required provider verification

- [ ] Legal AIS provider and exact product selected
- [ ] Licence permits display inside NordicWatch
- [ ] Licence permits derived risk indicators and alerts
- [ ] Licence permits the intended beta/commercial user group
- [ ] Geographic coverage, latency, update rate and terrestrial/satellite mix documented
- [ ] Endpoint and authentication method verified against current provider documentation
- [ ] Rate limits, outage behaviour and cost ceiling documented
- [ ] Retention, caching, redistribution and deletion rules documented
- [ ] MMSI/vessel-name privacy and applicable GDPR assessment completed
- [ ] Attribution and user-facing disclaimer requirements implemented
- [ ] Cloudflare/data-processing geography accepted
- [ ] Test account and non-production endpoint used first

## Architecture

Browser → NordicWatch Cloudflare Worker → licensed AIS provider.

The browser never receives the provider credential. The Worker requires:

- `AIS_API_KEY` — Cloudflare Worker Secret, never committed
- `AIS_ENABLED=1` — activation gate
- `AIS_PROVIDER_URL` — verified HTTPS endpoint
- `APP_ORIGIN` — exact allowed NordicWatch origin
- optional `AIS_AUTH_HEADER`, `AIS_AUTH_PREFIX`, `AIS_BBOX_PARAMETER`

The supplied Worker template performs origin checking, bounding-box validation, basic rate limiting, timeouts, response minimisation and canonical field mapping. It reports that it retains no data. Cloudflare logs, cache configuration and the provider's own retention remain separate items requiring verification.

## Frontend activation

Do not configure this until the gate above is complete. After a verified Worker is deployed, set the exact HTTPS `/ais` URL in:

`localStorage.NORDICWATCH_AIS_PROXY`

Removing that key immediately returns the UI to “AIS not configured”. This is a deployment switch, not authentication.

## Canonical Worker response

```json
{
  "vessels": [{
    "mmsi": "123456789",
    "name": "Example",
    "lat": 59.1,
    "lon": 19.2,
    "sog": 10.4,
    "cog": 215,
    "heading": 212,
    "type": "cargo",
    "timestamp": 1788336000000,
    "quality": "provider-reported"
  }]
}
```

## Transparent indicators

The client can produce:

- course change ≥45°
- speed change ≥5 knots
- low speed below 0.5 knots for at least one hour
- revisit within 2 km after at least one hour
- broad route-deviation indicator from recent course history
- reporting gap longer than 30 minutes
- proximity to an approximate cable or pipeline corridor

Risk is displayed as the sum of proximity, behaviour, duration and data-quality points. Poor freshness lowers the data-quality contribution and confidence. A score is an indicator, never proof of intent, attribution, sabotage or hostile activity.

## Limitations

AIS is self-reported and may be absent, delayed, incorrect, spoofed or deliberately disabled. Military and state vessels may not transmit. Coverage varies by receiver network and subscription. MMSI, name, vessel type and position require corroboration. Infrastructure geometries in the frontend are approximate analytical corridors and are not navigational or authoritative asset data.

## Local test plan

1. Keep `NORDICWATCH_AIS_PROXY` unset and confirm “AIS not configured”.
2. Run the Worker locally with a mock upstream and a non-production key.
3. Confirm requests from a non-allowed Origin receive HTTP 403.
4. Confirm missing `AIS_ENABLED=1` or missing Secret receives HTTP 503.
5. Confirm invalid or excessive bounding boxes receive HTTP 400.
6. Feed canonical fixtures for normal transit, sharp course change, speed change, stop, revisit and stale timestamp.
7. Verify risk-component arithmetic, confidence, tracks and deduplicated alerts.
8. Confirm the provider key never appears in HTML, service worker, response body, logs or browser storage.
9. Confirm existing aircraft, news, briefs, hotspots, alerts and offline shell still work.
