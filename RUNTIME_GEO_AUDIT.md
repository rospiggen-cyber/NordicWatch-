# Runtime geographic matching investigation

## Evidence and actual cause

The current public `/news` capture on 8 September contains 32 records, not 26. The first 26 correspond to the earlier captured set. Real records were evaluated before any correction or synthetic tests. An isolated browser then ran these exact responses through the actual app normalizer and storage code: before correction, raw PASS=0 and normalized PASS=0; after correction, both equal 1.

The rejected real record is **U.S. Soldiers demonstrate resiliency during Exercise Masurian Patrol in Poland**, DVIDS, https://www.dvidshub.net/news/574025/us-soldiers-demonstrate-resiliency-during-exercise-masurian-patrol-poland . Its summary identifies Bemowo Piskie Training Area and the Masurian region in Poland.

In `news-routing.js`, the `regions` table lacked Masurian Patrol, Bemowo Piskie and Masuria. Poland alone was intentionally not a whole-country AOI alias. `matchedRegions` was therefore empty; `matchedTopics` contained MILITARY_EXERCISE. The exact rejecting condition was `const relevant=matchedRegions.length>0&&matchedTopics.length>0`. The score is computed AFTER that boolean and was zero as a consequence, not a threshold rejection.

Small correction: one Northeastern Poland entry for `masurian patrol|bemowo piskie|masuria`. No generic Poland admission, matcher rewrite, freshness changes or ranking changes.

## Answers to the ten runtime questions

1. The news records have title, summary, url, publishedAt, sourceId, sourceName, signalId, ingestedAt, lastUpdatedAt, eventTime, expiresAt, freshness, timeStatus, confidence and eventId. The current capture has no explicit location, tags or entities on these records. Per-record fields/types are in the diagnostics.
2. The matcher inspects title, description, summary, areaName, region, location, destination, origin, route, entities, participants and locations. It does not separately inspect `countries`, tags, source publisher geography or `risk.places`.
3. Yes: title, description AND summary are included in its normalized text.
4. Yes: fetched records run through normalizeArticle; stored records then run through NR.normalize and normalizeArticle before NR.route. The direct diagnostic also tests the raw shape separately.
5. The alias table is loaded and executes. Its contents lacked this particular named regional node. This is an alias-data gap, not failed module loading.
6. For the real DVIDS record, title and summary are strings. Raw description, geography fields, tags and entities are undefined. Description becomes a string during normalization. Missing entities/participants/locations are stringified as empty arrays in matcher text.
7. No information loss explains this record: normalizeArticle copies summary to description (up to 500 characters), and IC.signal's object spread preserves the original summary. Its actual summary is 498 characters. The browser before/after trace contains both versions, including Poland, Masurian Patrol and Bemowo Piskie.
8. No: `relevant` is consistently read by the router and the final selection callback. There is no geographicRelevant/property-name mismatch. The displayed geographic counter is measured on the routed store, so time-window exclusions can still cause zero later in the pipeline.
9. No score threshold rejects it. Empty matchedRegions fails the boolean; relevanceScore is assigned afterward. Geographic score in diagnostics is the existing combined relevanceScore, not a new independent scoring model.
10. Yes, the schemas differ, but the adapter handles this record correctly. Raw news uses summary/url; Event Engine records use description/sourceUrl/areaName/countries/etc. This difference did not erase the matching text. No NAMEJS exists in the real captured news or live `/events` response. The browser's single NAMEJS event comes from the bundled seed, not the fetched news; it cannot substantiate news pipeline coverage.

## End-to-end trace and counts

Real title → lowercased title plus full summary → diagnostic country `poland`, places `masurian`, `bemowo piskie` → previously zero AOI aliases → false. With the minimal alias entry: `masurian patrol` and `bemowo piskie` match Northeastern Poland; military exercise topic matches; relevanceScore=70; relevant=true. Diagnostic extraction was added for inspection; the original matcher had no standalone country extraction stage.

Replay of the original 26 real records at **2026-09-07T19:37:14.803Z**:

- Before: 26 fetched → 26 fresh → 0 relevant.
- After: 26 fetched → 26 fresh → 1 relevant → 1 event.
- Only Masurian Patrol passes, because the real summary identifies the named northeastern Polish node and the title identifies a military exercise. All other 25 records remain excluded.

Current capture at **2026-09-08T07:42:14.060Z**: 32 fetched, 22 fresh, 10 stale. Masurian Patrol still matches geographically but is now older than 72h. Thus the current time-sensitive selection remains zero. The historical replay result must not be presented as today's live selected count. Freshness was not altered to force inclusion.

## Developer diagnostics and validation

`window.nordicWatchGeoDiagnostics` contains every fetched record's raw and browser-normalized trace: source, full text, raw geography/tags/entities, field types, actual normalized matcher text, diagnostic country/place extraction, AOI aliases, score, PASS/FAIL and exact rejection reason.

Local full evidence: `.wrangler/geo-live-sample.json`, `.wrangler/geo-browser-before.json`, `.wrangler/geo-browser-after.json`, `.wrangler/geo-after-summary.json`. These are developer captures, not shipped news. Regression fixture `tests/fixtures/masurian-patrol-real.json` preserves the real record shape.

80 regression tests passed, plus real-data browser before/after traces and desktop/Android-emulated UI regressions. No UI, EventScore, aircraft, hotspot, freshness or push logic changed. No version increment, commit or deployment performed for this repair.

