import test from "node:test";
import assert from "node:assert/strict";
import intelligence from "../intelligence-core.js";
import {
  classifyScope,
  normalizeArticle,
  retainRollingSignals,
  coverageFromRun,
  findFollowUps
} from "../cloudflare/news-reliability-core.mjs";

const NOW = Date.parse("2026-09-06T16:00:00Z");

test("normalizes external feed timestamps and URLs", () => {
  const item = normalizeArticle({
    timestamp: "2026-09-06T15:00:00Z",
    sourceUrl: "https://example.com/story?utm_source=test#section",
    title: "Iran conflict drives interceptor stockpile pressure",
    description: "Missile inventory and ammunition expenditure may affect allied availability."
  }, NOW);
  assert.equal(item.publishedAt, "2026-09-06T15:00:00.000Z");
  assert.equal(item.url, "https://example.com/story");
  assert.equal(item.scope, "EXTERNAL");
  assert.ok(item.impactPaths.includes("WEAPONS_STOCKPILE"));
});

test("does not classify unrelated global stories as Nordic strategic context", () => {
  const result = classifyScope({
    title: "Travel festival opens in China",
    summary: "A cultural event attracts visitors this weekend."
  });
  assert.equal(result.scope, "IRRELEVANT");
  assert.deepEqual(result.impactPaths, []);
});

test("retains a rolling 72 hour signal layer", () => {
  const rows = retainRollingSignals([
    { signalId: "fresh", eventTime: new Date(NOW - 4 * 3600000).toISOString(), ingestedAt: new Date(NOW - 4 * 3600000).toISOString() },
    { signalId: "recent", eventTime: new Date(NOW - 70 * 3600000).toISOString(), ingestedAt: new Date(NOW - 70 * 3600000).toISOString() },
    { signalId: "old", eventTime: new Date(NOW - 80 * 3600000).toISOString(), ingestedAt: new Date(NOW - 80 * 3600000).toISOString() }
  ], NOW, 72);
  assert.deepEqual(rows.map(x => x.signalId), ["recent", "fresh"]);
});

test("coverage is degraded when sources respond but no relevant material is available", () => {
  const result = coverageFromRun([
    { ok: true }, { ok: true }, { ok: false }
  ], 20, 0, NOW);
  assert.equal(result.status, "DEGRADED");
  assert.match(result.warning, /absence of articles/i);
});

test("follow-up matching understands regional aliases", () => {
  const event = {
    title: "Russian reconnaissance aircraft deployment",
    description: "Recurring reconnaissance aircraft activity around Kaliningrad.",
    areaName: "Kaliningrad",
    countries: ["Russia"],
    locations: ["Kaliningrad"],
    sourceSignals: []
  };
  const signals = [{
    signalId: "s1",
    title: "Russian reconnaissance aircraft reported near Baltijsk",
    summary: "The reconnaissance aircraft was observed during a new deployment window.",
    eventTime: new Date(NOW - 3600000).toISOString()
  }];
  const matches = findFollowUps(event, signals, NOW);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].signalId, "s1");
});

test("event lifecycle is separate from technical status", () => {
  const first = intelligence.event({
    id: "e1",
    startTime: new Date(NOW - 3600000).toISOString(),
    lastObservedAt: new Date(NOW - 1800000).toISOString(),
    sourceSignals: ["s1"],
    eventScore: 40,
    eventType: "deployment"
  }, null, NOW);
  assert.equal(first.status, "ACTIVE");
  assert.equal(first.lifecycle, "NEW");

  const updated = intelligence.event({ ...first, sourceSignals: ["s1", "s2"] }, first, NOW);
  assert.equal(updated.lifecycle, "UPDATED");

  const ended = intelligence.event({
    ...updated,
    endTime: new Date(NOW - 1000).toISOString()
  }, updated, NOW);
  assert.equal(ended.status, "ENDED");
  assert.equal(ended.lifecycle, "RESOLVED");
});
