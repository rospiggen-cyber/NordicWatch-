/* NordicWatch Evidence Ledger v1.
 * Records source-backed strategic analysis snapshots for later review.
 * Cloudflare KV is NOT immutable/WORM storage; see EVIDENCE_LEDGER.md.
 */
const PREFIX = 'strategic:evidence:';
export const LEDGER_VERSION = '1.0';

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).filter(k => value[k] !== undefined).sort()
      .map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}
function bytesToHex(bytes) {
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function sha256(value) {
  const data = new TextEncoder().encode(canonical(value));
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', data)));
}
export function evidencePayload(snapshot) {
  // Collection time changes every run; the stored payload must describe the
  // content and source coverage, not create a revision on every cron tick.
  const sourceCoverage = snapshot.sourceCoverage
    ? { ...snapshot.sourceCoverage } : null;
  if (sourceCoverage) delete sourceCoverage.generatedAt;
  return {
    schemaVersion: snapshot.schemaVersion,
    strategicEngine: { name: 'NORDICWATCH_STRATEGIC_EARLY_WARNING', version: '0.1.0' },
    coverageEngine: { name: 'SOURCE_COVERAGE_ENGINE', version: '1.0' },
    sources: snapshot.sources, failures: snapshot.failures,
    degraded: snapshot.degraded,
    signals: snapshot.signals, analysis: snapshot.analysis,
    sourceCoverage, limitations: snapshot.limitations
  };
}
export function validEvidenceId(id) {
  return typeof id === 'string' && /^nw-\d{8}T\d{9}Z-[a-f0-9]{16}$/.test(id);
}
export async function appendEvidence(kv, snapshot, now = Date.now()) {
  if (!kv?.get || !kv?.put) throw Error('Evidence KV missing');
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw Error('Invalid evidence timestamp');
  const payload = evidencePayload(snapshot);
  const payloadHash = await sha256(payload);
  const previous = await kv.get(PREFIX + 'latest', 'json');
  if (previous && previous.payloadHash === payloadHash) {
    // Nothing materially changed. Avoid writing identical entries on every poll.
    return { ...previous, appended: false };
  }
  const recordedAt = date.toISOString();
  const id = 'nw-' + recordedAt.replace(/[-:.]/g, '') + '-' + payloadHash.slice(0, 16);
  const signed = {
    ledgerVersion: LEDGER_VERSION, id, recordedAt,
    previousId: previous?.id || null, previousHash: previous?.sha256 || null,
    payloadHash, algorithm: 'SHA-256', payload
  };
  // The chain fingerprint covers timestamps, the revision link AND payload.
  const digest = await sha256(signed);
  const entry = { ...signed, sha256: digest };
  // Write the historical record BEFORE advancing latest. If this fails, the
  // current strategic snapshot must not present unarchived evidence as archived.
  await kv.put(PREFIX + id, JSON.stringify(entry));
  const latest = {
    id, recordedAt, previousId: entry.previousId,
    payloadHash, sha256: digest, algorithm: entry.algorithm, ledgerVersion: LEDGER_VERSION
  };
  await kv.put(PREFIX + 'latest', JSON.stringify(latest));
  return { ...latest, appended: true };
}
export async function readEvidence(kv, id) {
  if (!validEvidenceId(id)) return null;
  const entry = await kv.get(PREFIX + id, 'json');
  if (!entry || entry.id !== id || !entry.payload) return null;
  const {sha256: expected, integrity: _ignore, ...signed} = entry;
  const actual = await sha256(signed);
  return { ...entry, integrity: actual === expected ? 'MATCH' : 'MISMATCH' };
}
