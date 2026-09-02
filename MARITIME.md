# NordicWatch v0.7 — Maritime Signals

## Safety boundary

No AIS provider, upstream endpoint or external maritime API is connected. The layer operates on validated local datasets and explicit mockdata. Schema validity means only that a record is structurally usable; it does not confirm the underlying claim.

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

Future sources implement `MaritimeAdapter` from `maritime-core.js`:

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
