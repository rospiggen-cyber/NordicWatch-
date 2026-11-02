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

test("foreign cases without Nordic context do not appear as local incidents",()=>{
  const foreign=row("French supermarket freezers hacked","https://news.fr/french",{sourcecountry:"France"});
  assert.equal(Watch.classify(foreign,now),null);
  assert.equal(Watch.classify({...foreign,url:"https://svt.se/news",sourcecountry:"Sweden"},now),null);
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
