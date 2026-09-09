# SituationScore evidence audit — 9 September 2026

## Identified screenshot

The user identified the snapshot as approximately **20:27 Swedish time / 18:27 UTC**, with these four observation IDs. The three article IDs/titles/timestamps/source labels were also visible in the live client explanation panel. The older EH10 record and screenshot contributions were supplied by the user; its full original coordinates and per-record quality/EventScore were not available in the inspected backend response. No missing original fields have been invented.

| Observation | Timestamp UTC | Source label |
|---|---|---|
| `observation-1yup2zq` — EH10, AVIATION | 2026-09-06 17:46:08.339 | Public ADS-B |
| `signal-ndowf` — Saab Reveals MCMV 24 Mine Warfare Concept Tailored for the Baltic | 2026-09-07 11:18:16 | www.navalnews.com |
| `signal-crdbnn` — DNV and Fassmer to Cooperate on Autonomous Naval Vessels | 2026-09-09 09:48:49 | www.navalnews.com |
| `signal-1cz47vl` — Saab tapped to continue work on Sweden’s next flagship fighter jet | 2026-09-09 15:52:02 | www.defensenews.com |

Original article links: [MCMV 24](https://www.navalnews.com/naval-news/2026/09/saab-mcmv-24-mine-countermeasures-vessel), [DNV/Fassmer](https://www.navalnews.com/naval-news/2026/09/dnv-and-fassmer-to-cooperate-on-autonomous-naval-vessels), [Swedish fighter programme](https://www.defensenews.com/global/europe/2026/09/09/saab-tapped-to-continue-work-on-swedens-next-flagship-fighter-jet).

The backend `/situations` response inspected during this task contained separate singleton groups, not this client group. The live client inspected shortly afterwards showed a score-72 group using the same articles and three newer aircraft observations. That was corroborating evidence of the defect, not substituted for the user's score-47 snapshot.

## Exact original contribution path

All formulas below were traced before changing the code. No numeric thresholds or component coefficients were retuned.

| Component | Actual calculation for the screenshot | Points |
|---|---|---:|
| accumulation | `min(30, 4 × 6)`; all members in the **7-day** group, not just recent observations | 24 |
| temporalCompression | `min(15, 1 × 3)`; the fighter-programme article is in the latest 6 hours | 3 |
| sourceSupport | `min(15, 3 × 5)`; Public ADS-B, navalnews.com and defensenews.com labels | 15 |
| CIC | 3 observed calendar days, 4 occupied 6-hour slots, 2 domain labels, 3 source labels | 3.75 |
| baselineDeviation | Old code replaced missing reference history with numeric zero | 0 |
| acceleration | One observation in each 6-hour window; also below the existing minimum of 3 recent observations | 0 |
| eventContext | The reported 1.2 contribution implies a maximum member EventScore of 40: `40 × .03` | 1.2 |

The screenshot does not identify which member supplied that maximum EventScore. New contribution diagnostics expose its ID rather than guessing retrospectively.

CIC algebra: coherence = `(3 × .5 + 4 × .25) / 3 = 5/6`; interaction = `0 × .6 + 2 × .15 = .30` (none of these timestamps are within six hours of another); corroboration = `min(1, 3/3) × min(1, 2/2 + .5) = 1`. Rounded CIC = `round(100 × 5/6 × .30 × 1) = 25`; weighted contribution = `25 × .15 = 3.75`, displayed as **3.8**.

**Total: 24 + 3 + 15 + 3.75 + 0 + 0 + 1.2 = 46.95 → SituationScore 47.** The old score band selected DEVELOPING at 45. The old summary selected “Something is developing here” whenever membership was at least three. Neither required acceleration, measured abnormality, or available baseline.

`sourceSupport` counted different source labels, not three independently verified accounts of the same event. Two articles from Naval News supplied only one source group. The old HIGH confidence gate checked at least three source labels and quality >=65 for every member; it ignored missing baseline/geography. HIGH therefore reflected input-source assumptions, not reliability of the inferred regional relationship.

## Geography and baseline defects

- `pair()` previously treated equal region strings as geographic proximity whenever distance was unknown. The fallback string **Regional** could join unlocated news to aircraft without a measured distance or shared topic.
- CIC interaction awarded `.15` per domain even when all links had unknown distance. Thus two domain labels generated interaction credit without a located interaction.
- Fewer than three reference days yielded `expectedPerDay = null`, but `deviation = 0`. The UI rendered that as an actual measurement. Zero reference days did not numerically add points, but the display and some summaries conflated no measurement with no deviation.
- Baseline reference membership could itself rely on unknown-distance regional-label matching.

## Fix

The numeric 45/65/80 score bands, source/accumulation weights and caps, six-hour acceleration formula, seven-day group window, and baseline sample requirement remain unchanged. EventScore, aircraft classification, Daily Brief selection, hotspot scoring and news geographic filtering are not edited.

- Missing baseline has `available:false`, `deviation:null`, status **BASELINE NOT AVAILABLE**, and a null/excluded contribution. The UI says **deviation not assessable**, never measured zero. Valid measured zero remains zero.
- Regional baseline samples require supported geographic proximity. Unknown-distance reference records cannot create a baseline.
- Named-region/shared-topic hypotheses can remain linked with explicitly unverified geography. Generic **Regional** alone cannot connect unlocated observations. Such spurious groups can split; retaining every member of the original false cluster is not forced.
- Links carry `proximityConfirmed`; unlocated links earn no geographic CIC interaction credit. Their reasons no longer claim proximity, and the UI states **Distance unavailable — no proximity credit**.
- `scoreBand` retains the original numerical band. The displayed assessment distinguishes **POSSIBLE PATTERN**, **INSUFFICIENT BASELINE**, and evidence-supported **DEVELOPING/ELEVATED/HIGH**. Membership count alone cannot produce a developing narrative.
- Development requires increased located observation frequency, measured baseline deviation above the existing baseline interpretation boundary, or strong independent cross-domain support. Zero acceleration alone never generates an acceleration claim.
- Missing baseline caps HIGH at MEDIUM unless strong cross-domain support exists; combined baseline/geographic gaps normally yield LOW. Strong support requires a connected set of quality >=65 direct/confirmed observations from at least three source groups across at least two actual domains, with known proximity, shared subject and <=6-hour links. NEWS and OFFICIAL are treated as the same reporting dimension for this exception. Automatic assessments do not qualify.
- The explanation panel identifies all accumulation members, source-support groups/IDs, excluded geographic links and the EventScore maximum's contributing IDs. Source support is explicitly described as source-label diversity, not independent proof of a shared event.

The score-47 case has no acceleration and no recent cross-domain corroboration: its only aircraft observation is over 72 hours old. Missing baseline therefore cannot support HIGH or a claim of abnormal developing activity. The supported interpretation is a low/medium-confidence possible relationship where substantive links survive; generic-label-only associations are removed.

## Validation and limits

Targeted tests exercise missing versus measured-zero baseline, exclusion from numeric summation, unknown-distance interaction credit, generic-region false associations, missing-location baseline samples, confidence caps and the cross-domain exception, contribution trace IDs, unchanged numeric score thresholds, and null-safe UI explanations. Controlled unit inputs are explicitly test-only and are not inserted into production. Existing situation tests continue to check alerts, surveillance baselines, source deduplication, geographic separation and historical identity.

Validation result: **125 tests passed**. The local application was also opened with the revised engine and real live aircraft; it rendered successfully. Local-origin news/backend requests were unavailable, so that local browser check is not claimed as a replay of the historical news/aircraft group. The explanation renderer was separately tested with controlled inputs for unavailable-baseline text, source audits and null-safe rendering.

This is not a claimed full replay of an unavailable historical browser snapshot. Its exact supplied contribution algebra is proven above; subsequent real browser/backend observations are distinguished from that snapshot. Changes are local until explicitly published.
