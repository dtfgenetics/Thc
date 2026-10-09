#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const root='site/wordpress/education/';
const catalog=read(root+'course-catalog-v4.json');
const tech1=read(root+'tech1-courses-public-v1.json');
const tech2=read(root+'tech2-courses-public-v1.json');
assert.equal(catalog.courses.length,15,'Academy must retain all 15 academic courses');
const ids=new Set();
for(const course of catalog.courses){
  assert.ok(typeof course.id==='string'&&!ids.has(course.id),'Course identifiers must be unique');
  ids.add(course.id);
  assert.ok(course.href?.startsWith('/learn/')&&!course.href.startsWith('//'),'Published course requires internal education route');
  assert.equal(course.publicLessonReleaseAvailable,true,course.id+' academic course must be open');
}
for(const [manifest,prefix,expected] of [[tech1,'COURSE-LH-TECH1-',7],[tech2,'COURSE-LH-TECH2-',8]]){
  const matches=catalog.courses.filter(c=>c.id.startsWith(prefix));
  assert.equal(matches.length,expected,'Wrong number of academic courses in '+prefix);
  assert.ok(manifest.program.route.startsWith('/learn/'),'Program route must remain internal');
  for(const entry of manifest.courses){
    assert.ok(ids.has(entry.id),'Public course missing from catalog: '+entry.id);
    assert.ok(matches.some(c=>c.id===entry.id),'Wrong program for '+entry.id);
    assert.ok(catalog.courses.find(c=>c.id===entry.id).href===manifest.program.route+entry.slug+'/','Route drift for '+entry.id);
  }
}
const offerings=catalog.credentialSections.flatMap(section=>section.offerings||[]);
assert.equal(offerings.length,10,'Expected ten professional credential offerings');
for(const offering of offerings)assert.equal(offering.issuanceAvailable,false,'Professional issuance must remain blocked: '+offering.title);
console.log('Academy catalog contract PASS: 15 academic courses, 10 credential issuance gates');
