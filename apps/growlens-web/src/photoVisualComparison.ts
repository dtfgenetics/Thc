export function hammingDistance(first:string, second:string):number|null {
  if (!first || first.length !== second.length) return null;
  let distance=0;
  for(let i=0;i<first.length;i++) if(first[i]!==second[i]) distance++;
  return distance;
}

export function similarityPercent(first:string, second:string):number|null {
  const distance=hammingDistance(first,second);
  if(distance===null)return null;
  return Math.round((1-(distance/first.length))*100);
}

export async function differenceHashFromUrl(source:string):Promise<string|null> {
  if(!source)return null;
  try{
    const image=await new Promise<HTMLImageElement>((resolve,reject)=>{
      const el=new Image();
      el.decoding='async';
      el.onload=()=>resolve(el);
      el.onerror=reject;
      el.src=source;
    });
    const canvas=document.createElement('canvas');
    canvas.width=9;canvas.height=8;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)return null;
    ctx.drawImage(image,0,0,9,8);
    const data=ctx.getImageData(0,0,9,8).data;
    let bits='';
    for(let y=0;y<8;y++){
      for(let x=0;x<8;x++){
        const i=(y*9+x)*4;
        const j=(y*9+x+1)*4;
        const left=(.2126*data[i])+(.7152*data[i+1])+(.0722*data[i+2]);
        const right=(.2126*data[j])+(.7152*data[j+1])+(.0722*data[j+2]);
        bits+=left>right?'1':'0';
      }
    }
    return bits;
  }catch{return null}
}

export async function compareImageSources(first:string,second:string):Promise<{similarity:number|null;nearDuplicate:boolean}>{
  const [a,b]=await Promise.all([differenceHashFromUrl(first),differenceHashFromUrl(second)]);
  if(!a||!b)return{similarity:null,nearDuplicate:false};
  const similarity=similarityPercent(a,b);
  return{similarity,nearDuplicate:similarity!==null&&similarity>=94};
}
