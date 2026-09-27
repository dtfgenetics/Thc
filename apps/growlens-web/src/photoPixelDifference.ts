import pixelmatch from './vendor/pixelmatch-7.2.0.js';

export type PixelDifferenceResult = {
  width: number;
  height: number;
  mismatchPixels: number;
  mismatchPercent: number;
  imageData: ImageData;
};

async function loadImage(source:string):Promise<HTMLImageElement>{
  return await new Promise((resolve,reject)=>{
    const image=new Image();
    image.decoding='async';
    image.onload=()=>resolve(image);
    image.onerror=reject;
    image.src=source;
  });
}

function drawNormalized(image:HTMLImageElement,width:number,height:number):ImageData{
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw new Error('Canvas comparison is unavailable.');
  ctx.fillStyle='#000';
  ctx.fillRect(0,0,width,height);
  const scale=Math.min(width/image.naturalWidth,height/image.naturalHeight);
  const drawWidth=image.naturalWidth*scale;
  const drawHeight=image.naturalHeight*scale;
  ctx.drawImage(image,(width-drawWidth)/2,(height-drawHeight)/2,drawWidth,drawHeight);
  return ctx.getImageData(0,0,width,height);
}

export async function buildPixelDifference(first:string,second:string,width=480,height=360):Promise<PixelDifferenceResult>{
  const [a,b]=await Promise.all([loadImage(first),loadImage(second)]);
  const firstData=drawNormalized(a,width,height);
  const secondData=drawNormalized(b,width,height);
  const output=new ImageData(width,height);
  const mismatchPixels=pixelmatch(firstData.data,secondData.data,output.data,width,height,{
    threshold:.12,
    includeAA:false,
    alpha:.25,
  });
  return{
    width,height,mismatchPixels,
    mismatchPercent:Math.round((mismatchPixels/(width*height))*1000)/10,
    imageData:output,
  };
}
