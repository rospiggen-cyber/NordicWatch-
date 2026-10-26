# NordicWatch Validation Lab

## Purpose
A deterministic, isolated regression lab for the NordicWatch relevance, temporal evidence and hotspot coverage rules. Run `node --test tests/validation-lab.test.js` or open `validation-lab.html`.

**Validation test cases are synthetic fixtures**, not direct proof that a news incident occurred. Real-world confirmation must always be sourced from official primary reporting or independent corroboration.

## Reference scenarios
| ID | Scenario | Expected behavior |
|---|---|---|
| LV-UAS-REOPEN | Latvian recovered UAV days after initial observation | Report remains operational and could reopen a previously inconclusive incident when tied to physical evidence |
| LT-BALLOON-AIRPORT | Balloons/slow objects affecting Lithuanian airport | Relevant airspace-security incident; no automatic state attribution |
| LV-BORDER-SABOTAGE | Latvian border infrastructure damaged | Relevant hybrid/infrastructure report, attribution separate |
| LT-DECLARED-EXERCISE | Publicly announced military exercise | Eligible exercise context, not proof of escalation |
| NEWS-SPORT | NATO ceremonial sporting activity | Excluded from threat-news ranking |
| NEWS-MEDICAL | Civilian medical helicopter fuel facility | Excluded without a defence incident |
| NEWS-EDITORIAL | US naval article referring to Finnish industrial know-how | Excluded without a regional operational development |
| TIME-STALE | 72-hour-old article with unknown event time | Discounted temporal relevance |
| TIME-RECENT | Newly published event | High temporal relevance |
| TIME-RECYCLED | Archived event newly published without a material update | Historical rather than current incident |
| TIME-UPDATE | New verified material update on older event | Re-enters time window with explicit material-change evidence |
| COVERAGE-NO-BASELINE | No historical observations | INSUFFICIENT_DATA, never NORMAL |
| COVERAGE-NO-TREND | No trend reference samples | UNKNOWN, never STABLE |
| COVERAGE-NO-DATE | No verified publication time | Fails freshness gate |

## Operational requirements not yet covered by this lab
- **Collectors:** per-provider transport health, API permissions, failure reasons, country- and domain-specific coverage.
- **End-to-end retrieval:** publish time vs real event occurrence time; deduplication and evidence revision.
- **Sensor fusion:** independent ADS-B, AIS, GNSS and official source support; uncertainty and source provenance.
- **Regional observability:** a high static watch priority (for example Kaliningrad/Baltijsk) must never be presented as measured live activity.
- **Deployment:** CI passing and GitHub Pages serving the new HTML and JS must be independently verified.

## Acceptance criteria
1. Every fixture has a deterministic PASS/FAIL result.
2. A missing source or history is **insufficient evidence**, not evidence of calm.
3. Routine, ceremonial and medical coverage does not displace operational security incidents.
4. No article becomes new merely because an RSS feed has republished it or the app polled it again.
5. Do not create inferred hostile actor attribution from location or article wording alone.

The lab is intentionally read-only. No synthetic test fixture is written into NordicWatch's production incident archive, regional scores or notification stream.
