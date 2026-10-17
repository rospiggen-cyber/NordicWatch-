# NordicWatch — Strategic Early Warning v0.1

**Status:** isolated prototype; not wired into the production map, alerts, Worker or Daily Brief.

## Goal

Analyse **observable, documented strategic signals**, not political personalities or election outcomes. Example analytical questions:

1. Are developments in US domestic politics temporally and thematically associated with changes in US external policy?
2. Are documented US policy changes associated with independently reported Nordic–Baltic security developments?

The engine produces review priorities (INSUFFICIENT_EVIDENCE, WATCH, REVIEW, HISTORICAL_CONTEXT), **not** threat probabilities, election forecasts, psychological assessments or causal conclusions. An analyst must evaluate competing hypotheses.

## Current implementation

- strategic-early-warning.js — pure, browser-compatible UMD / Node module without network access, state persistence, UI modification or side effects.
- tests/strategic-early-warning.test.js — reproducible checks for independence, HTTPS provenance, synthetic and social input, contradictions, event-time freshness and geographic relevance.
- .github/workflows/strategic-early-warning.yml — Node test runner for this isolated slice.

Run:

    node --test tests/strategic-early-warning.test.js

The module exports normalizeSignal, deduplicate, analyze and MODELS.

## Input model

A trusted ingestion adapter must supply a JSON array of signals (no untrusted markup). Example structure **only, not a real event**:

    {
      "id": "example-1",
      "eventKey": "an-actual-development-id",
      "title": "Example policy statement",
      "description": "What the primary source actually says",
      "domain": "POLICY",
      "actor": "US",
      "eventTime": "2026-10-17T18:00:00Z",
      "publishedAt": "2026-10-17T18:30:00Z",
      "topics": ["UKRAINE_SUPPORT"],
      "region": "",
      "stance": "SUPPORT",
      "evidence": "OFFICIAL_RECORD",
      "source": {
        "url": "https://example.org/primary-document",
        "publisher": "Named original publisher",
        "independenceGroup": "ORIGINAL_PUBLISHER",
        "type": "OFFICIAL"
      }
    }

Domains: DOMESTIC, POLICY, ALLIANCE, SECURITY, ECONOMY.

Evidence: OFFICIAL_RECORD, DIRECT_MEASUREMENT, REPORTED, UNVERIFIED.

Sources with type SOCIAL are informational leads only, regardless of claimed evidence. Synthetic signals are excluded from conclusions. COUNTER marks a *manually or independently verified* challenge to a proposed pattern. It must not be inferred from keywords or sentiment alone.

Do **not** infer that two news outlets equal two independent sources. Wire services and syndicated repetitions share an independenceGroup. Publisher identity, source category, original document and dates **must be checked upstream**; fields in untrusted JSON are not authentication. HTTPS validates URL form, not truth.

## Correlation rules

- A review hypothesis requires a pair of relevant domains, an explicit **shared topic**, and event times within 14 days.
- The regional hypothesis requires evidence in NORDIC_BALTIC from an ALLIANCE or SECURITY signal.
- REVIEW additionally needs a pair with real-world event time within 72 hours, at least two independent source groups, an official primary-source document and no unresolved counterevidence.
- WATCH means an interesting, incomplete pair. It is **not** a warning about an imminent threat.
- Historical evidence remains context; republishing or polling does not make the underlying event new.
- Every card preserves support, counterevidence, source URLs, evidence labels, links and unmet evidence requirements.
- Neither the map's military EventScore nor its escalation state is modified.

## Next stage before production

1. Add an **isolated strategic collector** in the Cloudflare Worker or another controlled server-side pipeline, not in the public browser. Start with official White House, State Department, US Congress, NATO, EU/European Council and Nordic defence sources. Approve exact endpoints and licenses per source.
2. Verify publisher/domain and official claims server-side, distinguish event occurrence from publication and update times, attach immutable source snapshots or source hashes, and rate-limit ingestion.
3. Retain historical series for baseline deviation, editorial updates and independent reporting provenance. Protect against repeated/social/bot/manipulated material.
4. Map existing normalized EVENT/NEWS records into strategic signals **without promoting inferred or recycled content**. Existing Event Engine states (OBSERVED, CONFIRMED, INFERRED) must remain separate.
5. Add a compact **Strategic Review** panel with evidence links, contradictions, provenance and a clear disclaimer, then field-test with real case histories and human review.
6. Only after passing historical regression tests and source health checks consider Daily Brief context or user alerts, with manual approval of escalation criteria.

**Deployment decision:** This prototype is proposed via a draft PR and is not automatically merged or published to GitHub Pages.
