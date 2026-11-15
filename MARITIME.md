# NordicWatch v0.7 — Maritime Signals

## Safety boundary

The layer supports validated local datasets, explicit mockdata and an **opt-in Fintraffic AIS pilot** through an isolated Cloudflare Worker. There is no MarineTraffic/Kpler data. Source coverage and ship identity are incomplete; a valid record does not establish the underlying claim, hostile intent, or even a verified physical location.

The pilot is only active after pressing **Sync Fintraffic AIS**. After the first successful request it polls every 10 minutes while the page stays open. A failed fetch preserves earlier observations, shows an explicit error and does not imply vessels have disappeared. Raw Fintraffic AIS observations cannot trigger push notifications or strategic Scan Cards by themselves.

The fixed pilot area is 58.5–61.5°N, 19–31°E (Gulf of Finland), with up to 300 freshest unique vessel positions per sync. This intentionally **does not represent full Baltic maritime coverage**. Future broader coverage and baselines require testing of volume, rate limits, freshness and false positives.

### Provider, licence and deployment

- Provider: Fintraffic / Digitraffic, https://www.digitraffic.fi/en/marine-traffic/
- Licence: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), including commercial reuse with attribution and indication of modifications.
- Data: `https://meri.digitraffic.fi/api/ais/v1/locations` (GeoJSON, `properties.timestampExternal` in epoch milliseconds) and `/api/ais/v1/vessels` (metadata array). Fintraffic requires gzip support; the Worker requests gzip.
- Gateway: `cloudflare/maritime-worker.js` serves only `/fintraffic/ais` and `/health`, with fixed upstream URLs, 12-second upstream timeouts and 3 MiB response limits. It never accepts arbitrary target URLs or credentials.
- Public hostname after authorized deployment: `https://nordicwatch-maritime.rospiggen.workers.dev/fintraffic/ais`. The GitHub Actions deployment uses the existing `CLOUDFLARE_API_TOKEN` secret and account ID; it does not change the ADS-B, event-feed or infrastructure Workers.
- UI: `fintraffic-ais.js` normalizes observations, validates timestamps and pilot bounds, joins optional metadata by MMSI and submits every record to `maritime-core.js` validation.
- Attribution displayed in the layer panel and record details: **Source: Fintraffic / digitraffic.fi, CC BY 4.0; processed by NordicWatch.**
- History: latest four position reports per vessel are retained for at most six hours, capped at 1,200 live reports in the existing device-local store. The absence of an AIS message can be a receiver gap and is not automatically labelled a switched-off transponder.

To verify after deployment: visit `/health`, press **Sync Fintraffic AIS** in NordicWatch, check the source timestamp and the pilot-coverage disclaimer, then verify `/fintraffic/ais` shows valid GeoJSON and the app quarantines malformed observations without rendering them.

## Internal record model

All accepted records use schema version 0.7 and contain:

- `id`, `type`, `timestamp`, optional `end`
- `lat`, `lon` inside the NordicWatch geographic boundary
- evidence class: `observation`, `indicator` or `confirmed`
- title, description, tags and optional HTTPS source link
- optional MMSI, speed, course and status
- source name, publisher, licence, retrieval time, allowed use and quality
- import timestamp and original record index

Supported types:

- `vessel_position`
- `maritime_event`
- `navigation_warning`
- `restriction`
- `authority_notice`
- `manual_event`

## Secure import

Supported formats are CSV, JSON arrays/objects and GeoJSON FeatureCollections containing Point features.

Controls:

- 2 MiB maximum file size
- 10,000 record maximum
- strict supported-type and evidence enums
- numeric coordinate, speed and course validation
- NordicWatch coordinate bounds
- nine-digit MMSI validation when supplied
- HTTPS-only links
- control-character removal and text-length caps
- provenance and permitted-use fields required
- duplicate key: type + id + timestamp
- rejected records stored only as file name, index and error list in quarantine
- imported text rendered through text nodes or escaping

## Correlation and risk

Distance and time windows are configurable in the layer panel. Each maritime record may correlate with hotspots, current aircraft, GNSS context, current news and other maritime records.

Risk is transparent:

| Component | Maximum |
|---|---:|
| Geography/proximity | 30 |
| Temporal relationship | 20 |
| Independent sources | 20 |
| Source quality | 20 |
| Freshness | 10 |

A score is an indicator, not proof of intent, attribution, sabotage or hostile activity. Independent sources are counted by declared source identity; this is not a guarantee that the sources are genuinely independent.

## Map context

The map contains approximate analytical representations of selected cables, pipelines, ports, fairways and watch zones. These geometries are contextual placeholders and must not be used for navigation, engineering, asset protection or precise distance claims.

## Adapter interface

Additional sources implement `MaritimeAdapter` from `maritime-core.js`:

```js
class ApprovedAdapter extends NordicWatchMaritime.MaritimeAdapter {
  constructor() { super("approved-source-id"); }
  async load() {
    // Fetch through a reviewed backend. Never expose credentials here.
    return rawRecords;
  }
}
```

Adapter output is not rendered directly. It must pass through `importDataset` or `normalizeRecord`, including provenance and licence validation, before merging with the application store.

Before implementation, verify:

1. exact provider and endpoint;
2. redistribution/display rights;
3. right to create derivative indicators and alerts;
4. retention and deletion limits;
5. commercial/beta-user rights;
6. attribution;
7. rate limits and cost ceiling;
8. GDPR roles and processing geography.

## Mockdata and tests

`mock/maritime-signals.json` contains synthetic warnings, restrictions and observations marked “Mock/test only”. It loads only when the user presses **Load mockdata**.

Run locally:

```bash
node tests/maritime-core.test.js
```

The test suite covers CSV quoting, JSON, GeoJSON, coordinate boundaries, file-size rejection, required licence metadata, duplicates, quarantine, correlation, transparent score components, adapter loading and unsafe-link rejection.

## Future public notices

Navigation warnings, restrictions and authority notices may be added only after their specific source terms permit the intended display, storage, derived analysis and alerting. A public webpage is not automatically an open data licence.
