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
    const passed=actual!==null&&Math.abs(actual-test.expected)<=0.11;
    results.push({viewport:vp.name,case:test.name,expected:test.expected,actual,passed,output:output.slice(0,300)});
    if(!passed)failures.push(vp.name+'/'+test.name+': missing/mismatched calculation');
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
