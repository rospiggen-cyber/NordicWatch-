# NordicWatch — Source Coverage Engine v1

## Intended Use

Show **which strategic-source coverage dimensions are observable and which remain unknown**, given configured official RSS sources, the health of those feeds, and normalized source-linked strategic signals. This provides decision support for what evidence or source class to investigate next. It does not determine that any event did or did not happen.

### What it does

- Consolidates source health **per original organization**. Two White House feeds are two technical feeds, not two independent publishers.
- For each configured feed, distinguishes responding, failing, and not configured. A provider with partial failure remains visibly degraded.
- Lists known-but-disconnected organizations in the source registry (currently e.g. NATO's legacy URL, U.S. Congress, Department of State).
- For each hypothesis, tracks specific **required evidence dimensions** and counts recent qualifying signals within 14 days.
- Uses distinct states: NOT_MONITORED, FEEDS_UNAVAILABLE, NO_MATCHING_EVIDENCE, SIGNALS_PRESENT. A functioning feed with no qualifying article is not treated as an unavailable feed or as evidence of no actual event.
- Preserves provenance indicators and independent-source group counts, while refusing to infer causal conclusions or military threats.
- Publishes the coverage summary as sourceCoverage alongside the existing /strategic analysis data. The read-only mobile page visualizes missing dimensions and provider status. No changes to the military map, its EventScore, push alerts or notification thresholds.

## Evidence requirements by hypothesis

US_DOMESTIC_POLICY
1. US_DOMESTIC — domestic political/economic developments; independent domestic measures or congressional data
2. US_POLICY — original US foreign-policy decisions

US_POLICY_NORDIC_SECURITY
1. US_POLICY — original US foreign-policy decisions
2. NORDIC_SECURITY — Nordic–Baltic regional ALLIANCE/SECURITY evidence from an applicable institution, explicitly linked to the region.

All dimensions may be individually observed without producing any supported cross-domain link. Source Coverage is not a substitute for the separate thematic/time analysis; a "SIGNALS_PRESENT" state is **not** an analyst conclusion.

## Source availability vs evidence

- NOT_MONITORED: no feed configured for this category
- FEEDS_UNAVAILABLE: configured sources returned no usable response during the last run
- NO_MATCHING_EVIDENCE: at least one feed responded, no qualifying recent signal
- SIGNALS_PRESENT: one or more qualifying recent signals (14-day period); this remains evidence to investigate, not corroboration
- PARTIAL_FAILURE: provider-level status when only some configured feeds answered
- RELEVANT / NO_RECENT_RELEVANT: provider has or has not supplied a qualifying relevant signal in the historical 14-day context

Note: RSS article publication time is currently used as the event-time proxy when no verified occurrence date exists. This is not the same as when a real-world development occurred. The real-world completeness of official publications is unknown.

## Tests

Run:

    node --check source-coverage-engine.js
    node --test tests/source-coverage-engine.test.js tests/strategic-source-collector.test.mjs
    node --test tests/*.test.js tests/*.test.mjs

Tests cover provider deduplication, incomplete hypotheses despite healthy technical feeds, disconnected sources, feed failure, partial outages, irrelevant/old/untrusted records, and no inference from empty results. CI checks the full regressions.

## Validation trace

- IU-COV-01 Separate feed availability from evidence sufficiency → SRC-COV-001, 002, 003 → tests for no domestic data despite 3/3 working feeds.
- IU-COV-02 Distinguish disconnected/failed/empty feeds → SRC-COV-004 → unavailable vs not configured vs no matching cases.
- IU-COV-03 Preserve source independence → SRC-COV-005 → two White House feeds count as one organization.
- IU-COV-04 No causal/threat/election claim → SRC-COV-006 → only completeness, provenance and missing evidence fields.
- IU-COV-05 Deployment remains nonintrusive → SRC-COV-007 → separate Worker KV result and read-only UI, existing military score unchanged.

## Next phases (not in v1)

- Independent sources for economic and congressional signals, and Nordic national defence authorities once authenticated current feeds are available.
- Source reliability history, last successful poll, feed parser health, alternative official-document adapters, original-source event dates and confidence per evidence dimension.
- Human-assessed relevance and hypothesis-specific controlled vocabularies, rather than depending on simple shared keywords.
- A baseline period for each source with explicit outage detection. Never claim "no developments" simply because a provider had no relevant publications.

**Rollout:** changes via PR, check tests and public health before treating a production run as verified.
