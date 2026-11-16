import {dliFromPpfd,ppfdFromDli,integrateDli} from './thc-cultivation-math-v1.mjs';

export function calculateStableLight({ppfd,hours,targetDli=null}){
 const dli=dliFromPpfd(ppfd,hours);
 const requiredPpfd=targetDli===null||targetDli===''?null:ppfdFromDli(targetDli,hours);
 return {dli,requiredPpfd};
}

export function calculateVariableLight(blocks){
 const source=Array.isArray(blocks)?blocks:[];
 const isEntered=value=>value!==null&&value!==undefined&&String(value).trim()!=='';
 const invalidSegments=source.filter(block=>!block||!isEntered(block.ppfd)||!isEntered(block.hours)||!Number.isFinite(Number(block.ppfd))||Number(block.ppfd)<0||Number(block.ppfd)>3000||!Number.isFinite(Number(block.hours))||Number(block.hours)<0||Number(block.hours)>24).length;
 const segments=source.filter(block=>block&&isEntered(block.ppfd)&&isEntered(block.hours)&&Number.isFinite(Number(block.ppfd))&&Number(block.ppfd)>=0&&Number(block.ppfd)<=3000&&Number.isFinite(Number(block.hours))&&Number(block.hours)>=0&&Number(block.hours)<=24).map(block=>({ppfd:Number(block.ppfd),hours:Number(block.hours)}));
 const hours=segments.reduce((sum,block)=>sum+block.hours,0);
 const validDay=invalidSegments===0&&hours<=24;
 return {dli:segments.length&&validDay?integrateDli(segments):null,hours,segments,validDay,invalidSegments};
}

export function dliRangeForMap(values,hours){
 const nums=values.map(Number).filter(Number.isFinite).filter(value=>value>=0);
 if(!nums.length)return null;
 return {min:dliFromPpfd(Math.min(...nums),hours),max:dliFromPpfd(Math.max(...nums),hours)};
}
