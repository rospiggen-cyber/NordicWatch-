/* NordicWatch Cascade Lab: display-only synthetic model explorer. */
(function(root){
 "use strict";
 const engine=root.NordicWatchCascadeLab;
 if(!engine)return;
 const $=id=>document.getElementById(id);
 const pick=$("case"),range=$("horizon"),safeguards=$("safeguards"),timeline=$("timeline");
 if(!pick||!range||!safeguards||!timeline)return;
 const activeByModel=new Map();
 const el=(tag,content,klass)=>{
  const a=document.createElement(tag);
  if(content!==undefined)a.textContent=String(content);
  if(klass)a.className=klass;
  return a;
 };
 function controls(){
  const model=engine.get(pick.value),active=activeByModel.get(model.id)||new Set();
  safeguards.replaceChildren();
  for(const barrier of model.safeguards){
   const label=el("label",undefined,"toggle");
   const input=el("input");input.type="checkbox";input.checked=active.has(barrier.id);
   input.name="safeguard";input.value=barrier.id;
   const caption=el("span");caption.append(el("strong",barrier.name),el("small",barrier.note));
   label.append(input,caption);
   input.addEventListener("change",()=>{
    const selected=activeByModel.get(model.id)||new Set();
    if(input.checked)selected.add(barrier.id);else selected.delete(barrier.id);
    activeByModel.set(model.id,selected);render();
   });
   safeguards.append(label);
  }
 }
 function render(){
  const model=engine.get(pick.value),active=[...(activeByModel.get(model.id)||new Set())];
  const horizon=Number(range.value);
  const result=engine.compare(model.id,active,horizon);
  $("scenarioDetail").textContent=model.description;
  $("horizonValue").textContent=horizon+" h";
  $("hazop").textContent=model.hazop;
  $("fmea").textContent=model.fmea;
  $("lopa").textContent=model.lopa;
  $("baselineCount").textContent=result.baselineCount;
  $("currentCount").textContent=result.visibleCount;
  $("avoidedCount").textContent=result.avoidedCount;
  timeline.replaceChildren();
  // Every stage is visible for audit, including consequences blocked by a selected safeguard.
  const ordered=model.nodes.map(node=>result.timeline.find(row=>row.id===node.id));
  for(const node of ordered){
   const reached=node.visible,prevented=!node.possible,late=node.possible&&!reached;
   const section=el("article",undefined,"step"+(reached?"":" mutedstep"));
   section.dataset.state=prevented?"blocked":late?"future":"possible";
   section.append(el("span",node.hour===null?"Ej nådd":(node.hour===0?"T0":"T+"+node.hour+" h"),"clock"));
   section.append(el("h3",node.name));
   section.append(el("p",node.kind==="trigger"?"Antagen utlösande händelse":
      prevented?"Kopplingen bryts av valt skydd i modellen.":
      late?"Möjlig konsekvens efter valt tidsfönster.":
      "Möjlig följdeffekt enligt antagna beroenden."));
   timeline.append(section);
  }
  const blockedLabels=[...new Set(result.blocked.map(x=>model.safeguards.find(y=>y.id===x.barrier)?.name).filter(Boolean))];
  $("blocked").textContent=blockedLabels.length
    ?"Modellens antagna brytpunkter: "+blockedLabels.join(" · ")+". Skyddens verkliga effektivitet är inte verifierad."
    :"Inga skyddslager valda. Visningen är ett worst-case-orienterat, förenklat beroendescenario.";
 }
 pick.addEventListener("change",()=>{controls();render()});
 range.addEventListener("input",render);
 controls();render();
})(globalThis);