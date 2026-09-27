import { describe, expect, it } from 'vitest';
import pixelmatch from './vendor/pixelmatch-7.2.0.js';

function solid(value:number){
  const data=new Uint8ClampedArray(4*4*4);
  for(let i=0;i<data.length;i+=4){data[i]=value;data[i+1]=value;data[i+2]=value;data[i+3]=255}
  return data;
}

describe('vendored Pixelmatch integration',()=>{
  it('reports no mismatches for identical pixels',()=>{
    const a=solid(120);
    const out=new Uint8ClampedArray(a.length);
    expect(pixelmatch(a,a,out,4,4,{threshold:.1})).toBe(0);
  });

  it('reports changed pixels for visibly different images',()=>{
    const a=solid(0);
    const b=solid(255);
    const out=new Uint8ClampedArray(a.length);
    expect(pixelmatch(a,b,out,4,4,{threshold:.1})).toBeGreaterThan(0);
  });
});
