import { test, expect } from '@playwright/test';
const route='http://127.0.0.1:8765/science-labs/';
test.beforeEach(async ({page})=>{await page.goto(route);await expect(page.locator('#title')).toHaveText('Plant anatomy')});
test('all ten laboratories navigate and preserve one panel per type',async ({page})=>{
 for(const topic of ['Living rhizosphere','Diagnostic reasoning','VPD & transpiration','Trichomes & terpenes','Developmental timeline','Genetics & breeding','Light laboratory','Nutrient & water transport','Knowledge-check academy','Plant anatomy']){
   await page.locator('#navigation button', {hasText:topic}).click();
   await expect(page.locator('#title')).toHaveText(topic);
   const scientific=await page.locator('#interactive svg[aria-label^="Conceptual sequence"]').count();
   expect(scientific).toBeLessThanOrEqual(1);
 }
});
test('VPD updates from user measurements, with uncertainty interval',async ({page})=>{
 await page.locator('#navigation button',{hasText:'VPD & transpiration'}).click();
 await expect(page.locator('#answer')).toHaveText('0.97');
 await expect(page.locator('[data-quantitative-lab]')).toContainText('Estimated range:');
 await page.locator('#rh').evaluate(el=>{el.value='70';el.dispatchEvent(new Event('input',{bubbles:true}))});
 await expect(page.locator('#answer')).not.toHaveText('0.97');
 await expect(page.locator('[data-quantitative-lab]')).toContainText('kPa');
});
test('DLI, genetics and diagnostic reasoning respond to controls',async ({page})=>{
 await page.locator('#navigation button',{hasText:'Light laboratory'}).click();
 await expect(page.locator('#dli')).toHaveText('21.60');
 await expect(page.locator('[data-quantitative-lab]')).toContainText('Mean');
 await page.locator('#navigation button',{hasText:'Genetics & breeding'}).click();
 await expect(page.locator('[data-quantitative-lab]')).toContainText('AA: 25.0%');
 await page.locator('#navigation button',{hasText:'Diagnostic reasoning'}).click();
 const exercise=page.locator('[data-differential-tool]');
 await expect(exercise).toBeVisible();
 await exercise.getByRole('button',{name:'Mostly upper canopy'}).click();
 await expect(exercise).toContainText('Hypotheses to investigate');
 await expect(exercise).toContainText('not statistical probabilities');
});
test('mobile has no horizontal viewport overflow and all controls are reachable',async ({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.reload();
 const bounds=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
 expect(bounds.scroll).toBeLessThanOrEqual(bounds.client+2);
 await page.locator('#navigation button',{hasText:'Trichomes & terpenes'}).click();
 await expect(page.locator('#interactive')).toContainText('Plastidial MEP pathway');
});
