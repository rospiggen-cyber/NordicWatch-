
const DATA = {
  hotspots: [
    {name:"Kaliningrad / Baltijsk", lat:54.71, lon:20.51, score:82, note:"Air defence, fleet & mobilisation indicators"},
    {name:"Gotland", lat:57.47, lon:18.49, score:58, note:"Baltic air & maritime activity"},
    {name:"Suwałki corridor", lat:54.10, lon:23.20, score:74, note:"NATO-Russia/Belarus pressure point"},
    {name:"Gulf of Finland", lat:59.75, lon:25.5, score:66, note:"Naval traffic, cables & GPS interference"},
    {name:"Kola / Murmansk", lat:68.97, lon:33.07, score:69, note:"Northern Fleet strategic activity"},
    {name:"Bornholm", lat:55.13, lon:14.92, score:46, note:"Baltic sea-lane and ISR relevance"},
    {name:"Narva", lat:59.38, lon:28.19, score:52, note:"Border and information pressure"},
    {name:"Norwegian energy zone", lat:61.0, lon:3.0, score:44, note:"Critical offshore infrastructure"}
  ],
  signals: [
    {time:"12 min", region:"Baltic", severity:"high", title:"Unusual military-air concentration", desc:"Multiple ISR / support profiles detected around the Baltic operating area. Baseline deviation: +170%."},
    {time:"37 min", region:"Kaliningrad", severity:"medium", title:"Baltijsk readiness signal", desc:"Recent activity pattern consistent with elevated local air-defence readiness and training."},
    {time:"1 h", region:"Finland", severity:"medium", title:"GPS interference cluster", desc:"Navigation anomalies reported around the eastern Gulf of Finland corridor."},
    {time:"2 h", region:"Norway", severity:"low", title:"Infrastructure watch", desc:"No major outage detected; offshore energy assets remain under heightened monitoring."}
  ],
  changes: [
    {title:"Baltic military-air activity increased", text:"24h activity is materially above the recent mock baseline, with concentration around Kaliningrad and the central Baltic."},
    {title:"Kaliningrad score +9", text:"Exercise/readiness indicators raise the regional activity score from 73 to 82."},
    {title:"GPS layer expanded eastward", text:"Interference markers now extend further into the Gulf of Finland monitoring area."},
    {title:"No new major Nordic outage", text:"Critical energy and telecom infrastructure remains stable in the current demo dataset."}
  ]
};

const map = L.map('map', { zoomControl: false }).setView([59.6, 19.0], 4);
L.control.zoom({position:'bottomright'}).addTo(map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 10,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const layers = {
  hotspots: L.layerGroup().addTo(map),
  military: L.layerGroup().addTo(map),
  infrastructure: L.layerGroup().addTo(map),
  gps: L.layerGroup().addTo(map)
};

function circle(lat, lon, radius, color, popup, layerName) {
  L.circle([lat, lon], {
    radius, color, weight: 1.5, fillColor: color, fillOpacity: .14
  }).bindPopup(popup).addTo(layers[layerName]);
}

DATA.hotspots.forEach(h => {
  const color = h.score >= 70 ? '#ff6b6b' : h.score >= 50 ? '#f7c948' : '#55d187';
  circle(h.lat, h.lon, 45000 + h.score*650, color,
    `<b>${h.name}</b><br/>Activity score: ${h.score}<br/><span style="color:#8393a8">${h.note}</span>`,
    'hotspots');
});

[
  [54.72,20.45,"Baltijsk"],
  [56.2,18.4,"Central Baltic ISR zone"],
  [59.7,24.8,"Gulf of Finland"]
].forEach(([lat,lon,label]) => circle(lat,lon,70000,'#61dafb',`<b>${label}</b><br/>Military activity marker`,'military'));

[
  [57.72,11.97,"Gothenburg energy/port"],
  [59.33,18.06,"Stockholm telecom node"],
  [60.39,5.32,"Bergen energy corridor"],
  [55.67,12.57,"Copenhagen/Øresund"]
].forEach(([lat,lon,label]) => circle(lat,lon,35000,'#55d187',`<b>${label}</b><br/>Critical infrastructure watch`,'infrastructure'));

[
  [59.45,27.3,"Narva region"],
  [59.8,25.9,"Eastern Gulf of Finland"],
  [58.4,22.5,"Baltic navigation anomaly zone"]
].forEach(([lat,lon,label]) => circle(lat,lon,85000,'#f7c948',`<b>${label}</b><br/>GPS/GNSS interference indicator`,'gps'));

function renderSignals() {
  const el = document.getElementById('signals');
  el.innerHTML = DATA.signals.map(s => `
    <div class="signal">
      <div class="signal-meta">
        <span>${s.region} · ${s.time} ago</span>
        <span class="badge sev-${s.severity}">${s.severity.toUpperCase()}</span>
      </div>
      <div class="signal-title">${s.title}</div>
      <div class="signal-desc">${s.desc}</div>
    </div>
  `).join('');
}

function renderHotspots() {
  const el = document.getElementById('hotspotList');
  el.innerHTML = [...DATA.hotspots].sort((a,b)=>b.score-a.score).map(h => `
    <div class="hotspot-row" data-lat="${h.lat}" data-lon="${h.lon}">
      <div>
        <div class="hotspot-name">${h.name}</div>
        <div class="hotspot-note">${h.note}</div>
      </div>
      <div class="score ${h.score>=70?'high':h.score>=50?'medium':'low'}">${h.score}</div>
    </div>
  `).join('');
  el.querySelectorAll('.hotspot-row').forEach(row => {
    row.addEventListener('click', () => map.flyTo([+row.dataset.lat,+row.dataset.lon], 6, {duration:.8}));
  });
}

function renderChanges() {
  document.getElementById('changes').innerHTML = DATA.changes.map(c => `
    <div class="change-item"><strong>${c.title}</strong><span>${c.text}</span></div>
  `).join('');
}

document.querySelectorAll('[data-layer]').forEach(cb => {
  cb.addEventListener('change', e => {
    const group = layers[e.target.dataset.layer];
    if (e.target.checked) group.addTo(map); else map.removeLayer(group);
  });
});

document.querySelectorAll('#timeRange button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#timeRange button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const scores = { "6h":57, "24h":62, "3d":65, "7d":68, "30d":54 };
    document.getElementById('activityScore').textContent = scores[btn.dataset.range];
  });
});

document.getElementById('changedBtn').addEventListener('click', () => {
  document.getElementById('changeDrawer').classList.remove('hidden');
});
document.getElementById('closeDrawer').addEventListener('click', () => {
  document.getElementById('changeDrawer').classList.add('hidden');
});
document.getElementById('changeDrawer').addEventListener('click', e => {
  if (e.target.id === 'changeDrawer') e.currentTarget.classList.add('hidden');
});

renderSignals();
renderHotspots();
renderChanges();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}
