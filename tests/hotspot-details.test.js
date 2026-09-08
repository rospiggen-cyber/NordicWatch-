const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),cp=require('child_process');
const html=fs.readFileSync('index.html','utf8'),before=cp.execFileSync('git',['show','HEAD:index.html'],{encoding:'utf8'});
for(const name of ['hotspotSituation','hotspotScore','rebuildSituationalState']){const line=s=>s.split(/\r?\n/).find(l=>l.startsWith('function '+name+'('));assert.equal(line(html),line(before),name+' unchanged');}
for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){if(match[0].includes('type="module"'))continue;new vm.Script(match[1]);}
const context={URL,activeEvents:[],maritimeRecords:[],situationalState:{signals:[]},esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')};vm.createContext(context);
vm.runInContext(html.slice(html.indexOf('function hotspotSignalDetail('),html.indexOf('function renderHotspots(')),context);
const signal={id:'news-test',domain:'NEWS',details:'Exact counted title',timestamp:'2026-09-08T10:00:00Z',region:'Kaliningrad / Baltijsk',link:'?news=test#news-test'};
const article={id:'test',title:'Original title',description:'Original summary',url:'https://example.org/original?a=1&b=2',domain:'example.org'};
const h=['Kaliningrad / Baltijsk',54.71,20.51,82];
const d=context.hotspotSignalDetail(signal,h,[article]);assert.equal(d.sourceUrl,article.url);assert.equal(d.sourceName,'example.org');assert.equal(d.signal,signal);assert.equal(d.originalRecord,article);assert.match(context.hotspotSignalMarkup(d),/View source ↗/);
for(const url of [undefined,'javascript:alert(1)','?news=test']){const missing=context.hotspotSignalDetail(signal,h,[{...article,url}]);assert.equal(missing.sourceUrl,null);assert.match(context.hotspotSignalMarkup(missing),/Source link unavailable/);}
console.log('Hotspot provenance, exact object identity, unsafe/missing URLs, protected functions and script syntax passed');

