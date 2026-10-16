import assert from "node:assert/strict";
import {configuredSources,parseFeed,discoverTimed,noveltyScoreTimed,classifyCivilRestriction} from "../cloudflare/event-discovery-core.mjs";
import "../news-routing.js";

const now=Date.parse("2026-10-16T06:10:00Z");
const sources=configuredSources();
assert(sources.some(x=>x.source.id==="fi-traffic" && x.url.includes("/fi/23")),"Traficom aviation RSS configured");
assert(sources.some(x=>x.source.id==="fi-traffic" && x.url.includes("/fi/254")),"Traficom maritime RSS configured");

// Real-world scenario, explicitly synthetic official article fixture; no real Traficom claim is implied.
const summary="Puolustusvoimat on ottanut käyttöön tilapäisen rajoitusalueen Kotkan edustalla itäisellä Suomenlahdella. Ilmailua ja meriliikennettä rajoitettiin varotoimenpiteenä mahdollisten lennokkien torjumiseksi.";
const article={
 title:"Puolustusvoimat rajoitti ilmailua ja meriliikennettä Kotkan edustalla",
 summary,url:"https://www.traficom.fi/fi/ajankohtaista/test-fixture-kotka",
 publishedAt:"2026-10-16T05:05:00Z"
};
assert.equal(classifyCivilRestriction(article.title+" "+summary).qualifies,true);
const event=discoverTimed(article,now);
assert(event,"officially sourced Finnish restriction produces a watch event");
assert.equal(event.eventType,"civil_defence_precaution");
assert.equal(event.areaName,"Kotka");
assert.equal(event.severity,"HIGH");
assert.equal(event.evidence.observed.length,0,"precaution is not direct detection of a drone");
assert.equal(event.discovery.restriction.droneIncursionConfirmed,false);
assert(event.tags.includes("DRONE_PRECAUTION_NOT_INCURSION"));
assert(noveltyScoreTimed(event,[],{related:[]},1).score>=80,"new official precaution should cross the alert threshold");
assert.equal(globalThis.NordicWatchNewsRouting.safeRelevance(article).relevant,true);

const nativeOnly={...article,title:"Kotkan merialue suljettu",summary:"Puolustusvoimat rajoitti ilmailua ja meriliikennettä varotoimenpiteenä mahdollisten lennokkien vuoksi."};
assert.equal(globalThis.NordicWatchNewsRouting.safeRelevance(nativeOnly).relevant,true,"Finnish locality and words are routed");

const xml='<rss><channel><item><title>Kotka: Ilmatila rajoitettu varotoimenpiteenä</title><description>Lennokkien vuoksi ilmailua ja meriliikennettä rajoitettiin Kotkan edustalla.</description><link>https://www.traficom.fi/fi/ajankohtaista/test-fixture</link><pubDate>Fri, 16 Oct 2026 05:05:00 GMT</pubDate></item></channel></rss>';
assert.equal(parseFeed(xml,"https://www.traficom.fi/feed/rss/fi/23").length,1);

assert.equal(classifyCivilRestriction("Traficom voi asettaa ilmatilan tilapäisen rajoituksen").qualifies,false,"generic future guidance not active");
assert.equal(classifyCivilRestriction("Exercise in Kotka uses drones but no area restriction").qualifies,false,"drone mention alone is not a closure");
assert.equal(discoverTimed({...article,url:"https://example.com/claim"},now),null,"unknown publisher cannot confirm");
console.log("Finnish civil-defence restriction regression passed");
