/**
 * Isolated, read-only ADSB.lol smoke test for NordicWatch STAGING only.
 * No aircraft identifiers or coordinates are returned. No KV, alerts, or writes.
 * Do NOT deploy as the production nordicwatch-proxy Worker.
 */
const API = "https://api.adsb.lol/v2/mil";
const MAX_BYTES = 6_000_000;

function result(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

function validPosition(a) {
  return a && Number.isFinite(a.lat) && Number.isFinite(a.lon) &&
    a.lat >= -90 && a.lat <= 90 && a.lon >= -180 && a.lon <= 180;
}

export function describeAdsbData(data) {
  if (!data || !Array.isArray(data.ac)) throw new Error("INVALID_SCHEMA");
  const positioned = data.ac.filter(validPosition);
  const nordic = positioned.filter(a =>
    a.lat >= 54 && a.lat <= 71 && a.lon >= 5 && a.lon <= 32
  );
  const freshNordic = nordic.filter(a =>
    Number.isFinite(a.seen_pos) && a.seen_pos >= 0 && a.seen_pos <= 120
  );
  return {
    status: "OK",
    upstream: "ADSB.lol /v2/mil",
    records: data.ac.length,
    positioned: positioned.length,
    nordicPositioned: nordic.length,
    nordicFresh120s: freshNordic.length,
    dataFormat: "ac[]",
    attribution: "Flight data: adsb.lol (ODbL 1.0)",
    note: "Public receiver observations, not proof of military intent or completeness. Unpositioned/stale aircraft excluded from regional counts."
  };
}

export async function checkAdsb(fetcher = globalThis.fetch) {
  let response;
  try {
    response = await fetcher(API, {
      headers: {accept: "application/json"},
      redirect: "manual",
      signal: AbortSignal.timeout(12000)
    });
  } catch {
    return {status: "FETCH_FAILED"};
  }
  if (response.status === 429) {
    return {status: "RATE_LIMITED", httpStatus: 429,
      retryAfter: String(response.headers.get("retry-after") || "").slice(0, 50)};
  }
  if (response.status >= 300 && response.status < 400) {
    return {status: "REDIRECT_UNEXPECTED", httpStatus: response.status};
  }
  if (!response.ok) return {status: "UPSTREAM_ERROR", httpStatus: response.status};
  const type = response.headers.get("content-type") || "";
  if (!/\b(?:application\/(?:[\w.-]+\+)?json)\b/i.test(type)) {
    return {status: "NOT_JSON", httpStatus: response.status, contentType: type.slice(0, 120)};
  }
  if (Number(response.headers.get("content-length") || 0) > MAX_BYTES) {
    return {status: "TOO_LARGE"};
  }
  let raw;
  try { raw = await response.text(); }
  catch { return {status: "READ_FAILED"}; }
  if (raw.length > MAX_BYTES) return {status: "TOO_LARGE"};
  let data;
  try { data = JSON.parse(raw); }
  catch { return {status: "INVALID_JSON"}; }
  try { return {...describeAdsbData(data), httpStatus: response.status}; }
  catch { return {status: "INVALID_SCHEMA"}; }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET") return result({status: "METHOD_NOT_ALLOWED"}, 405);
    if (url.pathname === "/") {
      return result({service: "NordicWatch ADS-B staging smoke test", status: "READY",
        trigger: "GET /adsb-smoke (manual test only; never production)"});
    }
    if (url.pathname !== "/adsb-smoke") return result({status: "NOT_FOUND"}, 404);
    const report = await checkAdsb();
    return result({application: "NordicWatch ADS-B staging",
      testedAt: new Date().toISOString(), ...report}, report.status === "OK" ? 200 : 503);
  }
};
