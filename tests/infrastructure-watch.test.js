const {test}=require("node:test");
const assert=require("node:assert/strict");
const Watch=require("../infrastructure-watch.js");
const now=Date.parse("2026-11-02T10:00:00Z");
const row=(title,url,more={})=>({title,url,seendate:"20261102T084500Z",sourcecountry:"Sweden",...more});

test("ICA and Coop reports become a watch pattern without cyber attribution",()=>{
  const output=Watch.assess([
    row("Ica:s frysar hackats – står på 50 grader","https://example.se/ica"),
    row("Coop rapporterar driftstörningar i butiker","https://another.se/coop")
  ],now);
  assert.equal(output.incidents.length,2);
  assert.equal(output.watches.length,1);
  assert.equal(output.watches[0].status,"BEVAKA");
  assert.equal(output.watches[0].operatorCount,2);
  assert.match(output.watches[0].explanation,/not established/);
  assert.equal(output.incidents.find(x=>x.operator==="Coop").status,"DISRUPTION_REPORTED");
  assert.equal(output.incidents.find(x=>x.operator==="ICA").status,"CYBER_REPORTED");
});

test("one report repeated across feeds is not a cluster",()=>{
  const sample=row("Ica:s frysar hackats","https://example.se/ica");
  const output=Watch.assess([sample,{...sample,title:"ICA frysar hackade"}],now);
  assert.equal(output.incidents.length,1);
  assert.equal(output.watches.length,0);
});

test("multiple articles about one operator do not establish cross-operator pattern",()=>{
  const output=Watch.assess([
    row("ICA frysar hackade","https://media1.se/one"),
    row("ICA kylsystem störningar","https://media2.se/two")
  ],now);
  assert.equal(output.incidents.length,2);
  assert.equal(output.watches.length,0);
});

test("European refrigeration reports remain external context, never mapped into Nordic geography",()=>{
  const foreign=row("French supermarket freezers hacked","https://news.fr/french",{sourcecountry:"France"});
  assert.equal(Watch.classify(foreign,now).scope,"EUROPE_CONTEXT");
  assert.equal(Watch.classify({...foreign,url:"https://svt.se/news",sourcecountry:"Sweden"},now).country,"France");
});

test("irrelevant retail promotions and stale reports stay out",()=>{
  assert.equal(Watch.classify(row("Coop launches new freezer product","https://example.se/promo"),now),null);
  assert.equal(Watch.classify(row("ICA frysar hackade","https://example.se/old",{seendate:"20261020T080000Z"}),now),null);
});

test("official confirmation is not inferred from media wording",()=>{
  const incident=Watch.classify(row("ICA confirms cyberattack against freezers","https://news.se/ica"),now);
  assert.equal(incident.status,"CYBER_REPORTED");
  assert.equal(Object.hasOwn(incident,"attribution"),false);
});

test("requires HTTPS and a dated source report",()=>{
  assert.equal(Watch.classify(row("ICA frysar hackade","http://news.se/a"),now),null);
  assert.equal(Watch.classify({title:"ICA frysar hackade",url:"https://news.se/a"},now),null);
});

test("passive source tracing finds reported shared technology and method without attribution",()=>{
  const output=Watch.assess([
    row("ICA Danfoss frysar hackade – avfrostningen ändrades","https://media-one.se/ica"),
    row("Coop Danfoss kylsystem hackat – avfrostning manipulerad","https://media-two.se/coop")
  ],now);
  assert.equal(output.watches.length,1);
  const trace=output.watches[0].trace;
  assert.equal(trace.hypothesis,"COMMON_METHOD_AND_SYSTEM_REPORTED");
  assert.deepEqual(trace.sharedSystems,["Danfoss"]);
  assert.deepEqual(trace.sharedMethods,["DEFROST_SETTINGS_REPORTED"]);
  assert.equal(trace.entryPoint,"UNKNOWN");
  assert.equal(trace.networkOrigin,"UNKNOWN");
  assert.equal(trace.actor,"UNKNOWN");
});

test("technique overlap alone does not establish a common attacker",()=>{
  const output=Watch.assess([
    row("ICA Danfoss frysar hackade – avfrostning ändrades","https://media-one.se/ica"),
    row("Coop Dixell kylsystem hackat – avfrostning ändrades","https://media-two.se/coop")
  ],now);
  const trace=output.watches[0].trace;
  assert.equal(trace.hypothesis,"COMMON_METHOD_REPORTED");
  assert.equal(trace.sharedSystems.length,0);
  assert.equal(trace.actor,"UNKNOWN");
});

test("Belgian Delhaize and Swedish ICA form a cross-border WATCH, not attribution",()=>{
  const output=Watch.assess([
    row("ICA frysar hackade","https://news.se/ica"),
    {title:"Des frigos et surgélateurs Delhaize belges chauffent, cyberattaque ?",url:"https://rtl.be/actualite/delhaize",seendate:"20261102T081800Z",sourcecountry:"Belgium"}
  ],now);
  const cross=output.watches.find(w=>w.scope==="CROSS_BORDER");
  assert(cross);
  assert(cross.countries.includes("Belgium"));
  assert(cross.countries.includes("Sweden"));
  assert.equal(cross.trace.actor,"UNKNOWN");
  assert.equal(cross.trace.entryPoint,"UNKNOWN");
  assert.equal(cross.trace.sharedSystems.length,0);
});

test("mixed Belgian and Swedish headline remains non-geolocated cross-border context",()=>{
  const article=row("Les frigos des supermarchés touchés par une cyberattaque en Belgique et Suède","https://www.rtbf.be/article/example",{sourcecountry:"Belgium"});
  const incident=Watch.classify(article,now);
  assert(incident);
  assert.equal(incident.scope,"CROSS_BORDER_CONTEXT");
  assert.equal(incident.country,"Cross-border report");
  assert.equal(Watch.assess([article],now).watches.length,0,"a single multi-country report must not manufacture a cluster");
});

test("a Swedish Coop incident stays in Sweden when the summary cites a past French case",()=>{
  const coop=row("Coop skulle uppdatera nätet – då kom hackerattacken","https://www.sverigesradio.se/artikel/coop",{
    description:"Sex svenska Coop-butiker drabbade. Efter ett liknande fryshaveri i Frankrike skulle systemet uppdateras."});
  const incident=Watch.classify(coop,now);
  assert(incident);
  assert.equal(incident.country,"Sweden");
  assert.equal(incident.scope,"NORDIC");
});
test("Belgian headline is Belgium-specific despite mentioning Swedish background context",()=>{
  const belgian=row("Fryshaveri i belgiska matbutiker efter cyberattack","https://www.sverigesradio.se/artikel/belgium",{
    description:"Liknande kylsystemhaverier rapporteras också i Sverige."});
  const incident=Watch.classify(belgian,now);
  assert(incident);
  assert.equal(incident.country,"Belgium");
  assert.equal(incident.scope,"EUROPE_CONTEXT");
});
test("mixed-country context cannot inflate the independently localized WATCH report counts",()=>{
  const sweden=row("ICA frysar hackade i Sverige","https://example.se/ica");
  const belgium=row("Delhaize kylsystem hackade i Belgien","https://example.be/delhaize");
  const mixed=row("Frigos de Delhaize cyberattaqués en Belgique et Suède","https://example.be/mixed");
  const out=Watch.assess([sweden,belgium,mixed],now);
  assert.equal(out.incidents.length,3);
  const cross=out.watches.find(w=>w.scope==="CROSS_BORDER");
  assert(cross);
  assert.equal(cross.reportCount,2);
  assert.equal(cross.sourceCount,2);
  assert(!cross.countries.includes("Cross-border report"));
});
