import test from "node:test";
import assert from "node:assert/strict";
import {auditNewsGaps} from "../tools/news-gap-audit.mjs";
import {configuredExternalFeedValue} from "../cloudflare/news-reliability-core.mjs";
import {sourceTrust,parseExternalFeed} from "../external-report-core.mjs";

const NOW = "2026-11-22T12:00:00Z";
const article = (title, url, publishedAt = "2026-11-22T10:00:00Z") =>
  ({title, url, publishedAt, description: "Swedish Navy naval exercise near Gotland in the Baltic Sea."});

test("two candidate defence RSS feeds are explicit and lower-trust than official sources", () => {
  const defaults = configuredExternalFeedValue("").split(",");
  for (const url of ["https://www.defenseone.com/rss/all/","https://www.twz.com/feed"]) {
    assert(defaults.includes(url), url);
    assert.equal(sourceTrust(url)?.sourceType, "REPUTABLE_DEFENCE_PUBLICATION");
    assert.equal(sourceTrust(url)?.confirmed, false);
  }
  assert.equal(sourceTrust("https://www.defenseone.com/defense/article")?.confirmed, false);
  assert.equal(sourceTrust("https://www.thedrive.com/the-war-zone/article")?.confirmed, false);
  assert.equal(sourceTrust("https://www.twz.com/news/example")?.sourceType, "REPUTABLE_DEFENCE_PUBLICATION");
  assert.equal(sourceTrust("https://x.com/post/1"), null);
});

test("new publisher feeds parse only whitelisted publisher URLs and preserve publication time", () => {
  const xml = "<rss><channel><item><title>Swedish Navy exercise in Baltic Sea</title>" +
    "<link>https://www.defenseone.com/defense/2026/11/example/</link>" +
    "<pubDate>Sun, 22 Nov 2026 10:00:00 GMT</pubDate></item>" +
    "<item><title>Untrusted story</title><link>https://unknown.example/news</link>" +
    "<pubDate>Sun, 22 Nov 2026 10:00:00 GMT</pubDate></item></channel></rss>";
  const rows = parseExternalFeed(xml, "https://www.defenseone.com/rss/all/");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].timestamp, "Sun, 22 Nov 2026 10:00:00 GMT");
});

test("The War Zone redirected feed and article host are accepted as lower-trust publisher content", () => {
  const url = "https://www.twz.com/feed";
  const xml = '<rss><channel><item><title>New maritime monitoring system in the Baltic</title>' +
    '<link>https://www.twz.com/news/example-baltic</link>' +
    '<pubDate>Mon, 23 Nov 2026 08:00:00 GMT</pubDate></item></channel></rss>';
  const rows = parseExternalFeed(xml, url);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].timestamp, "Mon, 23 Nov 2026 08:00:00 GMT");
  assert.equal(rows[0].sourceUrl, "https://www.twz.com/news/example-baltic");
  assert.equal(sourceTrust(rows[0].sourceUrl)?.confirmed, false);
});

test("audits a found relevant story, a relevance rejection, and a stale publication", () => {
  const seen = article("Swedish Navy conducts naval exercise near Gotland",
    "https://www.defenseone.com/defense/2026/11/a");
  const rejected = {title:"NATO naval briefing in the Pacific Ocean",
    description:"US Navy ships visit Hawaii.", url:"https://www.defenseone.com/defense/2026/11/b",
    publishedAt:"2026-11-22T10:00:00Z"};
  const stale = article("Gotland naval exercise from last week",
    "https://www.defenseone.com/defense/2026/11/c","2026-11-18T10:00:00Z");
  const expected = [seen,rejected,stale].map((x,i)=>({...x,id:"item-"+i}));
  const result = auditNewsGaps({capturedAt:NOW,captureComplete:true,
    expected,collected:[seen,rejected,stale],
    sourceHealth:[{id:"REPUTABLE_DEFENCE_PUBLICATION",ok:true}]});
  assert.deepEqual(result.findings.map(x=>x.status),
    ["BRIEF_ELIGIBLE","RELEVANCE_FILTERED","OUTSIDE_BRIEF_WINDOW"]);
  assert.equal(result.summary.observationRate,100);
});

test("missing articles are unknown in partial captures, even if a feed failed", () => {
  const expected = [{id:"e1",title:"Polish air defence incident",
    url:"https://www.defenseone.com/defense/2026/11/missing",
    sourceId:"REPUTABLE_DEFENCE_PUBLICATION"}];
  const input={capturedAt:NOW,expected,collected:[],
    sourceHealth:[{id:"REPUTABLE_DEFENCE_PUBLICATION",ok:false}]};
  const result=auditNewsGaps(input);
  assert.equal(result.findings[0].status,"NOT_OBSERVED_IN_CAPTURE");
  assert.equal(result.findings[0].sourceStatus,"UNAVAILABLE");
  assert.match(result.findings[0].reason,/partial capture/i);
  assert.equal(result.summary.observationRate,null);
  assert.equal(auditNewsGaps({...input,captureComplete:true}).summary.observationRate,0);
});

test("rejects malformed audit input and duplicate expectations", () => {
  assert.throws(()=>auditNewsGaps({capturedAt:"not a date",expected:[]}),/capturedAt/);
  assert.throws(()=>auditNewsGaps({capturedAt:NOW,expected:[{title:"a"}]}),/requires title/);
  const e={id:"dup",title:"One",url:"https://example.com/one"};
  assert.throws(()=>auditNewsGaps({capturedAt:NOW,expected:[e,e]}),/Duplicate/);
});
