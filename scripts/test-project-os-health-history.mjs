#!/usr/bin/env node
import assert from 'node:assert/strict';
import {appendHistory} from './append-project-os-health-history.mjs';

const a={generatedAt:'2026-10-06T10:00:00Z',queue:{active:3},failureMemory:{entries:1},blockers:{open:2},slos:{pass:3,fail:1,unknown:3}};
const b={generatedAt:'2026-10-06T11:00:00Z',queue:{active:2},failureMemory:{entries:2},blockers:{open:1},slos:{pass:4,fail:1,unknown:2}};
let h=appendHistory([],a,{maxEntries:2});
h=appendHistory(h,b,{maxEntries:2});
assert.equal(h.length,2);
h=appendHistory(h,{...b,queue:{active:1}},{maxEntries:2});
assert.equal(h.length,2);
assert.equal(h[1].queue.active,1);
h=appendHistory(h,{...a,generatedAt:'2026-10-06T12:00:00Z'},{maxEntries:2});
assert.equal(h.length,2);
assert.equal(h[0].generatedAt,'2026-10-06T11:00:00Z');
console.log('Project OS health history tests passed');
