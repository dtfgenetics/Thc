import {dliFromPpfd,ppfdFromDli,integrateDli} from './thc-cultivation-math-v1.mjs';

export function calculateStableLight({ppfd,hours,targetDli=null}){
 const dli=dliFromPpfd(ppfd,hours);
 const requiredPpfd=targetDli===null||targetDli===''?null:ppfdFromDli(targetDli,hours);
 return {dli,requiredPpfd};
}

export function calculateVariableLight(blocks){
 const segments=blocks.map(block=>({ppfd:Number(block.ppfd),hours:Number(block.hours)})).filter(block=>Number.isFinite(block.ppfd)&&block.ppfd>=0&&Number.isFinite(block.hours)&&block.hours>=0&&block.hours<=24);
 const hours=segments.reduce((sum,block)=>sum+block.hours,0);
 return {dli:segments.length?integrateDli(segments):0,hours,segments};
}

export function dliRangeForMap(values,hours){
 const nums=values.map(Number).filter(Number.isFinite).filter(value=>value>=0);
 if(!nums.length)return null;
 return {min:dliFromPpfd(Math.min(...nums),hours),max:dliFromPpfd(Math.max(...nums),hours)};
}
