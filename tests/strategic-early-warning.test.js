const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../strategic-early-warning.js');

const NOW = '2026-10-18T12:00:00.000Z';

function signal(overrides = {}) {
  return {
    id: 'signal-domestic',
    title: 'Synthetic domestic policy debate',
    domain: 'DOMESTIC',
    actor: 'US',
    eventTime: '2026-10-17T12:00:00Z',
    publishedAt: '2026-10-17T13:00:00Z',
    topics: ['UKRAINE_SUPPORT'],
    evidence: 'REPORTED',
    source: { url: 'https://example.com/domestic', publisher: 'Outlet A', independenceGroup: 'AGENCY_A', type: 'NEWS' },
    ...overrides
  };
}
function policy(overrides = {}) {
  return signal({
    id: 'signal-policy',
    title: 'Synthetic published foreign-policy decision',
    domain: 'POLICY',
    eventTime: '2026-10-17T18:00:00Z',
    evidence: 'OFFICIAL_RECORD',
    source: { url: 'https://example.gov/policy', publisher: 'Government Office', independenceGroup: 'GOV_A', type: 'OFFICIAL' },
    ...overrides
  });
}
function card(result, id) { return result.cards.find(c => c.id === id); }

test('no inputs produce no assertions or predictions', () => {
  const r = engine.analyze([], { now: NOW });
  assert.equal(r.summary.accepted, 0);
  assert.equal(r.liveFeedConnected, false);
  assert.equal(card(r, 'US_DOMESTIC_POLICY').priority, 'INSUFFICIENT_EVIDENCE');
  assert.equal(r.cards.every(c => c.causalConclusion === 'NOT_ESTABLISHED' && c.riskOrElectionPrediction === false), true);
});

test('independent documented policy and reported domestic signal yield review, not causal conclusion', () => {
  const r = engine.analyze([signal(), policy()], { now: NOW });
  const c = card(r, 'US_DOMESTIC_POLICY');
  assert.equal(c.priority, 'REVIEW');
  assert.equal(c.sourceGroups.length, 2);
  assert.equal(c.links.length, 1);
  assert.deepEqual(c.links[0].sharedTopics, ['UKRAINE_SUPPORT']);
  assert.equal(c.causalConclusion, 'NOT_ESTABLISHED');
  assert.equal(c.riskOrElectionPrediction, false);
});

test('policy plus NATO Nordic-Baltic security reporting forms distinct regional review', () => {
  const r = engine.analyze([policy(), signal({
    id: 'nato',
    title: 'Synthetic NATO response',
    domain: 'ALLIANCE',
    actor: 'NATO',
    region: 'NORDIC_BALTIC',
    source: { url: 'https://example.int/nato', publisher: 'Alliance', independenceGroup: 'ALLIANCE_B', type: 'NEWS' }
  })], { now: NOW });
  assert.equal(card(r, 'US_POLICY_NORDIC_SECURITY').priority, 'REVIEW');
  assert.equal(card(r, 'US_DOMESTIC_POLICY').priority, 'INSUFFICIENT_EVIDENCE');
});

test('non-Nordic reporting does not masquerade as regional security evidence', () => {
  const r = engine.analyze([policy(), signal({
    id: 'nato-other',
    domain: 'ALLIANCE', actor: 'NATO', region: 'PACIFIC',
    source: { url: 'https://example.int/other', publisher: 'Alliance', independenceGroup: 'ALLIANCE_B', type: 'NEWS' }
  })], { now: NOW });
  assert.equal(card(r, 'US_POLICY_NORDIC_SECURITY').priority, 'INSUFFICIENT_EVIDENCE');
});

test('social and unverified reporting cannot make a review pair', () => {
  const social = signal({ evidence: 'OFFICIAL_RECORD',
    source: { url: 'https://x.com/post/1', publisher: 'X Account', independenceGroup: 'POSTER', type: 'SOCIAL' } });
  const r = engine.analyze([social, policy()], { now: NOW });
  assert.equal(r.summary.unverifiedLeads, 1);
  assert.equal(card(r, 'US_DOMESTIC_POLICY').priority, 'INSUFFICIENT_EVIDENCE');
});

test('synthetic demo rows are never promoted into live review evidence', () => {
  const r = engine.analyze([signal({ synthetic: true }), policy()], { now: NOW });
  assert.equal(r.summary.synthetic, 1);
  assert.equal(card(r, 'US_DOMESTIC_POLICY').priority, 'INSUFFICIENT_EVIDENCE');
});

test('two dependent outlets do not count as independent corroboration', () => {
  const r = engine.analyze([signal(), policy({
    source: { url: 'https://example.gov/policy', publisher: 'Government Office', independenceGroup: 'AGENCY_A', type: 'OFFICIAL' }
  })], { now: NOW });
  assert.equal(card(r, 'US_DOMESTIC_POLICY').priority, 'WATCH');
});

test('counterevidence lowers review priority and is visible', () => {
  const counter = policy({
    id: 'signal-policy-counter',
    title: 'Synthetic official counterstatement',
    stance: 'COUNTER',
    source: { url: 'https://example.gov/counter', publisher: 'Government Office', independenceGroup: 'GOV_A', type: 'OFFICIAL' }
  });
  const r = engine.analyze([signal(), policy(), counter], { now: NOW });
  const c = card(r, 'US_DOMESTIC_POLICY');
  assert.equal(c.priority, 'WATCH');
  assert.equal(c.counterevidence.length, 1);
  assert.equal(c.counterevidence[0].title, counter.title);
});

test('event-time freshness cannot be renewed by a later publication date', () => {
  const historical = signal({ eventTime: '2026-08-01T12:00:00Z', publishedAt: '2026-10-18T10:00:00Z' });
  const r = engine.analyze([historical, policy({ eventTime: '2026-08-02T00:00:00Z' })], { now: NOW });
  assert.equal(card(r, 'US_DOMESTIC_POLICY').priority, 'HISTORICAL_CONTEXT');
});

test('changed polling time for duplicate URL does not create another independent event', () => {
  const r = engine.analyze([
    signal({ eventTime: '2026-10-15T12:00:00Z', publishedAt: '2026-10-15T13:00:00Z' }),
    signal({ id: 'different-id', eventTime: '2026-10-17T12:00:00Z', publishedAt: '2026-10-17T13:00:00Z' }),
    policy()
  ], { now: NOW });
  assert.equal(r.summary.accepted, 2);
  assert.equal(r.signals.find(s => s.domain === 'DOMESTIC').eventTime, '2026-10-15T12:00:00.000Z');
});

test('unrelated stories cannot form a pair just because dates match', () => {
  const r = engine.analyze([signal(), policy({ topics: ['ENERGY_PRICE'] })], { now: NOW });
  assert.equal(card(r, 'US_DOMESTIC_POLICY').priority, 'INSUFFICIENT_EVIDENCE');
});

test('invalid, insecure, future and missing-source records are rejected', () => {
  const r = engine.analyze([
    signal({ source: { url: 'http://example.com', publisher: 'A', type: 'NEWS' } }),
    signal({ eventTime: '2026-10-19T12:00:00Z' }),
    signal({ source: { url: 'https://example.com', publisher: '' } }),
    signal()
  ], { now: NOW });
  assert.equal(r.summary.rejected, 3);
  assert.equal(r.summary.accepted, 1);
});

test('fresh report without primary source is WATCH, not REVIEW', () => {
  const r = engine.analyze([signal(), policy({
    evidence: 'REPORTED', source: { url: 'https://agency.example/policy', publisher: 'Outlet B', independenceGroup: 'AGENCY_B', type: 'NEWS' }
  })], { now: NOW });
  assert.equal(card(r, 'US_DOMESTIC_POLICY').priority, 'WATCH');
  assert.equal(card(r, 'US_DOMESTIC_POLICY').officialEvidencePresent, false);
});
