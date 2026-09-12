import "../news-freshness.js";
const F=globalThis.NordicWatchFreshness;
const H = 3600000;

// Curated public RSS sources used when EXTERNAL_REPORT_URLS is not configured.
// Keep this list deliberately small: broad collection, conservative assessment.
export const DEFAULT_EXTERNAL_FEEDS = Object.freeze([
  "https://www.defensenews.com/arc/outboundfeeds/rss/category/global/?outputType=xml",
  "https://www.defensenews.com/arc/outboundfeeds/rss/category/air/?outputType=xml",
  "https://www.defensenews.com/arc/outboundfeeds/rss/category/naval/?outputType=xml",
  "https://www.navalnews.com/feed/"
]);

const CORE = /\b(?:sweden|swedish|finland|finnish|norway|norwegian|denmark|danish|estonia|estonian|latvia|latvian|lithuania|lithuanian|baltic(?: sea| states?)?|gotland|bornholm|svalbard|spitsbergen|barentsburg|jan mayen|kaliningrad|k[oö]nigsberg|baltijsk|baltiysk|murmansk|kola|severomorsk|narva|gulf of finland|suwa[lł]ki)\b/i;
const ADJACENT = /\b(?:germany|german|poland|polish|united kingdom|britain|british|north sea|north atlantic|ukraine|ukrainian|belarus|belarusian|netherlands|dutch|iceland|arctic)\b/i;
const IMPACT = Object.freeze({
  WEAPONS_STOCKPILE: /\b(?:stockpile|inventory|munition|missile stock|interceptor|ammunition|weapons? shortage|weapons? depletion|expenditure rate)\b/i,
  FORCE_DIVERSION: /\b(?:carrier strike group|aircraft carrier|tanker aircraft|strategic airlift|isr aircraft|force diversion|redeploy|re-deploy|deployment|forward deploy|operational tempo)\b/i,
  INDUSTRIAL_CAPACITY: /\b(?:production capacity|production rate|industrial base|defen[cs]e industry|factory|manufacturing|lead time|backlog)\b/i,
  LOGISTICS: /\b(?:strait of hormuz|suez|red sea|shipping lane|sealift|logistics|supply route|port closure|blockade)\b/i,
  ENERGY: /\b(?:oil price|gas price|energy supply|lng|pipeline|oil export|gas export)\b/i,
  SUPPLY_CHAIN: /\b(?:supply chain|semiconductor|rare earth|component shortage|explosive precursor|propellant|rocket motor)\b/i
});
const GLOBAL_CONTEXT = /\b(?:iran|israel|middle east|persian gulf|strait of hormuz|taiwan|south china sea|east china sea|indo-pacific|pacific|china|chinese|north korea|korean peninsula|red sea|yemen)\b/i;
const OUTSIDE_AOI = /\b(?:bangladesh|south asia|southeast asia|indo-pacific|ramstein|kaiserslautern|landstuhl|egypt|tunisia|indonesia|australia)\b/i;
const NORDIC_DEMONYM = /\b(?:swedish|finnish|norwegian|danish|icelandic|estonian|latvian|lithuanian)\b/i;
const INCIDENTAL_CONTEXT = /\b(?:company|firm|manufacturer|supplier|selected to (?:design|build)|commercial success|ruck march|medical center|ceremonial|charity)\b/i;
const GEO_GROUPS = Object.freeze([
  ["kaliningrad", "konigsberg", "baltijsk", "baltiysk"],
  ["svalbard", "spitsbergen", "barentsburg"],
  ["murmansk", "kola", "severomorsk"],
  ["suwalki", "suwałki"],
  ["gotland", "baltic sea"],
  ["narva", "gulf of finland"]
]);
const STOP = new Set("the and for with from that this into over under near after before have has had was were will would could should about against amid among their there they them its our your new says said report reports military defence defense security activity forces force region regional official update updates".split(/\s+/));

const clean = (v, n = 5000) => String(v ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const norm = v => clean(v).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const iso = v => v != null && v !== "" && Number.isFinite(+new Date(v)) ? new Date(v).toISOString() : null;
const canonical = value => {
  try {
    const u = new URL(String(value));
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) u.searchParams.delete(key);
    u.searchParams.sort();
    return u.href.replace(/\/$/, "");
  } catch {
    return "";
  }
};
const host = value => {
  try { return new URL(String(value)).hostname.toLowerCase(); } catch { return ""; }
};
const tokens = value => [...new Set(norm(value).split(/[^a-z0-9]+/).filter(x => x.length >= 4 && !STOP.has(x)))];

export function configuredExternalFeedValue(value = "") {
  const configured = String(value).split(/[\s,]+/).filter(Boolean);
  return [...new Set([...DEFAULT_EXTERNAL_FEEDS, ...configured])].join(",");
}

export function classifyScope(article) {
  const text = clean(`${article.title || ""} ${article.summary || article.description || ""}`, 8000);
  const impactPaths = Object.entries(IMPACT).filter(([, re]) => re.test(text)).map(([key]) => key);
  if (OUTSIDE_AOI.test(text) && NORDIC_DEMONYM.test(text) && INCIDENTAL_CONTEXT.test(text)) {
    return { scope: "IRRELEVANT", scopeReason: "Nordic entity or participant mentioned in an event explicitly located outside the AOI", impactPaths };
  }
  if (CORE.test(text)) return { scope: "CORE", scopeReason: "Direct Nordic / Baltic geographic or entity match", impactPaths };
  if (ADJACENT.test(text)) return { scope: "ADJACENT", scopeReason: "Adjacent European / Arctic strategic context", impactPaths };
  if (GLOBAL_CONTEXT.test(text) && impactPaths.length) return { scope: "EXTERNAL", scopeReason: "External development with a plausible strategic dependency path", impactPaths };
  return { scope: "IRRELEVANT", scopeReason: "No established Nordic / Baltic relevance or dependency path", impactPaths };
}

export function normalizeArticle(article, now = Date.now()) {
  const url = canonical(article.url || article.sourceUrl);
  const dates=F.dates(article),publishedAt=dates.timestamp;
  const summary = clean(article.summary || article.description || article.content, 2500);
  const normalized = {
    ...article,
    url: url || article.url || article.sourceUrl,
    sourceUrl: url || article.sourceUrl || article.url,
    summary,
    description: clean(article.description || article.summary || article.content, 2500),
    publishedAt,
    updatedAt:dates.updatedAt,rawPublishedAt:dates.rawPublishedAt,rawUpdatedAt:dates.rawUpdatedAt,timestampStatus:dates.timestampStatus,timestampSource:dates.timestampSource,
    timestamp: F.parse(article.timestamp) || publishedAt,
    sourceName: clean(article.sourceName || host(url), 160),
    domain: article.domain || "NEWS"
  };
  return { ...normalized, ...classifyScope(normalized) };
}

export function retainRollingSignals(signals, now = Date.now(), hours = 72) {
  const cutoff = now - Math.max(24, hours) * H;
  return (Array.isArray(signals) ? signals : [])
    .filter(signal => {
      const development = signal.containsNewDevelopment === true || signal.temporal?.containsNewDevelopment === true;
      const effective = +(new Date(development ? (signal.lastUpdatedAt || signal.publishedAt || signal.ingestedAt) : (signal.eventTime || signal.publishedAt || signal.ingestedAt)));
      return Number.isFinite(effective) && effective >= cutoff;
    })
    .sort((a, b) => +new Date(a.ingestedAt || a.publishedAt) - +new Date(b.ingestedAt || b.publishedAt))
    .slice(-5000);
}

export function coverageFromRun(sourceHealth = [], articleCount = 0, retainedCount = 0, now = Date.now()) {
  const total = sourceHealth.length;
  const healthy = sourceHealth.filter(x => x.ok).length;
  const regionalIds = new Set(["nato", "jef", "se", "fi", "ee", "lv", "lt", "no", "pl", "de", "nl"]);
  const regional = sourceHealth.filter(x => regionalIds.has(String(x.id || "").toLowerCase()));
  const regionalHealthy = regional.filter(x => x.ok).length;
  const availability = total ? healthy / total : 0;
  const hasMaterial = articleCount > 0 && retainedCount > 0;
  const hasRegionalCoverage = regionalHealthy > 0;
  const coverage = Math.min(hasRegionalCoverage ? 100 : 59, Math.round(100 * availability * (hasMaterial ? 1 : 0.55)));
  const warning = !hasMaterial
    ? "Insufficient news coverage — absence of articles must not be interpreted as evidence of no change."
    : !hasRegionalCoverage
      ? "No healthy Nordic, Baltic, NATO or JEF source was available; broad defence feeds cannot establish regional coverage."
      : null;
  return {
    status: !total || healthy === 0 ? "INSUFFICIENT" : coverage < 60 || !hasMaterial || !hasRegionalCoverage ? "DEGRADED" : "HEALTHY",
    coverage,
    sourcesHealthy: healthy,
    sourcesTotal: total,
    regionalSourcesHealthy: regionalHealthy,
    regionalSourcesTotal: regional.length,
    articlesFetched: articleCount,
    rollingSignals: retainedCount,
    assessedAt: new Date(now).toISOString(),
    warning
  };
}

function sourceHosts(record, signals = []) {
  const urls = [record.sourceUrl, ...(record.sourceUrls || []), ...signals.filter(s => (record.sourceSignals || []).includes(s.signalId)).map(s => s.url || s.sourceUrl)].filter(Boolean);
  return [...new Set(urls.map(host).filter(Boolean))];
}

export function verificationFor(record, signals = []) {
  const hosts = sourceHosts(record, signals);
  const observed = record.evidence?.observed?.length || 0;
  const confirmed = Boolean(record.evidence?.confirmed) || /CONFIRMED|HIGH/.test(String(record.confidence || ""));
  const status = confirmed ? "VERIFIED" : hosts.length >= 2 || (hosts.length >= 1 && observed > 0) ? "CORROBORATED" : "UNVERIFIED";
  return { status, independentSources: hosts.length, sourceHosts: hosts };
}

export function addRevision(existing, record, now = Date.now(), reason = "scheduled reassessment") {
  const changes = [];
  const compare = [
    ["status", existing?.status, record.status],
    ["verification", existing?.verification?.status, record.verification?.status],
    ["eventScore", existing?.eventScore ?? existing?.discovery?.score, record.eventScore ?? record.discovery?.score],
    ["severity", existing?.severity, record.severity],
    ["confidence", existing?.confidence, record.confidence]
  ];
  for (const [field, before, after] of compare) if (existing && before !== after) changes.push({ field, before: before ?? null, after: after ?? null });
  const oldSources = new Set(existing?.sourceSignals || []), newSources = (record.sourceSignals || []).filter(x => !oldSources.has(x));
  if (newSources.length) changes.push({ field: "sourceSignals", added: newSources.length });
  const history = [...(existing?.revisionHistory || [])];
  if (!existing || changes.length) history.push({ at: new Date(now).toISOString(), reason: existing ? reason : "event created", changes });
  return history.slice(-30);
}

function eventText(event) {
  const entityText = event.entities && typeof event.entities === "object" ? JSON.stringify(event.entities) : String(event.entities || "");
  return clean(`${event.title || ""} ${event.description || ""} ${event.areaName || ""} ${(event.countries || []).join(" ")} ${entityText}`, 10000);
}

function expandGeoTerms(raw) {
  const n = norm(raw);
  const out = new Set(tokens(raw).filter(x => x.length >= 5));
  for (const group of GEO_GROUPS) if (group.some(alias => n.includes(norm(alias)))) for (const alias of group) out.add(norm(alias));
  return [...out];
}

function geographyTerms(event) {
  const raw = [event.areaName, ...(event.locations || []), ...(event.countries || [])].filter(Boolean).join(" ");
  return expandGeoTerms(raw);
}

function identityAnchors(event) {
  const entities = event?.entities && typeof event.entities === "object" ? event.entities : {};
  return [...new Set([
    ...(entities.exercises || []),
    ...(entities.aircraft || []),
    ...(entities.ships || []),
    ...(entities.weaponSystems || [])
  ].map(norm).filter(x => x.length >= 5))];
}

export function findFollowUps(event, signals = [], now = Date.now()) {
  const existing = new Set(event.sourceSignals || []);
  const eTokens = new Set(tokens(eventText(event)));
  const geo = geographyTerms(event);
  const anchors = identityAnchors(event);
  if (!geo.length) return [];
  return (Array.isArray(signals) ? signals : []).filter(signal => {
    if (!signal?.signalId || existing.has(signal.signalId)) return false;
    const t = +new Date(signal.lastUpdatedAt || signal.eventTime || signal.publishedAt || signal.ingestedAt);
    if (!Number.isFinite(t) || now - t > 72 * H || t > now + H) return false;
    const sText = clean(`${signal.title || ""} ${signal.summary || signal.description || ""}`, 8000);
    const n = norm(sText);
    if (!geo.some(g => n.includes(g))) return false;
    if (anchors.length && !anchors.some(anchor => n.includes(anchor))) return false;
    const overlap = tokens(sText).filter(x => eTokens.has(x)).length;
    return overlap >= (anchors.length ? 2 : 3);
  }).sort((a, b) => +new Date(b.lastUpdatedAt || b.eventTime || b.publishedAt) - +new Date(a.lastUpdatedAt || a.eventTime || a.publishedAt)).slice(0, 12);
}

export function summarizeSourceHealth(item, ok, count = 0, error = null, durationMs = null) {
  return {
    id: item.source?.id || item.trust?.sourceType || host(item.url) || "source",
    url: item.url,
    ok: Boolean(ok),
    items: Math.max(0, Number(count) || 0),
    durationMs: Number.isFinite(durationMs) ? Math.round(durationMs) : null,
    error: error ? clean(error, 160) : null
  };
}
