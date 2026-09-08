export function createDiagnostics(){
  const counters=new Map();
  const timings=new Map();
  return Object.freeze({
    inc(key,amount=1){counters.set(key,(counters.get(key)||0)+amount);},
    setTiming(key,value){timings.set(key,value);},
    snapshot(){return Object.freeze({counters:Object.fromEntries(counters),timings:Object.fromEntries(timings)});}
  });
}
