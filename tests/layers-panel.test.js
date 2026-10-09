const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../layers-panel.js'),'utf8');
function setup(isMobile=true,pushFails=false){
 const element=()=>{const listeners={},classes=new Set(['collapsed']);return {hidden:true,textContent:'',attributes:{},focused:false,classList:{contains:c=>classes.has(c),toggle(c,on){on?classes.add(c):classes.delete(c)}},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,f){listeners[k]=f},emit(k,e={}){listeners[k]?.(e)},focus(){this.focused=true}}};
 const elements=Object.fromEntries(['layersPanel','layersToggle','layersClose','layersBackdrop'].map(id=>[id,element()]));
 const doc=element(),win=element(),media=Object.assign(element(),{matches:isMobile});
 const stack=[{route:'original'}];let index=0,pending=false;
 const history={get state(){return stack[index]},pushState(s){if(pushFails)throw Error('unavailable');stack.splice(++index);stack.push(s)},replaceState(s){stack[index]=s},back(){pending=true}};
 const document={getElementById:id=>elements[id],addEventListener:doc.addEventListener};
 vm.runInNewContext(source,{document,window:win,matchMedia:()=>media,history});
 return {elements,win,media,history,stack,get index(){return index},flushBack(){assert(pending);pending=false;index--;win.emit('popstate')},back(){index--;win.emit('popstate')},forward(){index++;win.emit('popstate')},escape(){let prevented=false;doc.emit('keydown',{key:'Escape',preventDefault(){prevented=true}});return prevented}};
}
function closed(h){assert(h.elements.layersPanel.classList.contains('collapsed'));assert(h.elements.layersBackdrop.hidden);assert(h.elements.layersClose.hidden);assert.equal(h.elements.layersToggle.attributes['aria-expanded'],'false')}
function opened(h){assert(!h.elements.layersPanel.classList.contains('collapsed'));assert(!h.elements.layersClose.hidden);assert.equal(h.elements.layersToggle.attributes['aria-expanded'],'true')}
test('mobile starts closed; minus, Close, backdrop and Escape dismiss and preserve previous route',()=>{
 for(const action of ['layersToggle','layersClose','layersBackdrop','Escape']){
  const h=setup();closed(h);h.elements.layersToggle.emit('click');opened(h);assert(!h.elements.layersBackdrop.hidden);assert.equal(h.index,1);assert.equal(h.history.state.route,'original');
  if(action==='Escape')assert(h.escape());else h.elements[action].emit('click');
  closed(h);assert(h.elements.layersToggle.focused);h.elements.layersToggle.emit('click');closed(h);h.flushBack();assert.equal(h.index,0);assert.equal(h.history.state.route,'original');
  h.elements.layersToggle.emit('click');opened(h);assert.equal(h.stack.length,2);
 }
});
test('browser/Android Back closes panel; Forward does not reopen or retain a panel marker',()=>{
 const h=setup();h.elements.layersToggle.emit('click');h.back();closed(h);assert.equal(h.index,0);h.forward();closed(h);assert.equal(h.history.state.nordicWatchLayers,undefined);
});
test('desktop toggle works without adding history; crossing mobile breakpoint closes safely',()=>{
 const h=setup(false);opened(h);assert(h.elements.layersBackdrop.hidden);h.elements.layersToggle.emit('click');closed(h);h.elements.layersToggle.emit('click');opened(h);assert.equal(h.index,0);h.media.matches=true;h.media.emit('change');closed(h);
});
test('popup close and orientation breakpoint changes release mobile history entry',()=>{
 for(const popup of [true,false]){const h=setup();h.elements.layersToggle.emit('click');if(popup)h.win.NordicWatchLayers.close({restoreFocus:false});else{h.media.matches=false;h.media.emit('change')}closed(h);h.flushBack();assert.equal(h.index,0)}
});
test('closing still works if browser history push is unavailable',()=>{
 const h=setup(true,true);h.elements.layersToggle.emit('click');opened(h);h.elements.layersClose.emit('click');closed(h);assert.equal(h.index,0);
});
test('panel is closed in initial markup and its controller loads before Leaflet and app startup',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),sw=fs.readFileSync(require.resolve('../sw.js'),'utf8');
 assert.match(html,/class="layers collapsed" id="layersPanel"/);assert.match(html,/id="layersClose" hidden>× Close/);
 assert(html.indexOf('src="layers-panel.js"')<html.indexOf('src="https://unpkg.com/leaflet'));
 assert.match(sw,/"\.\/layers-panel.js"/);assert.match(html,/window\.NordicWatchLayers\.close/);
});
