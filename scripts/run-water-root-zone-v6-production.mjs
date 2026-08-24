import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const sourcePath=process.env.WATER_ROOT_ZONE_V6_PUBLISHER||'scripts/publish-wordpress-water-root-zone-v6-final.mjs';
const normalizedPath=process.env.NORMALIZED_WATER_ROOT_ZONE_V6_PUBLISHER||'/tmp/publish-wordpress-water-root-zone-v6-normalized.mjs';
let source=await readFile(sourcePath,'utf8');

const slugNeedle="pageBySlug('water-root-zone')";
const slugMatches=source.split(slugNeedle).length-1;
if(slugMatches!==2) throw new Error(`Expected exactly two Water Root Zone pageBySlug aliases, found ${slugMatches}.`);
source=source.replaceAll(slugNeedle,"pageBySlug('water-ph-ec')");

const visitorNeedle='${site}/learn/water-root-zone/?dtf_wr6=';
if(!source.includes(visitorNeedle)) throw new Error('Could not locate Water Root Zone visitor route for safe normalization.');
source=source.replace(visitorNeedle,'${site}/learn/water-ph-ec/?dtf_wr6=');

const reportNeedle="route:'/learn/water-root-zone/'";
if(!source.includes(reportNeedle)) throw new Error('Could not locate Water Root Zone report route for safe normalization.');
source=source.replace(reportNeedle,"route:'/learn/water-ph-ec/'");

if(!source.includes('data-dtf-topic=\\"water-root-zone\\"')&&!source.includes('data-dtf-topic="water-root-zone"')) throw new Error('Normalized semantic owner marker was unexpectedly lost.');
if(!source.includes('data-dtf-learning-v4=\\"topic-water-root-zone\\"')&&!source.includes('data-dtf-learning-v4="topic-water-root-zone"')) throw new Error('V4 Water Root Zone owner marker was unexpectedly lost.');

await writeFile(normalizedPath,source);
await import(pathToFileURL(normalizedPath).href);
