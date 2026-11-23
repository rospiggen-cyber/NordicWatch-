import test from "node:test";
import assert from "node:assert/strict";
import {describeAdsbData, checkAdsb} from "../cloudflare/adsb-lol-staging-smoke.mjs";

function response(data, {status = 200, type = "application/json", headers = {}} = {}) {
  return new Response(typeof data === "string" ? data : JSON.stringify(data),
    {status, headers: {"content-type": type, ...headers}});
}
const okData = {ac: [
  {hex: "one", lat: 59.2, lon: 18.1, seen_pos: 2},
  {hex: "old", lat: 60, lon: 20, seen_pos: 900},
  {hex: "elsewhere", lat: 45, lon: 2, seen_pos: 1},
  {hex: "no-pos", seen_pos: 1},
  {hex: "bad", lat: 999, lon: 20, seen_pos: 1}
]};

test("counts fresh positioned aircraft without returning aircraft identities", async () => {
  const d = describeAdsbData(okData);
  assert.equal(d.records, 5);
  assert.equal(d.positioned, 3);
  assert.equal(d.nordicPositioned, 2);
  assert.equal(d.nordicFresh120s, 1);
  assert.equal(JSON.stringify(d).includes('"hex"'), false);
  const result = await checkAdsb(async (url, options) => {
    assert.equal(url, "https://api.adsb.lol/v2/mil");
    assert.equal(options.redirect, "manual");
    return response(okData);
  });
  assert.equal(result.status, "OK");
  assert.equal(result.httpStatus, 200);
});

test("handles successful but empty aircraft array without inventing aircraft", async () => {
  const result = await checkAdsb(async () => response({ac: []}));
  assert.equal(result.status, "OK");
  assert.equal(result.records, 0);
});

test("rejects HTML success pages, malformed JSON and invalid schema", async () => {
  assert.equal((await checkAdsb(async () => response("<!DOCTYPE html>", {type:"text/html"}))).status, "NOT_JSON");
  assert.equal((await checkAdsb(async () => response("{", {type:"application/json"}))).status, "INVALID_JSON");
  assert.equal((await checkAdsb(async () => response({aircraft:[]}))).status, "INVALID_SCHEMA");
});

test("handles redirect, rate limiting, upstream failure, network exceptions", async () => {
  assert.equal((await checkAdsb(async () => response("", {status:301}))).status, "REDIRECT_UNEXPECTED");
  const limited = await checkAdsb(async () => response("{}", {status:429, headers:{"retry-after":"180"}}));
  assert.deepEqual(limited, {status:"RATE_LIMITED",httpStatus:429,retryAfter:"180"});
  assert.equal((await checkAdsb(async () => response("{}", {status:502}))).status, "UPSTREAM_ERROR");
  assert.equal((await checkAdsb(async () => {throw new Error("network");})).status, "FETCH_FAILED");
});

test("refuses oversized responses before parsing", async () => {
  const result = await checkAdsb(async () => response("{}", {headers:{"content-length":"7000000"}}));
  assert.equal(result.status, "TOO_LARGE");
});
