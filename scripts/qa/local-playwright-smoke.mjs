import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.LOCAL_PREVIEW_URL || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
try {
  for (const viewport of [{width:1280,height:800},{width:390,height:844}]) {
    const page = await browser.newPage({viewport});
    const response = await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
    assert.equal(response?.status(),200,`HTTP 200 required for ${base}`);
    await page.locator('body').waitFor({state:'visible'});
    const visibleText = (await page.locator('body').innerText()).trim();
    assert.ok(visibleText.length>20,`App rendered insufficient content at ${viewport.width}px`);
    const width = await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    assert.ok(width.scroll<=width.client+2,`Horizontal overflow at ${viewport.width}px: ${JSON.stringify(width)}`);
    console.log(JSON.stringify({route:base,viewport:viewport.width,status:response.status(),textLength:visibleText.length,overflow:false}));
    await page.close();
  }
} finally { await browser.close(); }
