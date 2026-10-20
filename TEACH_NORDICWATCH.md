# Teach NordicWatch v0.1 — local reviewed news examples

**Status:** Functional first-stage prototype. This is a review/teaching interface, **not** autonomous AI training or self-modifying production code.  
**Introduced:** October 19, 2026.  
**Private design:** [NW-TEACH-001](https://github.com/rospiggen-cyber/NordicWatch-Private/blob/main/docs/08_TEACH_NORDICWATCH_DESIGN.md) (requires private repository access).

## Intended Use

Give the operator a way to preserve approved or rejected real-world news examples and corrections as a **traceable, exportable test corpus**, so that missed-source, geographic and relevance problems can be fixed through reviewed code changes and regression tests.

## How to use

1. Open **Situations · news · hotspots** on the mobile PWA.
2. Under **Developing situations**, select **Teach NordicWatch · News URL** (separate from **Import observations**, which still accepts situation JSON).
3. Paste a **public HTTPS article link**. If that precise URL is already in the device's `NORDICWATCH_SIGNAL_ARCHIVE`, **Analyze relevance** can prefill a previously collected title, excerpt and publication date. Otherwise enter those manually: the first stage does **not** crawl unknown websites or bypass paywalls.
4. **Analyze relevance** applies the production relevance evaluator read-only and displays regional/topic matches and the current *suggested* class. You may disagree and select your own relevance label: Nordic/Baltic, strategic spillover, not relevant or needs review.
   - URL path words (for example `kaliningrad` in a news URL) can now appear as **unverified review hints**. They are not fetched article data and cannot establish relevance on their own. A URL-only/high-level headline case is `NEEDS_REVIEW` until the operator supplies sourced geographic and security details. `Gvardeysk` and OTH/radar/sensor infrastructure are recognized in the regular relevance rules when explicitly present in a headline or description.
5. Select whether the news documents a **new development**, **an older event** or **unknown**. Separate article publication date and event date. Both are operator-provided, date-only fields unless already matched from the local feed.
6. Add a meaningful reasoning note, and choose **Approve as test example**, **Reject example** or **Save for later review**.
7. Select **Save teaching example**. The entry lives **only in this browser/device** in its local storage. A correction to the same canonical URL appends a new numbered revision with timestamp, rationale and previous versions retained.
8. **Export approved examples (JSON)** exports only entries whose current decision is APPROVED_FOR_TESTING, with the full local review history. Review the export before copying it to the **private** GitHub repository. No automatic GitHub upload or rule change occurs.

## Distinguishing learning from truth

- **Relevance label** answers whether a report should appear in the NordicWatch review stream, **not** whether its assertions have been verified.
- Every Teach example is tagged `UNVERIFIED_BY_TEACH` and `ruleImpact: NONE`. It cannot update the EventScore engine, source trust rules, event history, risk labels or push threshold.
- Source date and event date are separate. For a date-only input, `publicationDateStatus` / `eventDateStatus` preserve `DAY_ONLY` rather than falsely claiming exact event seconds.
- Metadata origin is `MANUAL` unless a known locally collected article was matched and its prefilled fields remain unchanged. A manual title or summary is never passed off as automatically fetched.
- URL validation accepts only HTTPS links on public-looking hosts. The browser **does not issue cross-origin article fetches**. This removes arbitrary-URL retrieval/SSRF from this first phase.
- Browser storage is neither encrypted nor a tamper-proof audit log; clearing app storage may delete these examples. Export frequently, handle the file as private feedback data and avoid sensitive or copied full article texts.

## Data model and controls

Module `teach-nordicwatch.js` exports:
- `url()` canonicalizes source URL, strips tracking parameters and rejects private endpoints.
- `localMatch()` finds articles already seen by NordicWatch.
- `suggestion()` calls the existing `news-routing.js` evaluator without altering rules.
- `submit()` validates labels, source metadata and rationale; keeps append-only revision history inside the local record.
- `read()` / `write()` store at most 250 unique URL examples in `NORDICWATCH_TEACH_EXAMPLES_V1` (100 revisions/URL), with explicit error if storage is unavailable.
- `exportReviewed()` creates a JSON document of current approved examples. The app uses browser download and makes no server-side write request.

UI wiring is in `teach-ui.js`. Both modules are included in the PWA's `sw.js` offline shell. No Cloudflare Worker write endpoint exists.

## Acceptance test outline

`node --test tests/teach-nordicwatch.test.js`

Positive cases: known DN article, historical event date preserved, official relevance suggestions, corrected revisions retained. Negative cases: food festival in Sundsvall, invalid/local URLs, rejected/pending examples excluded from approved export, false confidence elevation prohibited, corrupted browser storage, invalid date/decision, no silent rule modification.

## Known limitations and next step

- No automatic parsing of unknown websites or paywalled DN articles; a source not yet ingested requires operator-provided metadata.
- Local-only data are not shared, backed up or validated as authoritative. The exported file still requires independent human review before entering the private approved-gold-test repo.
- FNV-derived local example IDs are collision-resistant only at a practical convenience level, **not cryptographically unique IDs**; canonical URL remains the local deduplication identity.
- The relevance engine uses current hard-coded regional and topic rules. Many real missed cases arise in **source discovery**, and Teach can only flag these for human diagnosis, not solve them automatically.
- A second phase should add rule-delta previews, held-out negative controls, CI-linked proposals and reviewable GitHub PR generation. Multi-user writes or server-side URL fetching require separately reviewed authentication, authorization, SSRF handling, legal/licence controls and retention design.

**Product quality gate:** Being able to label a news story does not in itself establish operational completeness or independent factual confirmation.
