const assert=require("assert"),R=require("../route-pattern.js");
const start=Date.parse("2026-09-02T08:00:00Z"),point=(lat,lon,i,extra={})=>({timestamp:start+i*60000,lat,lon,speed:300,track:0,hex:"abc123",...extra});
const transit=Array.from({length:31},(_,i)=>point(55+i*.035,15+i*.025,i));
const orbit=Array.from({length:49},(_,i)=>{const a=i/48*Math.PI*4;return point(57+Math.sin(a)*.18,20+Math.cos(a)*.18,i)});
const racetrack=[];for(let lap=0;lap<3;lap++){for(let i=0;i<8;i++)racetrack.push(point(56.8,19+i*.04,racetrack.length));for(let i=0;i<4;i++){const a=Math.PI/2-i*Math.PI/3;racetrack.push(point(56.8+.04*Math.cos(a),19.28+.04*Math.sin(a),racetrack.length))}for(let i=0;i<8;i++)racetrack.push(point(56.84,19.28-i*.04,racetrack.length));for(let i=0;i<4;i++){const a=-Math.PI/2-i*Math.PI/3;racetrack.push(point(56.8+.04*Math.cos(a),19+.04*Math.sin(a),racetrack.length))}}
const passes=[];for(let lap=0;lap<4;lap++){const reverse=lap%2===1;for(let i=0;i<10;i++){const x=reverse?9-i:i;passes.push(point(55.1+(lap%2)*.004,20+x*.035,passes.length))}}
const loiter=Array.from({length:46},(_,i)=>point(59+Math.sin(i*.7)*.025,13+Math.sin(i*1.3)*.025,i));
const holding=Array.from({length:25},(_,i)=>{const a=i/24*Math.PI*2;return point(58+Math.sin(a)*.08,17+Math.cos(a)*.08,i)});
assert.equal(R.detect(transit).pattern,"TRANSIT");
assert.equal(R.detect(orbit).pattern,"ORBIT");
assert.equal(R.detect(racetrack).pattern,"RACETRACK");
assert.equal(R.detect(passes).pattern,"REPEATED PASS");
assert.equal(R.detect(loiter).pattern,"LOITER");
assert.equal(R.detect(holding).pattern,"HOLDING / CIRCULAR");
assert(R.detect(transit.slice(0,4)).confidence<=35,"short tracks must remain low confidence");
assert.equal(R.context({role:"ISR"},R.detect(passes)).interest,18);
assert.equal(R.context({role:"TANKER"},R.detect(racetrack)).evidence,"INFERRED");
assert(R.simplify(transit,.001).length<=transit.length);
for(const fixture of [transit,orbit,racetrack,passes,loiter,holding])assert(R.detect(fixture).confidence<=100);
console.log("route pattern tests passed");
