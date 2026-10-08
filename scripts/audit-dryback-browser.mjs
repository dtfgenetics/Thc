import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const origin=(process.env.DTF_ORIGIN||'https://dtfseeds.com').replace(/\/$/,'');
const cases=[
{name:'baseline',dry:2,wet:5,current:4.1,expected:30},
{name:'high',dry:2,wet:5,current:5,expected:0},
{name:'low',dry:2,wet:5,current:2,expected:100}
];
const viewports=[{name:'mobile',width:390,height:844},{name:'tablet',width:820,height:1180},{name:'desktop',width:1440,height:900}];
const results=[],failures=[];
const browser=await chromium.launch({headless:true});
try {
 for(const vp of viewports){
  const page=await browser.newPage({viewport:{width:vp.width,height:vp.height}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   const response=await page.goto(origin+'/dryback-lab/',{waitUntil:'domcontentloaded',timeout:30000});
   if(!response||response.status()>=400)throw Error('HTTP '+(response?.status()??'none'));
   await page.locator('#dryOut').waitFor({state:'visible',timeout:15000});
   for(const test of cases){
    for(const id of ['dry','wet','current'])await page.locator('#'+id).fill(String(test[id]));
    await page.locator('#hours').fill('8');
    await page.locator('#inputVol').fill('1000');
    await page.locator('#runoff').fill('150');
    await page.locator('#mediaVol').fill('3785');
    await page.locator('#targetDryLow').fill('10');
    await page.locator('#targetDryHigh').fill('25');
    const output=await page.locator('#dryOut').innerText();
    const match=output.match(/(\d+(?:\.\d+)?)%\s+(?:weight-span|sensor-scale)\s+dryback/i);
    const actual=match?Number(match[1]):null;
    const rateMatch=output.match(/(\d+(?:\.\d+)?) percentage points\/hour/);\n    const shotMatch=output.match(/(\d+(?:\.\d+)?)% shot size/);\n    const drainMatch=output.match(/(\d+(?:\.\d+)?)% measured drainage/);\n    const rate=rateMatch?Number(rateMatch[1]):null,shot=shotMatch?Number(shotMatch[1]):null,drain=drainMatch?Number(drainMatch[1]):null;\n    const passed=actual!==null&&Math.abs(actual-test.expected)<=0.11&&rate!==null&&Math.abs(rate-test.expected/8)<=0.06&&shot!==null&&Math.abs(shot-(1000/3785*100))<=0.11&&drain!==null&&Math.abs(drain-15)<=0.11;
    results.push({viewport:vp.name,case:test.name,expected:test.expected,actual,rate,shot,drain,passed,output:output.slice(0,300)});
    if(!passed)failures.push(vp.name+'/'+test.name+': missing/mismatched calculation');
   }
   for(const negative of [{name:'zero-hours',field:'hours',value:'0'},{name:'inverted-reference',field:'wet',value:'1'},{name:'inverted-target',field:'targetDryLow',value:'30'}]){
    for(const [id,value] of Object.entries({dry:'2',wet:'5',current:'4.1',hours:'8',targetDryLow:'10',targetDryHigh:'25'}))await page.locator('#'+id).fill(value);
    await page.locator('#'+negative.field).fill(negative.value);
    const disabled=await page.locator('#saveDry').isDisabled();
    const invalid=(await page.locator('#dryOut').innerText()).includes('Enter a valid dryback event');
    const passed=disabled&&invalid;
    results.push({viewport:vp.name,case:negative.name,passed,saveDisabled:disabled,invalidMessage:invalid});
    if(!passed)failures.push(vp.name+'/'+negative.name+': invalid measurement was accepted');
   }
   const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-window.innerWidth));
   if(overflow>3)failures.push(vp.name+': horizontal overflow '+overflow+'px');
   if(errors.length)failures.push(vp.name+': runtime exceptions '+errors.join('; '));
  }catch(e){failures.push(vp.name+': '+String(e))}
  finally{await page.close()}
 }
}finally{await browser.close()}
const report={origin,generatedAt:new Date().toISOString(),results,failures,passed:failures.length===0};
await fs.writeFile('dryback-browser-results.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,checked:results.length,failures},null,2));
if(!report.passed)process.exitCode=1;
