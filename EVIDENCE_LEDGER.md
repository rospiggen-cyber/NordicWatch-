# NordicWatch Evidence Ledger v1 (pilot)

## Purpose

Apply selected GMP/ALCOA+ data-integrity principles to **strategic NordicWatch observations and assessments**: attributable source, dates, versioned assessment, linked revision history and content integrity verification. This is a prototype, **not** GMP compliance, WORM storage, a security accreditation or a forensic chain of custody.

## Implemented scope

- New module: cloudflare/evidence-ledger.mjs, invoked by the existing strategic RSS collection. Military EventScore, alerts and the existing discovery engine are unchanged.
- A normalized assessment payload contains source IDs and their health, source links, observed/publication dates, signals, hypothesis reviews, source-coverage gaps, explicit engine versions and limitations.
- Each **materially changed** assessment is saved under its own timestamp/hash-based Cloudflare KV key with a SHA-256 fingerprint and a link to the previous entry.
- Every current GET /strategic response includes the latest evidence ledger reference. When the feed produces an identical assessment at the next poll, the history is not duplicated. Its collection time still advances in the current snapshot.
- Enabled deployments expose GET /strategic/evidence?id=<ledger-id> to retrieve a historic assessment and check its content fingerprint; disabled deployments and invalid/missing IDs are rejected.
- The Strategic Review page shows the current entry ID, fingerprint prefix, archived-at time and links to the historical record. No raw RSS body or private secret is saved as an evidence record.
- Automated tests cover first entry, no duplicate, linked revision, tamper detection, malformed IDs and a KV write failure.

## Important limitations

1. **Cloudflare KV is not write-once storage.** An operator with write access can overwrite/delete entries, and concurrent updates are not transactional. The checksum detects accidental/mismatched payload changes but does not authenticate an administrator. A later regulated/security deployment needs protected audit logs, retention policy, disaster recovery, independent anchoring and access-control review.
2. History begins only after this change is deployed and the next collector run succeeds. It does not retroactively prove past assessments.
3. The ledger stores normalized source references and analysis inputs, **not original published documents or full feed bytes**. Links can change or disappear, and publications can be revised. Source archiving/capture must be designed before claiming original-source preservation.
4. Some strategic timestamps use publication time as a proxy for real-world occurrence. A source claiming something is not independent proof the claim is correct.
5. There is no automatic verified independence between publishers, no causation proof and no military-threat forecasting. A hash is a content-integrity check, not evidence of truth.
6. Every material change will use storage. Costs and any retention/deletion policy must be assessed before high-volume expansion.
7. A failed historical write prevents replacement of the current strategic snapshot; the collector degrades via its existing error reporting instead of saying the evidence was archived.

## Next stage (not in this PR)

- Design independent, write-protected long-term archives and per-user attribution for edits.
- Add original-document hashes/captures with source permissions and retention controls.
- Generalize the schema and permissions for TRACE and possible sensitive customers only after access-control design and validation.
- Provide an as-of-date replay interface and compare snapshots without relying on live feeds.
