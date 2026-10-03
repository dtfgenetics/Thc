#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=process.cwd();const input=path.join(root,'data/research/pilots/feral-cannabis-prjna1206134-run-batch-v1.json');const out=path.join(root,'site/public-route-patch/data/research/evidence/latest.json');
const r=spawnSync(process.execPath,['scripts/export-tools-research-evidence.mjs',input,out],{cwd:root,encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr||r.stdout);const d=JSON.parse(fs.readFileSync(out,'utf8'));if(d.schema!=='thc-research-evidence-dataset'||d.version!==1||!d.records?.length)throw new Error('public evidence artifact failed contract');console.log('public research evidence artifact: '+d.records.length+' records');
