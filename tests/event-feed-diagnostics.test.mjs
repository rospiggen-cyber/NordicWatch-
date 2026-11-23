import test from "node:test";
import assert from "node:assert/strict";
import {failureRecord,discoveryHealth} from "../cloudflare/event-feed-diagnostics.mjs";

const NOW=Date.parse("2026-11-23T09:00:00Z");
function run(at,coverageStatus="HEALTHY") {
  return {at:new Date(at).toISOString(),coverage:{status:coverageStatus,coverage:75}};
}

test("missing run is not healthy even if no error is recorded",()=>{
  const health=discoveryHealth(null,null,NOW);
  assert.equal(health.ok,false);
  assert.equal(health.status,"NO_RECENT_RUN");
  assert.equal(health.runAgeMinutes,null);
});

test("old successful runs never falsely claim healthy current coverage",()=>{
  const health=discoveryHealth(run(NOW-8*3600_000),null,NOW);
  assert.equal(health.ok,false);
  assert.equal(health.status,"NO_RECENT_RUN");
  assert.equal(health.runFresh,false);
});

test("recent successful run remains healthy when an older failure was recovered",()=>{
  const good=run(NOW-30*60000);
  const earlier=failureRecord(Error("KV_CATALOG problem"),"read_catalog",NOW-3600_000);
  const health=discoveryHealth(good,earlier,NOW);
  assert.equal(health.ok,true);
  assert.equal(health.status,"HEALTHY");
  assert.equal(health.lastFailure,null);
});

test("latest collector failure overrides old success without leaking message",()=>{
  const earlier=run(NOW-30*60000);
  const diagnostic=failureRecord(new TypeError("secret token xyz in KV_CATALOG"),"read_catalog",NOW-10*60000);
  const health=discoveryHealth(earlier,diagnostic,NOW);
  assert.equal(health.ok,false);
  assert.equal(health.status,"COLLECTOR_FAILURE");
  assert.equal(health.lastFailure.phase,"read_catalog");
  assert.equal(health.lastFailure.kind,"KV_CATALOG");
  assert.equal(health.lastFailure.errorType,"TypeError");
  assert.equal(JSON.stringify(health).includes("secret token xyz"),false);
});

test("lossy source coverage is not represented as HEALTHY",()=>{
  const health=discoveryHealth(run(NOW-30_000,"DEGRADED"),null,NOW);
  assert.equal(health.ok,false);
  assert.equal(health.status,"DEGRADED");
});

test("fault codes do not reveal error strings, external URLs or keys",()=>{
  const err=new Error("fetch https://secret.example/api?key=password failed");
  const rec=failureRecord(err,"external_sources",NOW);
  assert.equal(rec.kind,"UPSTREAM_OR_NETWORK");
  assert.equal(rec.phase,"external_sources");
  assert.equal(JSON.stringify(rec).includes("password"),false);
  assert.equal(JSON.stringify(rec).includes("secret.example"),false);
});

test("unknown diagnostics phase coerces to known safe stage",()=>{
  const diag=failureRecord(new Error("Unexpected"),"user-secret-phase",NOW);
  assert.equal(diag.phase,"initialization");
  assert.equal(diag.kind,"UNCLASSIFIED");
});
