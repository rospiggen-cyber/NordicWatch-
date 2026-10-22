# NordicWatch Cascade Lab v0.1 — optional synthetic concept demo

## Purpose
Demonstrate a deterministic analysis layer inside the existing NordicWatch PWA while keeping current situation intelligence, ADS-B, maritime collectors, event scoring, notifications and Cloudflare Workers unchanged.

Open from the main toolbar or the mobile Situations panel via Cascade Lab.

## The demonstration
1. Select Cyber: shared IT service or Industry: circulation-pump failure.
2. Inspect four separate perspectives: HAZOP deviation, FMEA failure mode, LOPA-inspired safeguards and possible cascade.
3. Toggle a protection measure; the corresponding dependency edge is considered blocked inside the synthetic graph.
4. Move a time slider to see assumed consequences that would be reached.
5. Compare baseline and mitigated number of modeled consequence nodes, not actual risk reduction, confidence or likelihood.

This is a bounded pure JavaScript graph model. All delays, links and safeguards are synthetic.

## Strict evidence and safety boundaries
- All nodes are labeled SYNTHETIC_MODEL. No real plant or university infrastructure is mapped.
- News about PHP vulnerabilities inspired the example; it does not validate the dependencies.
- No fetch, persistence, live signals, SituationScore changes, alarm suppression or OT control.
- Toggled safeguards are assumed perfectly effective in the illustration only. Formal LOPA requires documented independence and justified failure probabilities.
- This is not a substitute for HAZOP, FMEA, LOPA or a validated quantitative risk assessment.
- Actual dependency data, field measurements and operational authorization require separate controlled architecture.
- Generic demo source is exposed in the public frontend. Proprietary industrial models and collectors belong in the private backend after review.

## Validation
Run: node --test tests/cascade-lab.test.js

Check mobile and desktop appearance and PWA offline navigation after caching. The Lab loads independently from the main map.

## Not implemented
No source integration, import, permission model, secure asset inventory, data persistence, severity weighting, probabilities, effect verification, audit trail, customer isolation or operational decision support.