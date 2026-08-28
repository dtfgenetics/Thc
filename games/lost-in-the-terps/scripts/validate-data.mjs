import fs from 'node:fs';
import assert from 'node:assert/strict';
const canonical=JSON.parse(fs.readFileSync(new URL('../data/puzzles.json',import.meta.url),'utf8'));
const publicData=JSON.parse(fs.readFileSync(new URL('../../../site/public-route-patch/games/lost-in-the-terps/data/puzzles.json',import.meta.url),'utf8'));
assert.deepEqual(publicData,canonical,'Public puzzle data drifted from canonical source');
assert.equal(canonical.schemaVersion,1);assert.equal(canonical.puzzles.length,3);
const ids=new Set();
function lineCoords(start,end){const [r1,c1]=start,[r2,c2]=end,dr=Math.sign(r2-r1),dc=Math.sign(c2-c1),steps=Math.max(Math.abs(r2-r1),Math.abs(c2-c1));assert.ok(dr===0||dc===0||Math.abs(r2-r1)===Math.abs(c2-c1),'Word must be horizontal, vertical, or diagonal');return Array.from({length:steps+1},(_,i)=>[r1+dr*i,c1+dc*i]);}
for(const puzzle of canonical.puzzles){assert.ok(!ids.has(puzzle.id),`Duplicate puzzle ${puzzle.id}`);ids.add(puzzle.id);assert.equal(puzzle.grid.length,puzzle.size);for(const row of puzzle.grid)assert.equal(row.length,puzzle.size);assert.equal(puzzle.words.length,8);for(const item of puzzle.words){const coords=lineCoords(item.start,item.end);assert.equal(coords.length,item.word.length,`${item.word} coordinate length mismatch`);const letters=coords.map(([r,c])=>{assert.ok(r>=0&&c>=0&&r<puzzle.size&&c<puzzle.size);return puzzle.grid[r][c]}).join('');assert.equal(letters,item.word,`${item.word} does not match stored grid`);}}
console.log(`Lost in the Terps data valid: ${canonical.puzzles.length} missions, ${canonical.puzzles.reduce((n,p)=>n+p.words.length,0)} hidden words.`);
