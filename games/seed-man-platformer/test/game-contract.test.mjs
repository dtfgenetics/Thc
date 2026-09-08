import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateProductionGameContract } from '../src/systems/game-contract.mjs';

const read=(path)=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url),'utf8'));
const campaign=read('../data/campaign-20-v1.json');
const levels=read('../data/levels-20-v1.json');
const bosses=read('../data/boss-catalog-v1.json');
const enemies=read('../data/enemy-catalog-v1.json');
const manifest=read('../data/seed-man-art-manifest-v1.json');
assert.equal(validateProductionGameContract({campaign,levels,bosses,enemies,manifest}),true);
console.log('Seed Man production game contract OK');
