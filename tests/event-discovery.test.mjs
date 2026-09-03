import assert from "node:assert/strict";
import {officialSource,configuredSources,parseFeed,discover,mergeEvents,correlateAircraft,noveltyScore,regionalPostures,classifyCapabilityChange} from "../cloudflare/event-discovery-core.mjs";

assert.equal(officialSource("https://www.dvidshub.net/news/1").id,"dvids");
assert.equal(officialSource("https://www.defense.gov/News/Releases/1").id,"dod");
assert.equal(officialSource("https://x.com/example/status/1"),null,"social media cannot confirm an event");
assert(configuredSources("https://www.navy.mil/rss/custom.xml https://evil.example/rss").some(x=>x.source.id==="usn"));
assert(!configuredSources("https://evil.example/rss").some(x=>x.url.includes("evil")));

const xml=`<rss><channel><item><title>Exercise Arctic Shield deploys Typhon to Trondheim</title><description><![CDATA[The 10th Brigade deployed Mk 70 and Typhon long-range fires. C-17 airlift and live-fire activity are expected. <script>alert(1)</script>]]></description><link>https://www.dvidshub.net/news/123/example</link><pubDate>Wed, 02 Sep 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
const articles=parseFeed(xml,"https://www.dvidshub.net/rss/news");assert.equal(articles.length,1);assert(!articles[0].summary.includes("alert(1)"));
const trondheim=discover(articles[0],Date.parse("2026-09-02T12:00:00Z"));assert(trondheim);assert.equal(trondheim.confidence,"CONFIRMED");assert.equal(trondheim.areaName,"Trondheim");assert.equal(trondheim.eventType,"military_exercise");assert(trondheim.entities.weaponSystems.some(x=>/Typhon/i.test(x)));assert(trondheim.expectedActivity.includes("TRANSPORT"));assert.equal(trondheim.discovery.temporaryWatchZone,true);assert.equal(trondheim.radiusKm,250,"long-range activity must expand the local dynamic zone");
const duplicate=discover({...articles[0],url:"https://www.defense.gov/News/Releases/Release/Article/1/",sourceName:"U.S. Department of Defense"},Date.parse("2026-09-02T12:00:00Z"));
assert.equal(mergeEvents([trondheim,duplicate]).length,1,"official repeats for one underlying event must deduplicate");

const correlation=correlateAircraft(trondheim,[{lat:63.44,lon:10.4,hex:"abc123",flight:"RCH123",t:"C17"},{lat:55,lon:12,t:"C17"}]);assert.equal(correlation.observed[0].evidence,"OBSERVED");assert.equal(correlation.related.length,1);
const score=noveltyScore(trondheim,[],correlation,1);assert(score.score>=75);assert.match(score.explanation,/CONFIRMED official source/);assert.match(score.explanation,/strategic weapon/);assert.match(score.explanation,/new location/);assert.match(score.explanation,/related military airlift observed/);

const jan=discover({...articles[0],title:"Exercise Arctic Shield deploys NSM to Jan Mayen",summary:"Naval Strike Missile deployment and sea denial operation at Jan Mayen.",url:"https://www.navy.mil/Press-Office/News-Stories/Article/2/example/"},Date.parse("2026-09-02T12:00:00Z"));
const posture=regionalPostures([trondheim,jan]);assert.equal(posture.length,1);assert.equal(posture[0].confidence,"CONFIRMED");assert.equal(posture[0].discovery.memberIds.length,2);assert.match(posture[0].evidence.inferred[0].text,/no actor inference/i);

assert.equal(discover({title:"Exercise at Trondheim",summary:"deployment",url:"https://example.social/post",publishedAt:"2026-09-02"}),null);
const capabilityArticle={title:"German Navy successfully test-fired Israeli LORA ballistic missile from a frigate in the North Atlantic",summary:"The German Navy completed a successful live-fire trial and plans procurement, adding a long-range precision strike and deterrence capability.",url:"https://www.bundeswehr.de/en/organization/navy/news/lora-trial",publishedAt:"2026-09-03T08:00:00Z"};
const capabilityText=classifyCapabilityChange(capabilityArticle);assert.equal(capabilityText.qualifies,true);assert.equal(capabilityText.severity,"HIGH");assert.equal(capabilityText.confidence,"HIGH");for(const tag of ["naval","ballistic-missile","long-range-strike","Germany","NATO","live-fire","procurement"])assert(capabilityText.tags.includes(tag),`missing capability tag ${tag}`);
const capabilityEvent=discover(capabilityArticle,Date.parse("2026-09-03T09:00:00Z"));assert(capabilityEvent);assert.equal(capabilityEvent.eventType,"military_capability_change");assert.equal(capabilityEvent.severity,"HIGH");assert.equal(capabilityEvent.confidence,"CONFIRMED");assert.match(capabilityEvent.areaName,/Germany \/ North Atlantic/);assert(capabilityEvent.countries.includes("Germany"));assert(capabilityEvent.organisations.includes("NATO"));assert.equal(capabilityEvent.radiusKm,300);const capabilityScore=noveltyScore(capabilityEvent,[],{related:[]},1);assert(capabilityScore.score>=90);assert.match(capabilityScore.explanation,/weapon capability/);
console.log("event discovery tests passed");
