#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateDefinitionsOfDone,REQUIRED_TYPES} from './validate-project-os-definitions-of-done.mjs';

const canonical=JSON.parse(fs.readFileSync('data/project-os/definitions-of-done.json','utf8'));
assert.deepEqual(validateDefinitionsOfDone(canonical),[]);
assert.equal(Object.keys(canonical.projectTypes).length,9);
assert.deepEqual([...canonical.requiredProjectTypes].sort(),[...REQUIRED_TYPES].sort());

const missing=structuredClone(canonical);
delete missing.projectTypes.game;
assert.ok(validateDefinitionsOfDone(missing).some(x=>x.includes('missing project type game')));

const duplicate=structuredClone(canonical);
duplicate.projectTypes.web_page.criteria.push(structuredClone(duplicate.projectTypes.web_page.criteria[0]));
assert.ok(validateDefinitionsOfDone(duplicate).some(x=>x.includes('duplicate criterion')));

const noEvidence=structuredClone(canonical);
noEvidence.projectTypes.dataset.criteria[0].evidence=[];
assert.ok(validateDefinitionsOfDone(noEvidence).some(x=>x.includes('missing evidence requirements')));

const rogue=structuredClone(canonical);
rogue.projectTypes.rogue={description:'x',criteria:[{id:'x',description:'x',evidence:['x']}]};
assert.ok(validateDefinitionsOfDone(rogue).some(x=>x.includes('undeclared project type rogue')));

console.log('Project OS Definitions of Done fixture tests passed');
