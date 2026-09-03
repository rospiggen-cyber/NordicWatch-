// NordicWatch v0.9.9 Service Worker
const CACHE="nordicwatch-v0.9.9-situational-engine";
const APP_SHELL=["./","./index.html","./aircraft-classifier.js","./special-mission-analysis.js","./coast-guard-analysis.js","./background-monitor-core.js","./maritime-core.js","./event-engine.js","./situational-engine.js","./route-pattern.js","./uav-incidents.js","./external-report-core.mjs","./mock/events.json","./mock/maritime-signals.json","./mock/uav-incidents.json","./mock/external-military-reports.json","./manifest.webmanifest","./icon-192.png","./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(key=>key!==CACHE).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET"||new URL(event.request.url).origin!==location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(hit=>hit||caches.match("./index.html"))));
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  let target=new URL("./",self.location.href);
  try{const candidate=new URL(event.notification.data?.url||"./",self.location.href);if(candidate.origin===self.location.origin)target=candidate}catch{}
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(windows=>{
    for(const client of windows){if("navigate" in client)return client.navigate(target.href).then(()=>client.focus())}
    return clients.openWindow?clients.openWindow(target.href):undefined;
  }));
});

self.addEventListener("push",event=>{
 const title="NordicWatch FLASH";
 const options={body:"New positively identified military activity. Open NordicWatch for current details.",tag:"nordicwatch-background-flash",renotify:true,requireInteraction:true,data:{url:"./"},icon:"icon-192.png",badge:"icon-192.png"};
 event.waitUntil(self.registration.showNotification(title,options));
});
