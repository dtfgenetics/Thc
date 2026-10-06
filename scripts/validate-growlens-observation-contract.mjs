#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const pinPath='data/contracts/growlens-observation-contract-pin.json';
const pin=JSON.parse(await readFile(pinPath,'utf8'));
const schemaBytes=await readFile(pin.localSnapshot);
const schema=JSON.parse(schemaBytes.toString('utf8'));
const fixture=JSON.parse(await readFile('data/contracts/growlens-scientific-observation-fixture-v1.json','utf8'));

const gitBlobSha=createHash('sha1')
  .update(Buffer.from(`blob ${schemaBytes.length}\0`,'utf8'))
  .update(schemaBytes)
  .digest('hex');

const errors=[];
if(pin.upstreamRepository!=='dtfgenetics/Thc-dataset')errors.push('upstream repository mismatch');
if(pin.upstreamPath!=='dataset/schema/scientific-observation.schema.json')errors.push('upstream path mismatch');
if(pin.upstreamGitBlobSha!==gitBlobSha)errors.push(`schema blob pin mismatch: expected ${pin.upstreamGitBlobSha}, got ${gitBlobSha}`);
if(schema.$id!==pin.schemaId)errors.push('schema $id mismatch');
if(schema.title!=='THC Scientific Observation v1')errors.push('unexpected scientific observation schema title');
const required=new Set(schema.required||[]);
for(const key of ['observation_id','subject','observed_property','method','measurement','provenance','review_state']){
  if(!required.has(key))errors.push(`schema missing required field ${key}`);
  if(!(key in fixture))errors.push(`fixture missing required field ${key}`);
}
if(!/^OBS-[A-Za-z0-9._:-]+$/.test(fixture.observation_id||''))errors.push('fixture observation_id is invalid');
if(!Number.isFinite(Date.parse(fixture.observed_at)))errors.push('fixture observed_at is invalid');
if(typeof fixture.measurement?.original_value!=='number'||!Number.isFinite(fixture.measurement.original_value))errors.push('fixture original_value must be finite');
if(typeof fixture.measurement?.original_unit!=='string'||!fixture.measurement.original_unit)errors.push('fixture original_unit is required');
if(fixture.measurement?.derived!==false)errors.push('GrowLens compatibility fixture must preserve copied measurement as non-derived');
if(fixture.provenance?.source_type!=='derived')errors.push('adapter provenance must identify transformed envelope origin');
if(fixture.review_state!=='raw')errors.push('new GrowLens scientific observations must begin raw');
if(errors.length)throw new AggregateError(errors.map(message=>new Error(message)),`GrowLens scientific observation contract failed with ${errors.length} finding(s)`);
console.log(`GrowLens scientific observation contract pinned and compatible: ${pin.upstreamRepository}@blob:${gitBlobSha}`);
