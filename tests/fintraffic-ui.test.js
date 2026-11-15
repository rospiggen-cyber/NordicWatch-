const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8"),sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
test("opt-in AIS control, source credit and offline adapter asset are present",()=>{
 assert.match(html,/id="syncFintrafficBtn"/);
 assert.match(html,/<script src="fintraffic-ais\.js"><\/script>/);
 assert.match(html,/Source: Fintraffic \/ digitraffic\.fi/);
 assert.match(html,/creativecommons\.org\/licenses\/by\/4\.0/);
 assert.match(sw,/\.\/fintraffic-ais\.js/);
 assert.match(sw,/nordicwatch-v1\.2-fintraffic-ais/);
});
test("AIS observations cannot generate standalone strategic signals or push notifications",()=>{
 assert.match(html,/x\.risk\.total>=MARITIME_ALERT_SCORE&&!isFintraffic\(x\.record\)/);
 assert.match(html,/maritimeEvents\.filter\(x=>!isFintraffic\(x\.record\)\|\|x\.behavior\)/);
 assert.match(html,/isFintraffic\(record\)\?\[\]:correlations/);
 assert.match(html,/FINTRAFFIC_REFRESH_MS=10\*60000/);
});
