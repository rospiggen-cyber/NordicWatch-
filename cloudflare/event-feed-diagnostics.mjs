/**
 * NordicWatch event-feed diagnostics: safe failure codes only, never raw errors,
 * source URLs, tokens, request headers or exception stack traces in /health.
 */
const KNOWN_PHASES = new Set([
  "initialization", "read_catalog", "official_sources", "external_sources",
  "signal_ingestion", "event_build", "event_persistence", "routing",
  "state_reconciliation", "snapshot", "supplementary", "done"
]);

export function failureRecord(error, phase="initialization", now=Date.now()) {
  const message=String(error?.message || "").slice(0,1000);
  const kind =
    /KV_CATALOG|kv_catalog|invalid_kv_cursor|binding required/i.test(message) ? "KV_CATALOG" :
    /rate.limit|429/i.test(message) ? "RATE_LIMIT" :
    /invalid.*json|json.*parse|JSON/i.test(message) || error instanceof SyntaxError ? "JSON_PARSE" :
    /fetch|timeout|network|HTTP/i.test(message) ? "UPSTREAM_OR_NETWORK" :
    /quota|limit|size|too.large/i.test(message) ? "RESOURCE_LIMIT" :
    "UNCLASSIFIED";
  return {
    at:new Date(now).toISOString(),
    phase:KNOWN_PHASES.has(phase) ? phase : "initialization",
    kind,
    errorType:["Error","TypeError","SyntaxError","RangeError","ReferenceError"].includes(error?.name)
      ? error.name : "Error"
  };
}
export function discoveryHealth(lastRun, lastFailure, now=Date.now(), maxAgeMs=6*3600_000) {
  const lastRunTime=Date.parse(lastRun?.at || "");
  const lastFailureTime=Date.parse(lastFailure?.at || "");
  const runAvailable=Number.isFinite(lastRunTime) && lastRunTime<=now+60_000;
  const runAgeMinutes=runAvailable?Math.max(0,Math.floor((now-lastRunTime)/60000)):null;
  const recent=runAvailable && now-lastRunTime<=maxAgeMs;
  const failureActive=Number.isFinite(lastFailureTime) &&
    lastFailureTime>0 && (!runAvailable || lastFailureTime>lastRunTime);
  const reported=lastRun?.coverage||{status:"INSUFFICIENT",coverage:0};
  const status = failureActive ? "COLLECTOR_FAILURE" :
    !recent ? "NO_RECENT_RUN" :
    reported.status === "HEALTHY" ? "HEALTHY" :
    reported.status || "INSUFFICIENT";
  return {
    ok:status==="HEALTHY",status,
    runFresh:recent,runAgeMinutes,
    lastRun:runAvailable?lastRun.at:null,
    lastFailure:failureActive?{
      at:lastFailure.at,
      kind:lastFailure.kind||"UNCLASSIFIED",
      phase:lastFailure.phase||"initialization",
      errorType:lastFailure.errorType||"Error"
    }:null
  };
}
