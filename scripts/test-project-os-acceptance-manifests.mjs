#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateAcceptanceManifests} from './validate-project-os-acceptance-manifests.mjs';

const canonical=JSON.parse(fs.readFileSync('data/project-os/acceptance-manifests.json','utf8'));
assert.deepEqual(validateAcceptanceManifests(canonical),[]);
assert.equal(canonical.domains.length,7);

const duplicate=structuredClone(canonical); duplicate.domains.push(structuredClone(duplicate.domains[0]));
assert.ok(validateAcceptanceManifests(duplicate,{checkSources:false}).some(x=>x.includes('duplicate domain')));

const missingValidators=structuredClone(canonical); missingValidators.domains[0].validators=[];
assert.ok(validateAcceptanceManifests(missingValidators,{checkSources:false}).some(x=>x.includes('missing validators')));

const missingSource=structuredClone(canonical); missingSource.domains[0].sources=['definitely/not/here.json'];
assert.ok(validateAcceptanceManifests(missingSource).some(x=>x.includes('missing source')));

const badLive=structuredClone(canonical); badLive.domains[0].liveRequired='yes';
assert.ok(validateAcceptanceManifests(badLive,{checkSources:false}).some(x=>x.includes('liveRequired must be boolean')));

console.log('Project OS acceptance-manifest fixture tests passed');
