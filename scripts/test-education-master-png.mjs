#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./validate-education-visual-production-queue.mjs', import.meta.url), 'utf8');
const start = source.indexOf('function validateMasterPng(');
const end = source.indexOf('\nconst queue=readJson(', start);
assert.ok(start >= 0 && end > start, 'PNG validation function must be present');
const validate = vm.runInNewContext(source.slice(start, end) + '\nvalidateMasterPng', {
  fs: {
    openSync: () => 1,
    closeSync: () => {},
    readSync: (_fd, buffer, offset, length, position) => {
      const available = Math.max(0, Math.min(length, current.length - position));
      current.copy(buffer, offset, position, position + available);
      return available;
    },
  },
  Buffer,
  fail: message => { throw new Error(message); },
});
let current;
function png({width=2048,height=2048,depth=8,type=6,compression=0,filter=0,interlace=0,chunkLength=13}={}) {
  const bytes = Buffer.alloc(29);
  Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);
  bytes.writeUInt32BE(chunkLength,8);
  bytes.write('IHDR',12,'ascii');
  bytes.writeUInt32BE(width,16);
  bytes.writeUInt32BE(height,20);
  bytes.set([depth,type,compression,filter,interlace],24);
  return bytes;
}
const design={masterMinimumWidthPx:1024,masterMinimumHeightPx:1024};
function accepts(bytes) { current=bytes; assert.doesNotThrow(()=>validate('fixture.png','TEST',design)); }
function rejects(bytes, message) { current=bytes; assert.throws(()=>validate('fixture.png','TEST',design),message); }
accepts(png());
accepts(png({depth:16,type:2,interlace:1}));
const badSignature=png();
badSignature[0]=0;
rejects(badSignature,/valid PNG IHDR header/);
const badChunk=png({chunkLength:14});
rejects(badChunk,/valid PNG IHDR header/);
rejects(png({width:0}),/zero dimensions/);
rejects(png({height:0}),/zero dimensions/);
rejects(png({width:512}),/below the required/);
rejects(png({chunkLength:12}),/IHDR header/);
rejects(png({depth:4,type:6}),/bit depth\/color type/);
rejects(png({type:5}),/bit depth\/color type/);
rejects(png({compression:1}),/compression, filter, or interlace/);
rejects(png({filter:1}),/compression, filter, or interlace/);
rejects(png({interlace:2}),/compression, filter, or interlace/);
rejects(png().subarray(0,25),/truncated IHDR payload/);
console.log('14 PNG master header regression cases passed.');
