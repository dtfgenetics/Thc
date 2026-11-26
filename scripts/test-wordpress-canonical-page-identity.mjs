import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectCanonicalPage,isCanonicalPageResponse} from './lib/wordpress-canonical-page-identity.mjs';

test('draft canonical shop owner is reused instead of creating shop-9',()=>{
 const rows=[{id:871,slug:'shop',status:'draft'},{id:73460,slug:'shop-2',status:'publish'},{id:73609,slug:'shop-7',status:'publish'}];
 assert.equal(selectCanonicalPage(rows,'shop')?.id,871);
 assert.equal(isCanonicalPageResponse(rows[0],'shop'),false);
 assert.equal(isCanonicalPageResponse({...rows[0],status:'publish'},'shop'),true);
});
test('auto-suffixed publish response must never count as canonical',()=>{
 assert.equal(isCanonicalPageResponse({id:73610,slug:'shop-8',status:'publish'},'shop'),false);
 assert.equal(selectCanonicalPage([{id:73610,slug:'shop-8',status:'publish'}],'shop'),null);
});
test('duplicate exact slug owners fail closed',()=>{
 assert.throws(()=>selectCanonicalPage([{id:1,slug:'shop'},{id:2,slug:'shop'}],'shop'),/Ambiguous canonical/);
 assert.throws(()=>selectCanonicalPage({},'shop'),/Unexpected WordPress/);
});
test('live publication code requests all statuses and checks returned slug',()=>{
 const source=readFileSync(new URL('./apply-wordpress-public-content-rest.mjs',import.meta.url),'utf8');
 assert.match(source,/status: 'any'/);
 assert.match(source,/const suspendedShopDraft = slug === 'shop' && page\?\.status === 'draft'/);
 assert.match(source,/const preserved = preservePageSlugs\.has\(slug\) \|\| suspendedShopDraft/);
 assert.match(source,/if \(slug === 'shop' && !page\)/);
 assert.match(source,/!suspendedShopDraft/);
 assert.match(source,/return selectCanonicalPage\(body, slug\)/);
 assert.match(source,/await assertPublishedIdentity\(body,slug\)/);
 assert.match(source,/await assertPublishedIdentity\(body,page.slug\)/);
 assert.match(source,/JSON\.stringify\(\{status:'draft'\}\)/);
});
