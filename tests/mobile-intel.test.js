const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../mobile-intel.js'),'utf8');
function setup(){
 function element(){const listeners={},classes=new Set();return {scrollTop:123,attributes:{},focused:false,classList:{contains:c=>classes.has(c),add:c=>classes.add(c),remove:c=>classes.delete(c)},setAttribute(k,v){this.attributes[k]=v},focus(){this.focused=true},addEventListener(k,f){listeners[k]=f},emit(k,e={}){listeners[k]?.(e)}}}
 const elements=Object.fromEntries(['mobileIntel','mobileIntelClose','mobileIntelPanel'].map(id=>[id,element()])),doc=element(),media=element();
 const context=vm.createContext({document:{getElementById:id=>elements[id],addEventListener:doc.addEventListener},matchMedia:()=>media,window:{}});
 vm.runInContext(source,context);
 return {elements,doc,media,context};
}
function cycle(h){const {mobileIntel:open,mobileIntelClose:close,mobileIntelPanel:panel}=h.elements;open.emit('click');assert(panel.classList.contains('mobile-open'));assert.equal(open.attributes['aria-expanded'],'true');assert.equal(panel.scrollTop,0);assert(close.focused);close.emit('click');assert(!panel.classList.contains('mobile-open'));assert.equal(open.attributes['aria-expanded'],'false');assert(open.focused)}
test('mobile intelligence starts closed and opens/closes repeatedly with focus and aria state',()=>{const h=setup();assert(!h.elements.mobileIntelPanel.classList.contains('mobile-open'));cycle(h);cycle(h)});
test('Escape and viewport changes close mobile intelligence',()=>{for(const resize of [false,true]){const h=setup();h.elements.mobileIntel.emit('click');if(resize)h.media.emit('change');else{let prevented=false;h.doc.emit('keydown',{key:'Escape',preventDefault(){prevented=true}});assert(prevented)}assert(!h.elements.mobileIntelPanel.classList.contains('mobile-open'));assert.equal(h.elements.mobileIntel.attributes['aria-expanded'],'false')}});
test('navigation survives missing Leaflet, situation module failure and synchronous data startup failure',()=>{
 for(const failure of ['L.map("map")',fs.readFileSync(require.resolve('../situation-ui.js'),'utf8'),'function loadData(){throw Error("data startup failure")} loadData()']){const h=setup();assert.throws(()=>vm.runInContext(failure,h.context));cycle(h)}
});
test('navigation survives rejected data loading',async()=>{const h=setup();await assert.rejects(vm.runInContext('Promise.reject(new Error("data unavailable"))',h.context));cycle(h)});
test('mobile navigation initializes before Leaflet and situation code and is cached offline',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),ui=fs.readFileSync(require.resolve('../situation-ui.js'),'utf8'),sw=fs.readFileSync(require.resolve('../sw.js'),'utf8');
 assert(html.indexOf('src="mobile-intel.js"')<html.indexOf('src="vendor/leaflet/leaflet.js"'));assert(html.indexOf('src="mobile-intel.js"')<html.indexOf('src="situation-ui.js"'));assert(!ui.includes("getElementById('mobileIntel')"));assert(!ui.includes("classList.remove('mobile-open')"));assert.match(sw,/"\.\/mobile-intel.js"/);assert.match(html,/id="mobileIntelPanel"/);
});
