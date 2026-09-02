import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const sourcePath = process.env.LEARNING_V3_BASE_PUBLISHER || 'scripts/rebuild-wordpress-learning-experience-v3.mjs';
const outputPath = process.env.LEARNING_V3_ATLAS_PUBLISHER || '/tmp/rebuild-wordpress-learning-experience-v3-atlas.mjs';

let source = await readFile(sourcePath, 'utf8');
const original = "${btn('/learn/start-here/', 'Start here', true)}${btn('/learn/search/', 'Search education', false)}${btn('/learn/infographics/', 'Browse visuals', false)}";
const atlasAware = "${btn('/learn/atlas/', 'Open the THC Living Plant Atlas', true)}${btn('/learn/start-here/', 'Start here', false)}${btn('/learn/search/', 'Search education', false)}${btn('/learn/infographics/', 'Browse visuals', false)}";

const originalCount = source.split(original).length - 1;
const atlasCount = source.split(atlasAware).length - 1;
if (originalCount === 1) source = source.replace(original, atlasAware);
else if (atlasCount !== 1) throw new Error(`Expected one canonical Learn hero action group, found original=${originalCount}, atlasAware=${atlasCount}`);

for (const marker of [
  'data-dtf-layout="learn-v3"',
  "btn('/learn/atlas/', 'Open the THC Living Plant Atlas', true)",
  "btn('/learn/start-here/', 'Start here', false)",
]) {
  if (!source.includes(marker)) throw new Error(`Prepared Learning V3 publisher is missing ${marker}`);
}

await writeFile(outputPath, source, 'utf8');
console.log(JSON.stringify({ sourcePath, outputPath, atlasCta: true }));
