# Event state reconciliation — Finland acceptance audit

## Why the Finland record stayed current

The actual stored input is `mock/uav-incidents.json`, ID `fi-pellinge-uav-2026-09-02`, with a dated Porvoo/Pellinge recovery report and the original Maaseudun Tulevaisuus/STT URL. Despite the directory name, this is the application's existing sourced incident record, not a synthetic test case.

Before this change:

1. `initUAVIncidents()` reloaded that fixed JSON at every startup.
2. `NordicWatchUAV.normalize()` had no event lifecycle, last checked time or subsequent source history.
3. `renderUAVSignals()` and the UAV map renderer displayed every stored incident as current.
4. `hotspotImpact()` and `uavActivityContribution()` counted every imported incident without an active-status gate. The recovered-platform risk of 35 therefore contributed +7 to each nearby hotspot indefinitely.
5. Worker `findFollowUps()` matched recent news to discovered events, but never reconciled this separate UAV input or interpreted a follow-up's effect on its lifecycle.

This diagnosis was reported before modifying code. The underlying bug is specifically the disconnected static UAV path, in addition to incomplete event reconciliation; it is not proof that the real investigation has concluded.

## Actual evidence checked

`FINLAND_SOURCE_CAPTURE.json` records successful HTTP retrieval of the original source and two Yle updates, including source-page publication/update metadata. `data/verified-event-followups.json` contains clearly labeled paraphrases of those inspected updates, exact URLs, event association and source timestamps. The original input is unchanged.

- Original stored record: 2 September, date precision only. It describes physical recovery, possible territorial violation, unknown origin/operator and an investigation. Its stored 12:00 UTC value is not an exact occurrence time. The source page actually publishes at 13:15 UTC on 2 September; reporting places the discovery on 1 September. The input's uncertainty is retained, not silently rewritten.
- [Yle, 3 September](https://yle.fi/a/7-10104650): investigation at an early stage; origin and purpose still being examined. Published 09:13:38 UTC.
- [Yle, 4 September](https://yle.fi/a/74-20244534): the Border Guard identified the model as Russian-made Geoscan 701; the operator was not confirmed and investigation continued. Published 05:23:27 UTC, last source update 11:17:16 UTC.
- The [Finnish Government's initial statement](https://valtioneuvosto.fi/en/-/236553176/possible-territorial-violation-by-unmanned-aerial-vehicle-in-gulf-of-finland) also identifies Porvoo and the Border Guard/police investigation; it is not a resolution notice.

Follow-up searches used Porvoo/Pellinge/Pellinki/Borgå, Finnish Border Guard/Rajavartiolaitos/police, drone/UAV/UAS/lennokki/drooni terms, and investigation/restrictions/current-assessment terminology. No later source confirming that this particular investigation ended, that no drone existed, or that relevant restrictions were lifted was found.

**Current supported state: STALE, not RESOLVED.** The latest source assessment is older than the 72-hour acute-incident freshness window. Staleness means no recent information confirms ongoing activity; it is not a factual claim that authorities closed the case. “No immediate threat” and “operator not confirmed” are not treated as “no confirmed drone.” The independent August restriction-lifting article used in tests cannot resolve the September Porvoo recovery.

## Implementation

`event-state.js` maintains a separate, persistent event assessment containing `status`, `firstSeen`, `lastSeen`, `lastUpdated`, `lastChecked`, `latestAssessment`, `sources`, `active` and `confidence`. Its lifecycle is NEW, DEVELOPING, UPDATED, RESOLVED, STALE or UNCONFIRMED. Existing temporal ACTIVE/UPCOMING/ENDED statuses are not renamed: normalized events carry `eventState`, and inactive reconciliation states are excluded through existing eligibility gates.

`firstSeen` stays fixed. `lastSeen` and `lastUpdated` reflect dated evidence, not fetch time. `lastChecked` records attempted follow-up checks; `lastSuccessfulCheck` distinguishes service failure from successful observation. Replaying the same article cannot renew its evidence age, even if an unchanged page changes its timestamp. Source revisions are retained in the timeline. No original source or archived incident is deleted.

Matching uses an existing event ID or original URL, otherwise specific locality plus event topic; Finland's known locality aliases are inferred from its actual stored summary. Client registration requires an unambiguous matching event within seven days. Country-only matches are insufficient. Recovered-UAV investigations cannot be resolved merely by the lifting of regional traffic restrictions. Resolution/unconfirmed-state extraction requires explicit language from supported official sources or attributed reporting from recognized news sources, with negation checks. A generic later article cannot reopen a resolved event.

Acute evidence ages to STALE after 72 hours; scheduled exercises/deployments retain their explicit operating window rather than being treated like a transient drone observation. Neither ageing nor repeated unsuccessful checks produces RESOLVED.

The browser registry is `NORDICWATCH_EVENT_STATES`. The Worker registry is `event-state:registry`. `cloudflare/event-state-followup.mjs` performs ordinary source reconciliation plus one bounded, targeted GDELT follow-up search per discovery run, with a per-event one-hour cooldown and fair oldest-check selection. It derives queries from event data and does not replace evidence times with indexing/polling time. Failed queries are recorded as failures. `GET /event-states` exposes the stored results; `/news` and `/events` carry current reconciliation metadata. This endpoint needs Worker deployment.

## Active contribution and UI

Only active-status eligibility changes: the UAV risk formula remains 35 for the original evidence, but a stale/resolved incident's nearby-hotspot contribution becomes 0 instead of 7. The same gate applies to current news/event observations, UAV pattern membership, and current activity eligibility. EventScore, CIC, aircraft classification, geographic selection and fixed-hotspot score formulas are not redesigned. Historical sources stay available.

The UI shows **Finland drone incident — Porvoo**, **STALE**, **Last updated**, **Last checked**, the newer assessment and **3 sources · View timeline**. The native disclosure provides all source entries and links, a Close timeline control and Escape support. Open state survives refresh; unchanged reconciliation does not unnecessarily rebuild the timeline. A newer registry state overrides an older active in-memory snapshot immediately.

## Verification and limits

- Tests use the existing Finland record and real later Yle reports. Clock control tests ageing and repeated polling; no synthetic Finland updates or resolution claims are inserted.
- Actual August Finnish restriction lifting tests RESOLVED and guards against cross-event association.
- The original risk stays 35; active-only hotspot contribution changes from 7 to 0.
- Browser verification at 390 × 844 showed the real three-source timeline, last updated 2026-09-04T11:17:16Z, last checked, successful open/close, and removal from current UAV signals/map. Links expose the original source URLs. The in-app browser did not expose a new tab after a `_blank` link click; the source URLs themselves were independently fetched successfully.
- Local-origin Worker requests were unavailable. Their failure is recorded distinctly from the earlier successful source checks. The seeded **verified real follow-up evidence** allows the Finland correction immediately on startup, but ongoing Worker searches require deployment.
- Current findings are documented in `FINLAND_EVENT_STATE_AUDIT.json`; no authority-confirmed resolution of the Porvoo/Pellinge case is claimed.

This change includes the earlier Germany infrastructure implementation. Worker deployment is a separate operational step from committing and pushing the repository.

