/* Read-only live CEMS catalog smoke. Tests actual source schema, no deployment. */
const urls=[
 'https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations-info/?limit=5&offset=0',
 'https://mapping.emergency.copernicus.eu/activations/api/activations/?limit=5&offset=0'
];
let passed=0;
for(const url of urls){
 try{
  const res=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(15000),redirect:'follow'});
  const txt=await res.text();let data;
  try{data=JSON.parse(txt)}catch{data=null}
  const ok=res.ok&&Array.isArray(data?.results)&&data.results.some(r=>r.code&&r.centroid&&r.activationTime);
  console.log(JSON.stringify({endpoint:new URL(url).hostname,status:res.status,url:res.url,bodyBytes:txt.length,
   total:data?.count??null,returned:data?.results?.length??null,firstCode:data?.results?.[0]?.code??null,
   firstCentroid:data?.results?.[0]?.centroid??null,next:data?.next?true:false,valid:ok}));
  if(ok)passed++;
 }catch(error){console.log(JSON.stringify({endpoint:new URL(url).hostname,valid:false,error:String(error?.message||error)}))}
}
console.log('CEMS verified JSON endpoints: '+passed+'/'+urls.length);
if(passed===0)process.exitCode=1;
