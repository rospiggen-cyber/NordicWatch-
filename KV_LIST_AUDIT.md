# Workers KV enumeration audit

## Cause of the reported ~949 list operations/day

The repository had two logical Workers KV enumeration paths (three source occurrences because the background Worker also has a generated bundle):

| Worker / caller | Previous enumeration | Existing cadence |
|---|---|---|
| event-feed `GET /events` | `kvEvents()` lists every `event:` page | App startup and every minute per open client |
| event-feed `GET /news` | Same `kvEvents()` enumeration | App startup and every ten minutes per open client |
| event-feed discovery collector | Same enumeration for prior events | Every 15 minutes: 96 runs/day |
| background monitor / test flash | Lists every `sub:` page for each non-deduplicated alert | Each delivered alert; monitor runs every minute when enabled |

For a one-page event namespace, the old daily cost was approximately
`96 + /events requests + /news requests + subscription-list pages`.
About 775 minutes of one client's polling gives `96 + 775 + 78 = 949`, before startup calls, additional tabs, retries, pagination and alerts. A continuously open client alone could cause about 1,680 event list calls/day. The HTTP cache-control header did not cache the Worker handler's KV enumeration; the client uses `cache: no-store`.

This is a code-derived explanation, not a measured attribution of the user's Cloudflare account total. Previous code had no per-caller counters. Dashboard/CLI enumeration and other deployed Workers outside this repository may also count toward account usage.

## Replacement

`cloudflare/kv-catalog.mjs` gives each namespace a persistent membership index owned by one `KVCatalog` Durable Object. Event and subscription values remain under the existing Workers KV keys. Reads obtain indexed keys and read the original values directly; values retain normal KV caching and application interpretation. The membership Set is cached inside the durable owner and updated synchronously on additions/removals. Cold starts reload the durable index, never re-enumerate KV.

All event record writes, subscription registrations, unsubscribes and expired push-subscription removals now go through this owner. This prevents the lost updates that a shared KV JSON manifest would suffer under concurrent writes. A key is indexed before its value is written; failed writes leave only missing records that readers skip. Deletions remove the original record before index membership. No article selection, event lifecycle, scores, collection cadence, alert eligibility or source logic changes.

The first request imports existing keys once, with 1,000-key KV pages and durable page checkpoints. The manifest is not served until migration completes. Errors propagate instead of serving partial membership; retries resume at the last complete page. Even an empty page with a continuation cursor is followed. Existing expired/deleted value holes are ignored, just as before.

The only remaining Workers KV `.list()` is the instrumented migration call, also present in the generated background bundle. `this.storage.list()` is a Durable Object SQLite storage operation, not a Workers KV list request. Index membership is persisted per key rather than in an unbounded JSON value. Do not insert new `event:`/`sub:` keys directly through another writer after migration: use the indexed writer. Existing values can still be read directly. Keep previous Worker versions from concurrently writing unindexed records during cutover.

## Diagnostics and budget

Both Workers expose `GET /kv-diagnostics` (the background Worker retains its origin check). This reads seven fixed daily diagnostic keys, without any KV listing. Reports contain per-caller `invocations`, `listCalls`, `listFailures`, and `manifestCacheHits`, plus migration progress. Caller labels distinguish `/events`, `/news`, discovery, monitor, registration/deletion, and test flash. Invocations count catalog operations, including indexed writes; they are not necessarily HTTP request counts. Paths that never touch the catalog make zero list calls. Raw keys, subscriptions and secrets are not included.

Every attempted KV list also emits a structured `kv_list` log with namespace, caller, day and migration reason. Counters are durably written before the call so failures are included; a process failure between counter persistence and the actual call can conservatively overcount. Daily metrics are retained for seven days and expiry uses fixed-key deletion. The diagnostic request's own metrics appear on the next read.

**Steady-state target: 0 Workers KV list calls/day from these Workers**, below 100. Initial migration costs `max(1, ceil(events/1000)) + max(1, ceil(subscriptions/1000))` successful calls, plus failed-page retries. Large migrations or repeated service failures can exceed the target on migration day; this is not a claimed hard account-wide quota. There is no periodic repair scan or traffic-triggered list fallback.

## Deployment

Deploy code and the accompanying `KV_CATALOG` Durable Object binding together. Both example Wrangler configurations include a SQLite-backed `KVCatalog` migration. The existing local event-feed JSON configuration has also been updated without changing existing KV namespace IDs or variables. For an existing background Worker configuration, copy the binding/migration blocks from its example and preserve its actual namespace IDs, variables, secrets and other migrations. This change requires a Durable Object resource; it is not a KV-only deployment.

1. Run `node --test tests/*.test.js tests/*.test.mjs`.
2. Run `node tools/build-background-worker.mjs` if distributing the standalone background bundle. The bundle also exports `KVCatalog`; dashboard deployments must configure its binding and migration, not just paste code.
3. Deploy the event-feed Worker with `npx.cmd wrangler deploy --config cloudflare/wrangler.event-feed.json`.
4. Deploy the background Worker with its real configured Wrangler file. Do not deploy the placeholder example verbatim.
5. Read `/events`, `/news`, and `/kv-diagnostics`; check migration complete and counters. Verify the background catalog on its next existing collector/registration action without sending a test notification to real subscribers.
6. Compare the following complete UTC day's Cloudflare KV list usage and per-caller diagnostics. No live <100/day result is claimed before deployment and a measurement window.

## Validation

Automated tests cover a full day of 1,440 event polls, 144 news polls and 96 collector reads with hourly cold starts: **one initial KV list, zero subsequent lists**. Additional tests cover >1,000 existing records, unchanged value reads, updates, concurrent subscription registration, deletion across restarts, failed writes, migration failure/retry and exact diagnostic attribution. Existing discovery tests still verify identical event/alert behavior through the indexed writer.

Verification on 9 September 2026: **118 tests passed**. Wrangler dry-run builds passed for the event-feed entrypoint and standalone background bundle. A local Wrangler/workerd run returned HTTP 200 for three `/events` and three `/news` requests; persistent diagnostics reported one migration list attributed to `/events`, zero to `/news`, and completed migration. This local storage test inserted no incidents and made no production changes. The standalone bundle also passed import and subscription-validation parity checks.

Cloudflare references: [KV concurrent-write limitations](https://developers.cloudflare.com/kv/api/write-key-value-pairs/), [KV caching/consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/), [Durable Object configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).

## Production deployment — 9 September 2026

Deployed at the user's explicit request:

- Event feed: `da5d6a94-1651-4600-a72c-1cefcc20b72e`, existing 15-minute schedule retained.
- Background monitor: `6fd8e88b-5d79-4162-9148-6f03bd4c6925`. Its actual production configuration was read from Cloudflare. Both KV namespace IDs, all plain-text variables and secret binding names were verified after deployment. The monitor remains disabled, its schedule remains empty, and preview URLs remain disabled. No test push was sent.

Live `/events` and `/news` returned HTTP 200 with one event and three news records. Repeated calls reported one total migration list attributed to `/events`, zero to `/news`, and completed migration. Both `/kv-diagnostics` endpoints returned HTTP 200. The background subscription index has not yet migrated because no subscription operation or alert has invoked it; reading diagnostics does not enumerate subscriptions. Its migration will run on first normal use.

These are immediate production checks, not a completed 24-hour usage measurement. The backend was deployed before the subsequent Git commit and push. The background deployment configuration was generated under `.wrangler/deployment-inspect/background-deploy.json` from production settings; it is a local operational file, not a portable example.

### Follow-up production audit — 9 September, 18:22 UTC

Rechecked every remaining `.list()` occurrence in the Worker sources and both deployed diagnostics endpoints. The only Workers KV enumeration remains the initial migration in `kv-catalog.mjs` and its generated bundle copy; the other occurrences access Durable Object storage.

Approximately 4.5 hours after the event manifest completed migration:

| Caller | Catalog operations | KV list attempts |
|---|---:|---:|
| `GET /events` | 262 | 1 (initial migration) |
| `GET /news` | 29 | 0 |
| `collector:discovery` | 27 | 0 |
| Event diagnostics | 2 | 0 |

No KV list failures were recorded. Background diagnostics recorded zero KV lists; its monitor is still disabled and subscription migration is still pending first normal use. Thus observed post-migration recurring KV enumeration is zero, including real scheduled discovery activity. The full 24-hour/account-wide target is not yet measured. These counters cover only the instrumented deployed Workers, not dashboard/CLI calls or other Workers in the account.
