# NordicWatch Strategic Early Warning — v0.2 integration

**Current state (18 October 2026):** PR #17 was merged and the independent Strategic Review page and Worker endpoint are live. Cloudflare deployed successfully and production read-only smoke confirmed HTTP 200, enabled=true for /strategic and HTTP 200 for strategic-review.html. The first scheduled collection had not yet completed at the smoke test (awaitingFirstRun=true). Existing military EventScore, event alert rules and Daily Brief remain unchanged.

## What is connected in code

- Cloudflare Event Worker retains its existing military feeds and endpoints.
- An isolated strategic collector in cloudflare/strategic-source-collector.mjs uses a separately approved official-source registry and its own KV keys (strategic:signals and strategic:snapshot).
- Default RSS endpoints: Council of the EU press releases plus the White House news and presidential-actions feeds. The previously configured NATO legacy feed was verified to return HTTP 404 and has been disabled by default. Official EU RSS documentation: https://www.consilium.europa.eu/en/about-site/rss/.
- White House official domains are included with two current feeds. The State Department and Congress domains remain allowlisted for additional verified feeds, but none are activated by default. NATO can also be re-enabled only with a tested current URL.
- The ESM collector uses strategic-early-warning.js to make two explicit hypothesis cards with original links, independent-source groups and counterevidence.
- The Worker exposes GET /strategic (only when STRATEGIC_ENABLED=true). The new strategic-review.html reads this endpoint, shows independent feeds, missing coverage, source document links, and hypothesis review priorities.
- GET /strategic never exposes the strategic snapshot while disabled.

## Deployment and configuration

The main-branch GitHub Actions Worker deployment config in this PR includes:

    STRATEGIC_ENABLED = "true"
    STRATEGIC_SOURCE_URLS = ""

The existing EVENTS KV namespace is reused under separate prefixed keys. The cron already fires every 15 minutes. Deployment enabled EU Council + White House strategic RSS collection with the successful GitHub Actions/Cloudflare production rollout. First data snapshot depends on the next scheduled collection (15-minute cron).

If the selected official source supplies no current qualifying publication, show insufficient coverage; never claim "no developments". The White House streams give documented US policy statements, but do **not** provide independent domestic political pressure measurements, election polling or reporting. The original Trump domestic-pressure hypothesis remains INSUFFICIENT_EVIDENCE until an independently verified domestic source is connected.

To add an audited American RSS feed later, configure STRATEGIC_SOURCE_URLS to one or more space- or comma-separated **HTTPS** feed URLs on the approved original domains. Never copy a historic White House or State Department archive feed and mistake it for current statements. Test redirects, RSS formats, item dates and source attribution in a staging Worker first. No feed credentials belong in public HTML.

### Verification

    node --check strategic-early-warning.js
    node --check cloudflare/strategic-source-collector.mjs
    node --test tests/strategic-early-warning.test.js tests/strategic-source-collector.test.mjs
    node --test tests/*.test.js tests/*.test.mjs

The dedicated workflow and the existing full regression workflow run on the PR. The tests mock official feed responses: CI passing does **not** establish that the upstream EU/NATO/US endpoints are operational on deployment day.

### Boundaries and limitations

1. A primary institutional publication proves the institution *published a statement*, not whether every external factual claim it contains is true. The adapter tags relevant articles by topic; only selected US policy publications with announcement/action terms receive OFFICIAL_RECORD. This is still not confirmation of implementation or real-world outcomes.
2. If the publication contains no independently verified occurrence timestamp, its publication time is an explicitly documented proxy. Older developments may appear newer than they are; human investigation remains required before escalation.
3. Temporal proximity and shared topic indicate association, **never causality**. Each card states NOT_ESTABLISHED for causal conclusions. The engine does not generate election forecasts, psychological judgments, military threat probabilities, or operational assessments.
4. A website hostname and HTTPS URL are necessary routing checks, but insufficient alone to authenticate source claims. The server must fetch from the allowlisted source, enforce trusted redirect hostnames, bound feed payloads and only accept same-organization item URLs. Syndication source groups are separated by original organization, not publisher counts.
5. Social content, synthetic fixtures, incomplete sources and stale material cannot independently trigger a REVIEW. There are no new push notifications and no change to the military alert thresholds.
6. Review priorities are human triage aids. Even a REVIEW cannot automatically raise military EventScore or trigger an alert.
7. There is no automatic interpretation of voting intentions or partisan persuasion; first-party institutional statements may have advocacy content, so downstream reporting should distinguish that content from corroborated facts.

### Before lifting prototype status

- GitHub Actions live-feed smoke test on 17 October 2026: EU Council HTTP 200 with 20 parsed entries (5 topic matches); White House news HTTP 200 with 30 parsed entries (2 topic matches); White House presidential actions HTTP 200 with 30 parsed entries (1 topic match). The old NATO feed returned HTTP 404 and was disabled. All 3 current defaults passed live HTTP parsing tests. A separate post-deploy production check confirmed live HTTP 200 for both the Worker strategic endpoint and dashboard. The first scheduled collection was still pending when checked; verify fresh source health on subsequent cron.
- Use the verified White House streams for US policy announcements; add independent domestic / statistical reporting feeds only after testing current original-source availability and avoiding archives.
- Improve event-occurrence extraction from original primary documents; retain revisions/source hashes.
- Validate a retrospective case set with a human reviewer before adding briefing integration or alerts.

**Operations checkpoint:** Monitor the next scheduled Worker run. If sources fail, verify actual feed health and return a degraded response; do not elevate empty or stale data to an assessment.
