import test from 'node:test';
import assert from 'node:assert/strict';
import {termsForQuery,searchLessons} from '../site/public-route-patch/learn/search/thc-lesson-query-v1.mjs';

const lessons=[
 {id:'THC-ENC-068',title:'Stomata, Guard Cells, and Gas Exchange',aliases:['leaf stomata']},
 {id:'THC-ENC-044',title:'Water Uptake Pathways Through Roots',aliases:['root water absorption']},
 {id:'THC-ENC-999',title:'Unrelated Crop Planning',aliases:[]}
];
const mock={search(query){
 const q=query.toLowerCase();
 if(q==='how does root water uptake work'||q==='what do stomata do in a leaf') return [];
 return lessons.filter(x=>(x.title+' '+x.aliases.join(' ')).toLowerCase().includes(q)).map(item=>({item}));
}};
test('retains simple Fuse behavior for keyword search',()=>{
 assert.equal(searchLessons(mock,'stomata')[0].id,'THC-ENC-068');
});
test('composes multiple keywords when whole question has zero results',()=>{
 assert.equal(searchLessons(mock,'how does root water uptake work')[0].id,'THC-ENC-044');
 assert.equal(searchLessons(mock,'what do stomata do in a leaf')[0].id,'THC-ENC-068');
});
test('question terms ignore stop words and duplicates',()=>{
 assert.deepEqual(termsForQuery('Why do roots ROOTS absorb water?'),['roots','absorb','water']);
});
