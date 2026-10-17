# NordicWatch Strategic Early Warning — v0.2 integration

**Current state:** implementation on feature/strategic-early-warning-v0, PR #17. Staged for deployment; no merge or live deployment from this branch. The separate Strategic Review page is linked from the map on this branch. The existing live map, military EventScore, event alert rules and Daily Brief stay unchanged.

## What is connected in code

- Cloudflare Event Worker retains its existing military feeds and endpoints.
- An isolated strategic collector in cloudflare/strategic-source-collector.mjs uses a separately approved official-source registry and its own KV keys (strategic:signals and strategic:snapshot).
- Default RSS endpoints: Council of the EU press releases and NATO news. Official RSS feeds are documented at https://www.consilium.europa.eu/en/about-site/rss/ and https://www.nato.int/cps/en/natohq/RSS.htm.
- The official White House, US Department of State, and Congress domains are allowlisted for *additional configured RSS URLs*. Their current feed URLs and reliability still need live testing before activation. They are **not** collected by default.
- The ESM collector uses strategic-early-warning.js to make two explicit hypothesis cards with original links, independent-source groups and counterevidence.
- The Worker exposes GET /strategic (only when STRATEGIC_ENABLED=true). The new strategic-review.html reads this endpoint, shows independent feeds, missing coverage, source document links, and hypothesis review priorities.
- GET /strategic never exposes the strategic snapshot while disabled.

## Deployment and configuration

The main-branch GitHub Actions Worker deployment config in this PR includes:

    STRATEGIC_ENABLED = "true"
    STRATEGIC_SOURCE_URLS = ""

The existing [EVENTS] KV namespace is reused under separate prefixed keys. The cron already fires every 15 minutes. Deployment automatically enables EU Council + NATO strategic RSS collection after this PR is reviewed and merged into main (assuming existing Cloudflare deployment secrets are configured and those endpoints respond).

If the selected official source supplies no current qualifying publication, show insufficient coverage; never claim "no developments". The app makes *no live US-domestic signal assessment by default*; a US source adapter (and independent domestic/news evidence) is required before the original Trump hypothesis can be evaluated meaningfully.

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

- Smoke-test the actual live EU/NATO feed responses and CORS on a staging Worker; verify freshness and errors.
- Add a verified, current US government feed for policy announcements and independent publication groups for domestic events; avoid archive data.
- Improve event-occurrence extraction from original primary documents; retain revisions/source hashes.
- Validate a retrospective case set with a human reviewer before adding briefing integration or alerts.

**Review checkpoint:** Do not merge the PR into main until these safeguards, the latest regression CI and the production rollout mechanism are accepted.
