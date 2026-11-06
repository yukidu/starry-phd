/** Starry Location: no identity, media, or user history is stored in shared cache. */
export const SETTINGS=Object.freeze({
 version:1, language:'zh', maxCreditsRolling24h:2500, reverseCredits:1,
 reuseMeters:100, villageReuseMeters:20, fineReuseMeters:15,
 minAccuracyMeters:0, maxAccuracyMeters:100, maxApproxAccuracyMeters:30000,
 approximateReuseMeters:75, approximateTtlMs:7*86400000, gridScale:1000,
 administrativeTtlMs:30*86400000, fineTtlMs:7*86400000,
 negativeTtlMs:15*60000, maxSharedRows:4500, maxCandidates:64,
 providerTimeoutMs:7500, maxProviderRequestsPerAttempt:1,
});
export const ATTRIBUTION=Object.freeze({geoapify:'https://www.geoapify.com/',
 openstreetmap:'https://www.openstreetmap.org/copyright',
 text:'Powered by Geoapify · © OpenStreetMap contributors'});
const finite=(n)=>typeof n==='number'&&Number.isFinite(n);
export function validateFix(fix,cfg=SETTINGS){
 if(!fix||!finite(fix.lat)||!finite(fix.lon)||Math.abs(fix.lat)>90||Math.abs(fix.lon)>180)
  throw Error('LOCATION_INVALID_COORDINATES');
 const position_mode=fix.position_mode??'precise';
 if(!['precise','approximate','manual'].includes(position_mode))throw Error('LOCATION_MODE_INVALID');
 const max=position_mode==='approximate'?cfg.maxApproxAccuracyMeters:cfg.maxAccuracyMeters;
 if(!finite(fix.accuracy_m)||fix.accuracy_m<cfg.minAccuracyMeters||fix.accuracy_m>max)
  throw Error('LOCATION_ACCURACY_INSUFFICIENT');
 // Manual marker is a chosen coordinate, not an actual GPS accuracy reading.
 if(position_mode==='manual'&&fix.accuracy_m!==0)throw Error('LOCATION_MANUAL_ACCURACY_INVALID');
 if(!Number.isSafeInteger(fix.captured_at_ms)||fix.captured_at_ms<=0)
  throw Error('LOCATION_MISSING_FIX_TIME');
 return {lat:fix.lat,lon:fix.lon,accuracy_m:fix.accuracy_m,
   captured_at_ms:fix.captured_at_ms,position_mode};
}
export function recentFix(fix,now=Date.now(),maxAge=5*60000){
 if(fix.captured_at_ms>now+30000||fix.captured_at_ms<=0)return false;
 // User-initiated Wi-Fi approximate / manual locations are permitted even if very old.
 // The output must visibly disclose that the coordinates may not be current.
 if(['approximate','manual'].includes(fix.position_mode))return true;
 return now-fix.captured_at_ms<=maxAge;
}
export function haversineMeters(a,b){
 const r=Math.PI/180,da=(b.lat-a.lat)*r,db=(b.lon-a.lon)*r;
 const q=Math.sin(da/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(db/2)**2;
 return 6371008.8*2*Math.asin(Math.min(1,Math.sqrt(q)));
}
export function gridCell({lat,lon},cfg=SETTINGS){return `${Math.floor(lat*cfg.gridScale)}:${Math.floor(lon*cfg.gridScale)}`;}
export function neighborCells(fix,cfg=SETTINGS){
 const x=Math.floor(fix.lat*cfg.gridScale),y=Math.floor(fix.lon*cfg.gridScale);
 const result=[];for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++)result.push(`${x+dx}:${y+dy}`);
 return result;
}
export function precisionLevel(resultType,parts={}){
 if(['building','amenity','street','poi'].includes(resultType))return 'fine';
 if(parts.locality||parts.hamlet||parts.neighbourhood||parts.name)return 'locality';
 if(parts.village||parts.suburb)return 'village';return 'administrative';
}
export function applicable(entry,fix,now=Date.now(),cfg=SETTINGS,{allowStale=false}={}){
 if(!entry||entry.version!==cfg.version||!entry.label||!entry.reference)return false;
 if(!allowStale&&entry.expires_at_ms<=now)return false;
 const d=haversineMeters(fix,entry.reference);
 const lookupMode=fix.position_mode||'precise';
 const entryMode=entry.position_mode||'precise';
 if(lookupMode==='approximate'||entryMode==='approximate'){
  if(lookupMode!=='approximate'||entryMode!=='approximate'||entry.level!=='administrative')return false;
  // Only reuse very near-identical Wi-Fi reference points, never infer shared village boundaries.
  const tolerance=Math.min(cfg.approximateReuseMeters,Math.max(10,fix.accuracy_m*0.025));
  const previous=entry.reference.accuracy_m||0;
  return d<=tolerance&&Math.abs(fix.accuracy_m-previous)<=Math.max(100,previous*0.3);
 }
 const radius=entry.level==='fine'?cfg.fineReuseMeters:entry.level==='village'||entry.level==='locality'?cfg.villageReuseMeters:cfg.reuseMeters;
 const uncertainty=fix.accuracy_m+(entry.reference.accuracy_m||0);
 if(uncertainty>=radius||d+uncertainty>=radius)return false;
 if(entry.level==='fine'&&entry.provider_distance_m>radius)return false;
 return true;
}
const clean=v=>typeof v==='string'?v.trim().slice(0,120):'';
export function parseGeoapify(payload,fix,now=Date.now(),cfg=SETTINGS){
 const p=payload?.results?.[0]||payload?.features?.[0]?.properties;
 if(!p)return null;
 // Use only fields returned by Geoapify: never synthesize a village or traditional hamlet.
 const state=clean(p.state),county=clean(p.county),city=clean(p.city)||clean(p.town)||clean(p.municipality),
   village=clean(p.suburb)||clean(p.village)||clean(p.neighbourhood),
   locality=clean(p.locality)||clean(p.hamlet),landmark=clean(p.name),
   type=clean(p.result_type),dist=finite(p.distance)?p.distance:null;
 const top=/[縣市]$/.test(county)?county:/[縣市]$/.test(state)?state:(county||state||city),parts=[];
 for(const part of [top,city,village])if(part&&!parts.includes(part))parts.push(part);
 const local=locality||((type==='amenity'||type==='building')&&(dist===null||dist<=200)?landmark:'');
 // Traditional settlement/landmark is displayed separately, never fabricated.
 const approximate=fix.position_mode==='approximate';
 const label=approximate
  ?[top,city].filter((part,i,list)=>part&&list.indexOf(part)===i).join('')+'附近（大略位置）'
  :parts.join('')+(local?'・'+local+'附近':'');
 if(!label||label==='附近（大略位置）')return null;
 const level=approximate?'administrative':precisionLevel(type,{locality,hamlet:clean(p.hamlet),village,suburb:village,name:local});
 const providerDistance=dist===null?null:Math.max(0,dist);
 return {version:cfg.version,label,level,position_mode:fix.position_mode||'precise',
  approximate,components:{state,county,city,village:approximate?'':village,locality:approximate?'':locality,landmark:approximate?'':local},
  reference:{lat:fix.lat,lon:fix.lon,accuracy_m:fix.accuracy_m},provider_distance_m:providerDistance,
  source:'geoapify',attribution:{...ATTRIBUTION,datasource:clean(p.datasource?.attribution),
   datasource_url:typeof p.datasource?.url==='string'&&p.datasource.url.startsWith('https://')?p.datasource.url.slice(0,200):''},queried_at_ms:now,
  expires_at_ms:now+(approximate?cfg.approximateTtlMs:(level==='fine'||level==='locality'?cfg.fineTtlMs:cfg.administrativeTtlMs))};
}
export function providerUrl(fix,key){
 const url=new URL('https://api.geoapify.com/v1/geocode/reverse');
 url.searchParams.set('lat',String(fix.lat));url.searchParams.set('lon',String(fix.lon));
 url.searchParams.set('lang','zh');url.searchParams.set('limit','1');url.searchParams.set('format','json');
 url.searchParams.set('apiKey',key);return url.toString();
}
export function quotaUsed(rows,now=Date.now()){return rows.reduce((n,x)=>x.ts>now-86400000&&x.ts<=now?n+x.cost:n,0);}
export function cacheDecision(rows,fix,now=Date.now(),cfg=SETTINGS){
 let found=null,closest=Infinity,negative=false;
 for(const row of rows){if(row.negative){
   if(row.expires_at_ms>now&&haversineMeters(fix,row.reference)+fix.accuracy_m<10)negative=true;
   continue;}
  if(applicable(row,fix,now,cfg)){const d=haversineMeters(fix,row.reference);if(d<closest){found=row;closest=d;}}
 }
 if(found)return {status:'hit',entry:found};
 if(negative)return {status:'negative'};
 // Expired cached names are advisory, never silently represented as precise current locations.
 for(const row of rows){if(!row.negative&&applicable(row,fix,now,cfg,{allowStale:true})){
   const d=haversineMeters(fix,row.reference);if(d<closest){found=row;closest=d;}}
 }
 return found?{status:'stale',entry:found}:{status:'miss'};
}
