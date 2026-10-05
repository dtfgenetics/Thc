const rad=d=>d*Math.PI/180;
const deg=r=>r*180/Math.PI;
const norm=(value,max)=>((value%max)+max)%max;
function dayOfYear(date){
  const d=new Date(date+'T00:00:00Z');
  if(Number.isNaN(d.getTime()))throw new Error('Invalid date');
  const start=Date.UTC(d.getUTCFullYear(),0,0);
  return Math.floor((d.getTime()-start)/86400000);
}
function eventUtcHours({date,latitude,longitude,zenithDeg=90.833,isSunrise}){
  const n=dayOfYear(date),lngHour=longitude/15,t=n+(((isSunrise?6:18)-lngHour)/24),M=(0.9856*t)-3.289;
  let L=M+(1.916*Math.sin(rad(M)))+(0.020*Math.sin(rad(2*M)))+282.634;L=norm(L,360);
  let RA=deg(Math.atan(0.91764*Math.tan(rad(L))));RA=norm(RA,360);
  const lQuadrant=Math.floor(L/90)*90,raQuadrant=Math.floor(RA/90)*90;RA=(RA+(lQuadrant-raQuadrant))/15;
  const sinDec=0.39782*Math.sin(rad(L)),cosDec=Math.cos(Math.asin(sinDec));
  const cosH=(Math.cos(rad(zenithDeg))-(sinDec*Math.sin(rad(latitude))))/(cosDec*Math.cos(rad(latitude)));
  if(cosH>1)return {status:'polar-night',utcHours:null};
  if(cosH<-1)return {status:'polar-day',utcHours:null};
  let H=isSunrise?360-deg(Math.acos(cosH)):deg(Math.acos(cosH));H/=15;
  const T=H+RA-(0.06571*t)-6.622;
  return {status:'ok',utcHours:norm(T-lngHour,24)};
}
export function solarTimes({date,latitude,longitude,utcOffsetHours=0,zenithDeg=90.833}={}){
  const lat=Number(latitude),lon=Number(longitude),offset=Number(utcOffsetHours),zen=Number(zenithDeg);
  if(!Number.isFinite(lat)||lat<-90||lat>90)throw new Error('Latitude must be between -90 and 90 degrees');
  if(!Number.isFinite(lon)||lon<-180||lon>180)throw new Error('Longitude must be between -180 and 180 degrees');
  if(!Number.isFinite(offset)||offset<-14||offset>14)throw new Error('UTC offset must be between -14 and +14 hours');
  if(!Number.isFinite(zen)||zen<=0||zen>=180)throw new Error('Zenith must be between 0 and 180 degrees');
  const rise=eventUtcHours({date,latitude:lat,longitude:lon,zenithDeg:zen,isSunrise:true}),set=eventUtcHours({date,latitude:lat,longitude:lon,zenithDeg:zen,isSunrise:false});
  if(rise.status!=='ok'||set.status!=='ok')return {date,latitude:lat,longitude:lon,utcOffsetHours:offset,status:rise.status===set.status?rise.status:'no-standard-rise-set',sunriseLocalHours:null,sunsetLocalHours:null,daylightHours:rise.status==='polar-day'||set.status==='polar-day'?24:0};
  const sunriseLocalHours=norm(rise.utcHours+offset,24),sunsetLocalHours=norm(set.utcHours+offset,24),daylightHours=norm(sunsetLocalHours-sunriseLocalHours,24);
  return {date,latitude:lat,longitude:lon,utcOffsetHours:offset,status:'ok',sunriseLocalHours,sunsetLocalHours,daylightHours};
}
export function clockFromDecimalHours(hours){
  if(!Number.isFinite(Number(hours)))return null;
  let total=Math.round(norm(Number(hours),24)*60)%1440;
  return String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0');
}
