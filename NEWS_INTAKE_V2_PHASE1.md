# NordicWatch — News Intake v2, Phase 1 (staging proposal)

Date: 2026-11-22. Scope: **no production deployment**, no UI, notification,
event score, data retention, secret or Cloudflare configuration changes.

## Problem and intended use

The 2026 Nordic/Baltic map pipeline has deliberately narrow sources and an AOI
relevance gate. It cannot serve a global military-news audience without
separating **global discovery** from **regional event/risk publication**.
The six existing default external RSS URLs cover four publishers. An official
source being allowlisted does not mean it has a configured or working feed.

Phase 1 adds only two **candidate** publisher RSS sources to the normal
external collector:

- Defense One: `https://www.defenseone.com/rss/all/`
- The War Zone: `https://www.twz.com/feed` (old `thedrive.com/the-war-zone/feed` returned HTTP 301 to this URL)

They remain in the `REPUTABLE_DEFENCE_PUBLICATION` tier, **not official or
independently confirmed evidence**. RSS discovery must never be described as
verified military movement. Publisher URLs and summaries are not a licence to
republish full commercial articles. Obtain a commercial-use review before
launching paid features. Cloudflare user-operated staging smoke test (2026-11-23 08:17Z) returned HTTP 200 for Defense One (23 RSS items, 23 date fields) and The War Zone at twz.com (34 RSS items, 34 date fields). These are **tag counts**, not validated article quality, recency, or downstream parser ingest. Production collector acceptance, per-item URL host, licensing, AOI effects and >24-hour observation remain pending.

## Safe acceptance gates

1. Run `node --test tests/news-gap-audit.test.mjs` and the normal regression
   suite. The PR should remain unmerged until CI passes.
2. Verify the new RSS feeds from the intended Cloudflare staging runtime:
   response status, redirects, body size, parseable item count, timestamps,
   downstream article URL host, and rate limits. A third-party RSS directory
   listing does not verify Cloudflare reachability.
3. Review licensing, robots and use terms before any subscription product.
   Persist only necessary headlines, brief extracts, canonical URLs,
   provenance and timestamps. Never redistribute full paywalled content.
4. Use a **separate staging Worker and staging KV**. Collect for at least
   24 hours. No changes to production KV, push or alert configuration.
5. Compare pre/post source health and dated unique story yield. Reject
   articles with missing or unreliable provenance; inspect false positives.
6. Re-run existing map, alert, news freshness, deduplication, event lifecycle
   and Android/mobile smoke tests. Only then consider production approval.

## Offline missed-news audit

`tools/news-gap-audit.mjs` compares a curated set of articles that were
**actually published** with a collection snapshot. It uses the same
`news-routing.js` relevance and 72-hour window behavior as the app.

Create `audit-input.json` (no sensitive data or API credentials):

```json
{
  "capturedAt": "2026-11-22T12:00:00Z",
  "captureComplete": false,
  "expected": [
    {
      "id": "manual-001",
      "title": "Swedish Navy holds exercise near Gotland",
      "url": "https://example.com/article",
      "sourceId": "REPUTABLE_DEFENCE_PUBLICATION"
    }
  ],
  "collected": [],
  "sourceHealth": []
}
```

Run `node tools/news-gap-audit.mjs audit-input.json`. Input comes from
operator-supplied JSON exports; the tool makes **no network requests**.

Findings distinguish BRIEF_ELIGIBLE, RELEVANCE_FILTERED,
OUTSIDE_BRIEF_WINDOW, OTHER_ROUTING_EXCLUSION and
NOT_OBSERVED_IN_CAPTURE. The last category is **not** automatically
"source failure": a partial archive or time-window can create a false miss.
A 100% observation rate requires caller-declared capture completeness, and
even then establishes coverage of that snapshot only, not the entire news
ecosystem. Syndicated stories are not automatically counted as independent
sources.

## Next phase — separate news product from AOI alerts

- Build a first-party source registry with per-source parser, last success,
  time-to-first-seen, original publisher, licence and failure modes.
- Add and verify national official-source adapters (particularly NATO and
  Nordic/Baltic defence press rooms). The legacy NATO RSS endpoint should
  not be assumed healthy.
- Capture 30–50 reference incidents across geographic/thematic categories:
  Ukraine, Baltics, High North, NATO, air, maritime, unmanned systems and
  defence industry. Each has source URL and **publication timestamp**.
- Compute discovery recall, median/P95 latency, duplicates, source outages,
  filtered relevant articles and false-positive rates per category.
- Create a separate **global military news** route before broadening the
  public Baltic map. Global relevance must not change operational AOI alerts,
  inferred geolocations or SituationScore thresholds.
- Release an opt-in consumer briefing only after provenance and copyright
  gates are satisfied.

This branch is a controlled candidate, **not a claim that coverage has
already improved in production**.
