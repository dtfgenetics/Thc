const finite=n=>{const v=Number(n);return Number.isFinite(v)?v:null};
export function normalizedPoint({x,y,width,height}={}){
  const nx=finite(x),ny=finite(y),w=finite(width),h=finite(height);
  if(nx===null||ny===null||w===null||h===null||w<=0||h<=0)return null;
  return {x:Math.max(0,Math.min(1,nx/w)),y:Math.max(0,Math.min(1,ny/h))};
}
export function displayPixelDistance(a,b,width,height){
  const w=finite(width),h=finite(height);
  if(!a||!b||w===null||h===null||w<=0||h<=0)return NaN;
  return Math.hypot((Number(b.x)-Number(a.x))*w,(Number(b.y)-Number(a.y))*h);
}
export function calibrationScale({a,b,width,height,knownDistance}={}){
  const known=finite(knownDistance),px=displayPixelDistance(a,b,width,height);
  if(known===null||known<=0||!Number.isFinite(px)||px<=0)return NaN;
  return known/px;
}
export function calibratedMeasurement({a,b,width,height,calibration}={}){
  const px=displayPixelDistance(a,b,width,height);
  const scale=calibrationScale({...calibration,width,height});
  if(!Number.isFinite(px)||!Number.isFinite(scale))return NaN;
  return px*scale;
}
