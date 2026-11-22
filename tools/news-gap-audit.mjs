/**
 * Offline NordicWatch news-gap audit.
 * Read-only: never fetches URLs, alters KV, or sends notifications.
 * The corpus is a deliberately curated set of known, dated publications.
 * Missing from a partial capture is NOT proof of a collector failure.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const routing = require("../news-routing.js");

function canonical(value) {
  try {
    const u = new URL(String(value || ""));
    if (!["https:", "http:"].includes(u.protocol)) return "";
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$)/i.test(k)) u.searchParams.delete(k);
    }
    u.searchParams.sort();
    return u.href.replace(/\/$/, "");
  } catch { return ""; }
}

function norm(value) {
  return String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function host(value) {
  try { return new URL(String(value)).hostname.toLowerCase(); }
  catch { return ""; }
}

function sameArticle(expected, candidate) {
  const a = canonical(expected.url || expected.sourceUrl);
  const b = canonical(candidate.url || candidate.sourceUrl);
  if (a && b && a === b) return true;
  const titleA = norm(expected.title), titleB = norm(candidate.title);
  if (!titleA || titleA !== titleB) return false;
  // No cross-publisher fuzzy matches: syndicated headlines are not guaranteed
  // to be the same publication or a truly independent source.
  return Boolean(a && b && host(a) === host(b));
}

/**
 * @param {object} input - {capturedAt, expected, collected, sourceHealth,
 *                           captureComplete?}
 * @returns {object} Per-item stage diagnoses and bounded coverage counts.
 */
export function auditNewsGaps(input) {
  if (!input || typeof input !== "object") throw new TypeError("Audit input must be an object");
  const now = Date.parse(input.capturedAt);
  if (!Number.isFinite(now)) throw new TypeError("capturedAt must be an ISO datetime");
  const expected = input.expected;
  const collected = input.collected ?? input.articles ?? [];
  const health = input.sourceHealth ?? [];
  if (!Array.isArray(expected) || !Array.isArray(collected) || !Array.isArray(health)) {
    throw new TypeError("expected, collected and sourceHealth must be arrays");
  }
  if (expected.length > 1000 || collected.length > 20000) throw new RangeError("Audit corpus too large");
  const ids = new Set();
  const findings = expected.map((item, index) => {
    if (!item || typeof item !== "object" || !norm(item.title) || !canonical(item.url || item.sourceUrl)) {
      throw new TypeError(`expected[${index}] requires title and http(s) URL`);
    }
    const id = String(item.id || canonical(item.url || item.sourceUrl));
    if (ids.has(id)) throw new TypeError(`Duplicate expected id: ${id}`);
    ids.add(id);
    const source = item.sourceId ? health.filter(h => h.id === item.sourceId) : [];
    const sourceStatus = !source.length ? "UNKNOWN" : source.every(h => !h.ok)
      ? "UNAVAILABLE" : source.some(h => !h.ok) ? "DEGRADED" : "RESPONDING";
    const found = collected.find(article => article && sameArticle(item, article));
    if (!found) {
      return {id, title:item.title, url:item.url || item.sourceUrl,
        status:"NOT_OBSERVED_IN_CAPTURE", sourceStatus,
        reason:input.captureComplete === true
          ? "Absent from declared complete collection snapshot; investigate source and ingestion."
          : "Absent from partial capture; no collector-failure conclusion is possible."};
    }
    const result = routing.route([found], {now});
    const d = result.diagnostics[0];
    let status, reason;
    if (d.includedInDailyBrief) {
      status = "BRIEF_ELIGIBLE"; reason = "Collected and eligible for the current brief.";
    } else if (!d.aoiRelevant) {
      status = "RELEVANCE_FILTERED"; reason = d.exclusionReason || "Relevance filter rejected article.";
    } else if (!d.within72h) {
      status = "OUTSIDE_BRIEF_WINDOW"; reason = d.exclusionReason || "Not eligible for the 72-hour brief.";
    } else {
      status = "OTHER_ROUTING_EXCLUSION"; reason = d.exclusionReason || "Not selected; inspect routing.";
    }
    return {id, title:item.title, url:item.url || item.sourceUrl,
      status, sourceStatus, reason, publishedAt:d.publishedAt || null,
      matchedEventId:d.eventId || null, relevanceScore:d.relevanceScore};
  });
  const counts = Object.fromEntries(
    ["BRIEF_ELIGIBLE","RELEVANCE_FILTERED","OUTSIDE_BRIEF_WINDOW",
      "OTHER_ROUTING_EXCLUSION","NOT_OBSERVED_IN_CAPTURE"]
      .map(status => [status, findings.filter(x => x.status === status).length])
  );
  const captured = findings.length - counts.NOT_OBSERVED_IN_CAPTURE;
  return {
    capturedAt:new Date(now).toISOString(),
    captureComplete:input.captureComplete === true,
    summary:{expected:findings.length, observed:captured,
      briefEligible:counts.BRIEF_ELIGIBLE,
      observationRate:input.captureComplete === true && findings.length
        ? +(captured / findings.length * 100).toFixed(1) : null,
      notes:input.captureComplete === true
        ? "Snapshot marked complete by caller; this does not prove upstream coverage."
        : "Partial snapshot: observation rate withheld to avoid false coverage claims.",
      byStatus:counts},
    findings
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2]) throw new TypeError("Usage: node tools/news-gap-audit.mjs INPUT.json");
    const input = JSON.parse(await readFile(resolve(process.argv[2]), "utf8"));
    process.stdout.write(JSON.stringify(auditNewsGaps(input), null, 2) + "\n");
  } catch (error) {
    process.stderr.write(String(error.message || error) + "\n");
    process.exitCode = 1;
  }
}
