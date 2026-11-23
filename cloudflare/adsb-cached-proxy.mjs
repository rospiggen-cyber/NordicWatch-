/**
 * NordicWatch — cached ADSB.lol military aircraft proxy, STAGING CANDIDATE.
 *
 * Scheduled collector is disabled by default, requires an approved provider
 * agreement, a separate API key and a dedicated KV binding.
 * Browser requests NEVER contact upstream or refresh the cache.
 * Do NOT deploy to production without a separate review and explicit approval.
 */
export const SNAPSHOT_KEY = "adsb:nordic-mil:v1:snapshot";
export const HEALTH_KEY = "adsb:nordic-mil:v1:health";
export const UPSTREAM = "https://api.adsb.lol/v2/mil";
export const STALE_SECONDS = 600; // 5-minute cron, maximum 10-minute observation age.
const MAX_BYTES = 6_000_000;
const FIELDS = ["hex","flight","r","t","desc","ownOp","operator","alt_baro",
 "alt_geom","gs","track","baro_rate","geom_rate","squawk","category",
 "dbFlags","nav_qnh","seen","seen_pos","lat","lon"];

const stringField = (v) => typeof v === "string" ? v.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 160) : null;
const finiteNumber = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
const epochSeconds = (nowMs) => Math.floor(nowMs / 1000);

function json(payload, status=200) {
  return new Response(JSON.stringify(payload), {status, headers:{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store",
    "x-content-type-options":"nosniff",
    "access-control-allow-origin":"*"
  }});
}

function validPosition(a) {
  return a && finiteNumber(a.lat) !== null && finiteNumber(a.lon) !== null &&
    a.lat >= -90 && a.lat <= 90 && a.lon >= -180 && a.lon <= 180;
}
function insideNordic(a) {
  return a.lat >= 54 && a.lat <= 71 && a.lon >= 5 && a.lon <= 32;
}
function validSeen(v) {
  return finiteNumber(v) !== null && v >= 0 && v <= 7200;
}
function aircraftSubset(a) {
  const out = {};
  for (const k of FIELDS) {
    if (!(k in a)) continue;
    const v = a[k];
    if (typeof v === "string") out[k] = stringField(v);
    else if (finiteNumber(v) !== null) out[k] = v;
  }
  // Only keep observations with an independently usable position age.
  return out;
}

export function normalizeSnapshot(data, nowMs=Date.now()) {
  if (!data || !Array.isArray(data.ac) || data.ac.length > 10000) throw new Error("INVALID_SCHEMA");
  const filtered = data.ac.filter(a => validPosition(a) && insideNordic(a) && validSeen(a.seen_pos));
  return {
    version:1, snapshotAt:new Date(nowMs).toISOString(),
    sourceTime:finiteNumber(data.now) !== null ? data.now : null,
    sourceTotal:data.ac.length, ac: filtered.slice(0, 5000).map(aircraftSubset)
  };
}

function enabled(env) {
  return env.ADSB_CACHE_ENABLED === "true" &&
    env.ADSB_PROVIDER_APPROVED === "true" &&
    typeof env.ADSB_API_KEY === "string" && env.ADSB_API_KEY.length >= 8 &&
    !!env.ADSB_CACHE;
}

async function setHealth(env, state, nowMs, extra={}) {
  if (!env.ADSB_CACHE) return;
  await env.ADSB_CACHE.put(HEALTH_KEY,
    JSON.stringify({state, checkedAt:new Date(nowMs).toISOString(), ...extra}),
    {expirationTtl: 86400});
}

/** Refresh is callable ONLY from scheduled() and tests, never from an HTTP request. */
export async function refreshSnapshot(env, options={}) {
  const nowMs = options.nowMs ?? Date.now();
  if (!enabled(env)) return {status:"DISABLED_OR_UNAUTHORIZED"};
  const fetcher = options.fetcher || globalThis.fetch;
  let response;
  try {
    response = await fetcher(UPSTREAM, {
      headers: {accept:"application/json", "x-api-key":env.ADSB_API_KEY},
      redirect:"manual",
      signal:AbortSignal.timeout(12000)
    });
  } catch {
    await setHealth(env, "FETCH_FAILED", nowMs);
    return {status:"FETCH_FAILED"};
  }
  if (response.status === 429) {
    await setHealth(env, "RATE_LIMITED", nowMs, {httpStatus:429});
    return {status:"RATE_LIMITED",httpStatus:429}; // Do not retry or evade provider throttling.
  }
  if (response.status >= 300 && response.status < 400) {
    await setHealth(env, "UNEXPECTED_REDIRECT", nowMs, {httpStatus:response.status});
    return {status:"UNEXPECTED_REDIRECT",httpStatus:response.status};
  }
  if (!response.ok) {
    await setHealth(env, "UPSTREAM_ERROR", nowMs, {httpStatus:response.status});
    return {status:"UPSTREAM_ERROR",httpStatus:response.status};
  }
  const type = response.headers.get("content-type") || "";
  if (!/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(type)) {
    await setHealth(env, "NOT_JSON", nowMs);
    return {status:"NOT_JSON"};
  }
  if (Number(response.headers.get("content-length")||0)>MAX_BYTES) {
    await setHealth(env, "TOO_LARGE", nowMs);
    return {status:"TOO_LARGE"};
  }
  let text;
  try {text = await response.text();}
  catch {await setHealth(env, "READ_FAILED", nowMs); return {status:"READ_FAILED"};}
  if (text.length > MAX_BYTES) {
    await setHealth(env, "TOO_LARGE", nowMs);
    return {status:"TOO_LARGE"};
  }
  let snapshot;
  try {snapshot=normalizeSnapshot(JSON.parse(text), nowMs);}
  catch {await setHealth(env, "INVALID_PAYLOAD", nowMs);return {status:"INVALID_PAYLOAD"};}
  await env.ADSB_CACHE.put(SNAPSHOT_KEY, JSON.stringify(snapshot), {expirationTtl:3600});
  await setHealth(env, "OK", nowMs, {records:snapshot.ac.length, sourceTotal:snapshot.sourceTotal});
  return {status:"OK",records:snapshot.ac.length};
}

function ageSeconds(snapshot, nowMs) {
  const t=Date.parse(snapshot?.snapshotAt||"");
  if (!Number.isFinite(t) || t > nowMs + 30000) return null;
  return Math.max(0, Math.floor((nowMs-t)/1000));
}
function agedAirframe(a, age) {
  const out={...a};
  if (validSeen(a.seen)) out.seen = a.seen + age;
  if (validSeen(a.seen_pos)) out.seen_pos = a.seen_pos + age;
  return out;
}

export async function serveCached(request, env, nowMs=Date.now()) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, {status:204, headers:{
    "access-control-allow-origin":"*",
    "access-control-allow-methods":"GET, OPTIONS",
    "access-control-allow-headers":"content-type"
  }});
  if (request.method !== "GET") return json({status:"METHOD_NOT_ALLOWED"},405);
  if (url.pathname !== "/" && url.pathname !== "/mil" && url.pathname !== "/health") {
    return json({status:"NOT_FOUND"},404);
  }
  if (url.pathname === "/health") {
    const health = env.ADSB_CACHE ? await env.ADSB_CACHE.get(HEALTH_KEY,"json") : null;
    const snapshot = env.ADSB_CACHE ? await env.ADSB_CACHE.get(SNAPSHOT_KEY,"json") : null;
    const age = ageSeconds(snapshot, nowMs);
    return json({service:"NordicWatch ADS-B cached staging",
      configured:enabled(env),health:health?.state||"NO_RUN",
      checkedAt:health?.checkedAt||null,
      snapshotAt:snapshot?.snapshotAt||null,
      snapshotAgeSeconds:age,
      snapshotAvailable:age !== null && age <= STALE_SECONDS,
      source:"adsb.lol",license:"ODbL-1.0"});
  }
  // Fail closed: never serve a snapshot unless access was explicitly approved.
  if (!enabled(env)) return json({status:"SOURCE_NOT_AUTHORIZED",ac:[]},503);
  const snapshot = await env.ADSB_CACHE.get(SNAPSHOT_KEY,"json");
  const age = ageSeconds(snapshot, nowMs);
  if (age === null) return json({status:"NO_VERIFIED_SNAPSHOT",ac:[]},503);
  if (age > STALE_SECONDS) return json({status:"STALE_SNAPSHOT",ac:[],
    snapshotAt:snapshot.snapshotAt,snapshotAgeSeconds:age},503);
  if (!Array.isArray(snapshot.ac)) return json({status:"INVALID_CACHE",ac:[]},503);
  // Aging the positional metadata prevents repeatedly serving stale positions as fresh.
  const ac=snapshot.ac.map(a=>agedAirframe(a,age))
    .filter(a=>validSeen(a.seen_pos) && a.seen_pos <= STALE_SECONDS);
  return json({
    ac,now:epochSeconds(nowMs),total:ac.length,
    source:"adsb.lol",license:"ODbL-1.0",attributionUrl:"https://www.adsb.lol/",
    snapshotAt:snapshot.snapshotAt,snapshotAgeSeconds:age,
    observation:"DELAYED_CACHED_PUBLIC_ADSB",live:false
  });
}

export default {
  async fetch(request,env) {return serveCached(request,env);},
  async scheduled(_controller,env) {await refreshSnapshot(env);}
};
