const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('Leaflet is served locally so map startup cannot block all dynamic content on CDN failure',()=>{
  const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
  const sw=fs.readFileSync(require.resolve('../sw.js'),'utf8');
  assert.doesNotMatch(html,/unpkg\.com\/leaflet/);
  assert.match(html,/href="vendor\/leaflet\/leaflet\.css"/);
  assert.match(html,/src="vendor\/leaflet\/leaflet\.js"/);
  assert.match(sw,/"\.\/vendor\/leaflet\/leaflet\.js"/);
  assert.match(sw,/"\.\/vendor\/leaflet\/leaflet\.css"/);
  assert(fs.statSync(require.resolve('../vendor/leaflet/leaflet.js')).size>100000);
  assert(fs.statSync(require.resolve('../vendor/leaflet/leaflet.css')).size>10000);
});
