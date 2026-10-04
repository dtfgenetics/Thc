import {dliFromPpfd,ppfdFromDli,integrateDli} from './thc-cultivation-math-v1.mjs';

export function calculateStableLight({ppfd,hours,targetDli=null}){
 const dli=dliFromPpfd(ppfd,hours);
 const requiredPpfd=targetDli===null||targetDli===''?null:ppfdFromDli(targetDli,hours);
 return {dli,requiredPpfd};
}

export function calculateVariableLight(blocks){
 const segments=(Array.isArray(blocks)?blocks:[]).map(block=>({ppfd:Number(block.ppfd),hours:Number(block.hours)})).filter(block=>Number.isFinite(block.ppfd)&&block.ppfd>=0&&block.ppfd<=3000&&Number.isFinite(block.hours)&&block.hours>=0&&block.hours<=24);
 const hours=segments.reduce((sum,block)=>sum+block.hours,0);
 const validDay=hours<=24;
 return {dli:segments.length&&validDay?integrateDli(segments):null,hours,segments,validDay};
}

export function dliRangeForMap(values,hours){
 const nums=values.map(Number).filter(Number.isFinite).filter(value=>value>=0);
 if(!nums.length)return null;
 return {min:dliFromPpfd(Math.min(...nums),hours),max:dliFromPpfd(Math.max(...nums),hours)};
}
