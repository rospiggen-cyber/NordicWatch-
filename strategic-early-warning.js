/* NordicWatch Strategic Early Warning v0 — analytical triage, not a prediction engine.
 * Pure UMD module: no network, storage, UI side effects or background execution.
 * Source verification and safe feed ingestion are responsibilities of upstream adapters.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NordicWatchStrategic = api;
})(globalThis, function () {
  'use strict';

  const DAY = 86400000;
  const DOMAINS = new Set(['DOMESTIC', 'POLICY', 'ALLIANCE', 'SECURITY', 'ECONOMY']);
  const EVIDENCE = new Set(['OFFICIAL_RECORD', 'DIRECT_MEASUREMENT', 'REPORTED', 'UNVERIFIED']);
  const MODELS = Object.freeze([
    {
      id: 'US_DOMESTIC_POLICY',
      title: 'US domestic pressure and external policy',
      question: 'Do independently sourced domestic and foreign-policy developments overlap in time and subject?',
      left: 'DOMESTIC', right: ['POLICY'], actor: 'US',
      limitDays: 14,
      limitation: 'A temporal relationship cannot establish political motivation or causation.'
    },
    {
      id: 'US_POLICY_NORDIC_SECURITY',
      title: 'US policy and Nordic–Baltic security',
      question: 'Are documented US policy developments followed or accompanied by relevant European security signals?',
      left: 'POLICY', right: ['ALLIANCE', 'SECURITY'], actor: 'US',
      region: 'NORDIC_BALTIC', limitDays: 14,
      limitation: 'Co-occurrence does not establish a change in threat or military intent.'
    }
  ]);

  function clean(value, max = 240) {
    return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
  }
  function normalized(value) {
    return clean(value, 200).normalize('NFKD').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  }
  function timestamp(value) {
    const t = value == null || value === '' ? NaN : new Date(value).getTime();
    return Number.isFinite(t) ? t : null;
  }
  function httpsUrl(value) {
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:' || u.username || u.password) return null;
      u.hash = '';
      for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(k)) u.searchParams.delete(k);
      u.searchParams.sort();
      return u.href.replace(/\/$/, '');
    } catch { return null; }
  }
  function unique(values) { return [...new Set(values.filter(Boolean))]; }
  function normalizeSignal(raw, now = Date.now()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const domain = normalized(raw.domain);
    if (!DOMAINS.has(domain)) return null;
    const occurred = timestamp(raw.eventTime);
    const published = timestamp(raw.publishedAt);
    const source = raw.source && typeof raw.source === 'object' ? raw.source : {};
    const sourceUrl = httpsUrl(source.url || raw.url);
    const publisher = clean(source.publisher, 100);
    const group = normalized(source.independenceGroup || publisher);
    const type = normalized(source.type);
    if (!sourceUrl || !publisher || !group || occurred === null || occurred > now + 5 * 60000) return null;
    if (published !== null && published > now + 5 * 60000) return null;
    const evidence = EVIDENCE.has(normalized(raw.evidence)) ? normalized(raw.evidence) : 'UNVERIFIED';
    // An untrusted/social item stays a lead even if it claims official evidence.
    const lead = type === 'SOCIAL' || evidence === 'UNVERIFIED';
    const actor = normalized(raw.actor);
    const topics = unique((Array.isArray(raw.topics) ? raw.topics : []).map(normalized)).slice(0, 12);
    if (!topics.length || !clean(raw.title)) return null;
    const ageDays = Math.max(0, (now - occurred) / DAY);
    return {
      id: clean(raw.id || sourceUrl, 180), eventKey: clean(raw.eventKey, 160),
      title: clean(raw.title), description: clean(raw.description, 600),
      domain, actor, topics, region: normalized(raw.region),
      eventTime: new Date(occurred).toISOString(),
      publishedAt: published === null ? null : new Date(published).toISOString(),
      stance: normalized(raw.stance) === 'COUNTER' ? 'COUNTER' : 'SUPPORT',
      evidence: lead ? 'UNVERIFIED' : evidence,
      source: { url: sourceUrl, publisher, independenceGroup: group, type },
      freshness: ageDays <= 3 ? 'FRESH' : ageDays <= 14 ? 'RECENT' : 'HISTORICAL',
      lead, synthetic: raw.synthetic === true
    };
  }
  function deduplicate(signals) {
    const map = new Map();
    for (const s of signals) {
      // Different developments must have different event keys even on the same URL.
      const key = s.eventKey ? 'event:' + s.eventKey : 'url:' + s.source.url;
      const old = map.get(key);
      if (!old) { map.set(key, s); continue; }
      const latest = (timestamp(s.publishedAt) || 0) > (timestamp(old.publishedAt) || 0) ? s : old;
      const firstEventTime = Math.min(timestamp(old.eventTime), timestamp(s.eventTime));
      map.set(key, { ...latest, eventTime: new Date(firstEventTime).toISOString() });
    }
    return [...map.values()].sort((a, b) => timestamp(a.eventTime) - timestamp(b.eventTime));
  }
  function matchesModel(s, domain, model) {
    return s.domain === domain &&
      (model.actor !== 'US' || s.actor === 'US' || (domain !== 'DOMESTIC' && s.actor === 'NATO'));
  }
  function overlap(a, b) { return a.topics.filter(t => b.topics.includes(t)); }
  function relevantCounter(s, model, pairTopics) {
    return s.stance === 'COUNTER' && !s.lead &&
      (s.domain === model.left || model.right.includes(s.domain)) &&
      (s.actor === model.actor || s.actor === 'NATO') &&
      overlap(s, { topics: pairTopics }).length > 0 &&
      (!model.region || !s.region || s.region === model.region);
  }
  function assess(model, signals, now) {
    const eligible = signals.filter(s => !s.lead && !s.synthetic && s.stance === 'SUPPORT');
    const left = eligible.filter(s => matchesModel(s, model.left, model));
    const right = eligible.filter(s => model.right.includes(s.domain) &&
      (!model.region || s.region === model.region) &&
      (model.actor !== 'US' || s.actor === 'US' || s.actor === 'NATO'));
    const links = [];
    for (const a of left) for (const b of right) {
      if (a.id === b.id) continue;
      const gapDays = Math.abs(timestamp(a.eventTime) - timestamp(b.eventTime)) / DAY;
      const sharedTopics = overlap(a, b);
      if (gapDays > model.limitDays || !sharedTopics.length) continue;
      links.push({ from: a.id, to: b.id, sharedTopics, gapDays: Math.round(gapDays * 10) / 10,
        interpretation: 'Temporal/thematic association only — causation not established' });
    }
    const ids = new Set(links.flatMap(l => [l.from, l.to]));
    const support = eligible.filter(s => ids.has(s.id));
    const topics = unique(links.flatMap(l => l.sharedTopics));
    const counter = signals.filter(s => relevantCounter(s, model, topics));
    const sourceGroups = unique(support.map(s => s.source.independenceGroup));
    const official = support.some(s => s.evidence === 'OFFICIAL_RECORD' && s.source.type === 'OFFICIAL');
    const newest = Math.max(0, ...support.map(s => timestamp(s.eventTime)));
    const fresh = support.length > 0 && now - newest <= 3 * DAY;
    let priority = 'INSUFFICIENT_EVIDENCE';
    if (links.length && fresh) priority = 'WATCH';
    if (links.length && fresh && sourceGroups.length >= 2 && official && !counter.length) priority = 'REVIEW';
    if (links.length && !fresh) priority = 'HISTORICAL_CONTEXT';
    const gaps = [];
    if (!links.length) gaps.push('No documented cross-domain pair sharing a topic within 14 days.');
    if (sourceGroups.length < 2) gaps.push('An independent second source group.');
    if (!official) gaps.push('An authenticated primary-source document for the policy or security development.');
    if (counter.length) gaps.push('Reconcile conflicting evidence before raising priority.');
    if (!fresh && links.length) gaps.push('New evidence of a material development, not simply a refreshed article.');
    gaps.push('Additional evidence is needed before making any causal attribution.');
    return {
      id: model.id, title: model.title, question: model.question,
      priority, sourceGroups, officialEvidencePresent: official,
      support: support.map(s => ({ id: s.id, title: s.title, domain: s.domain, eventTime: s.eventTime,
        evidence: s.evidence, source: s.source })),
      counterevidence: counter.map(s => ({ id: s.id, title: s.title, source: s.source })),
      links, whatWouldChangeAssessment: gaps, limitation: model.limitation,
      causalConclusion: 'NOT_ESTABLISHED', riskOrElectionPrediction: false
    };
  }
  function analyze(rawSignals, options = {}) {
    const now = timestamp(options.now) ?? Date.now();
    const input = Array.isArray(rawSignals) ? rawSignals.slice(0, 2000) : [];
    const rejected = [];
    const normalizedSignals = input.map((raw, i) => {
      const result = normalizeSignal(raw, now);
      if (!result) rejected.push({ index: i, reason: 'Invalid schema, date, topic or HTTPS source' });
      return result;
    }).filter(Boolean);
    const signals = deduplicate(normalizedSignals);
    const cards = MODELS.map(model => assess(model, signals, now));
    return {
      engine: 'NORDICWATCH_STRATEGIC_EARLY_WARNING', version: '0.1.0',
      generatedAt: new Date(now).toISOString(), liveFeedConnected: false,
      summary: { accepted: signals.length, rejected: rejected.length,
        unverifiedLeads: signals.filter(s => s.lead).length,
        synthetic: signals.filter(s => s.synthetic).length },
      signals, rejected, cards,
      disclaimer: 'Analytical review priorities, not threat ratings, election forecasts, causal proof or verified intelligence. Input sources need independent upstream verification.'
    };
  }
  return { MODELS, normalizeSignal, deduplicate, analyze };
});
