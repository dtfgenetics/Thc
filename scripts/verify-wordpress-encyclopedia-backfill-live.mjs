import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';

const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const inputPath = process.argv[2] || process.env.ENCYCLOPEDIA_VERIFY_INPUT || '';
const topicPath = process.env.ENCYCLOPEDIA_TOPIC_FILE || 'configuration/encyclopedia-topics.json';
const attempts = Math.max(1, Number(process.env.LIVE_VERIFY_ATTEMPTS || 8));
const delayMs = Math.max(0, Number(process.env.LIVE_VERIFY_DELAY_MS || 7000));
if (!inputPath) throw new Error('A batch or backfill manifest path is required.');

const input = JSON.parse(await readFile(inputPath, 'utf8'));
const topics = JSON.parse(await readFile(topicPath, 'utf8')).topics;
if (!Array.isArray(topics) || topics.length !== 21) throw new Error('Invalid encyclopedia topic configuration.');

async function readBatch(batchPath) {
  const batch = JSON.parse(await readFile(batchPath, 'utf8'));
  if (!Array.isArray(batch.lessonFiles) || batch.lessonFiles.length === 0) throw new Error(`${batchPath} has no lessonFiles.`);
  const ids = [];
  for (const lessonPath of batch.lessonFiles) {
    const lesson = JSON.parse(await readFile(lessonPath, 'utf8'));
    if (!/^THC-ENC-\d{3}$/.test(String(lesson.id || ''))) throw new Error(`Invalid lesson ID in ${lessonPath}.`);
    ids.push(lesson.id);
  }
  return { batchPath, batch: batch.batch || batchPath, ids };
}

const batches = [];
if (Array.isArray(input.batches)) {
  for (const batchPath of input.batches) batches.push(await readBatch(batchPath));
} else {
  const ids = [];
  for (const lessonPath of input.lessonFiles || []) {
    const lesson = JSON.parse(await readFile(lessonPath, 'utf8'));
    if (!/^THC-ENC-\d{3}$/.test(String(lesson.id || ''))) throw new Error(`Invalid lesson ID in ${lessonPath}.`);
    ids.push(lesson.id);
  }
  if (ids.length === 0) throw new Error(`${inputPath} does not contain a verifiable batch.`);
  batches.push({ batchPath: inputPath, batch: input.batch || inputPath, ids });
}

const allIds = batches.flatMap(batch => batch.ids);
const uniqueIds = [...new Set(allIds)];
if (uniqueIds.length !== allIds.length) throw new Error('Verification input contains duplicate lesson IDs.');
const numberFor = id => Number(id.match(/(\d{3})$/)?.[1] || 0);
const topicForIds = ids => {
  const numbers = ids.map(numberFor);
  const topic = topics.find(candidate => numbers.every(number => number >= candidate.range[0] && number <= candidate.range[1]));
  if (!topic) throw new Error(`IDs ${ids[0]}–${ids.at(-1)} do not resolve to one encyclopedia topic.`);
  return topic;
};

const targetTopics = new Map();
for (const batch of batches) {
  const topic = topicForIds(batch.ids);
  const existing = targetTopics.get(topic.slug) || { topic, ids: [] };
  existing.ids.push(...batch.ids);
  targetTopics.set(topic.slug, existing);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function hasAll(html, markers) {
  const lower = html.toLowerCase();
  return markers.every(marker => lower.includes(String(marker).toLowerCase()));
}
async function requireLive(path, markers, label) {
  let last = { status: 0, bytes: 0, missing: markers };
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const url = `${site}${path}${separator}dtf_ency_backfill=${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${attempt}`;
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache',
          'User-Agent': 'DTF-Encyclopedia-Backfill-Verifier/1.0'
        },
        signal: AbortSignal.timeout(35_000)
      });
      const html = await response.text();
      const missing = markers.filter(marker => !html.toLowerCase().includes(String(marker).toLowerCase()));
      last = { status: response.status, bytes: Buffer.byteLength(html), missing, finalUrl: response.url };
      if (response.ok && missing.length === 0) return { path, label, attempt, status: response.status, bytes: last.bytes };
    } catch (error) {
      last = { status: 0, bytes: 0, missing: markers, error: error?.message || String(error) };
    }
    if (attempt < attempts && delayMs > 0) await sleep(delayMs);
  }
  throw new Error(`${label} failed live verification at ${path}: ${JSON.stringify(last).slice(0, 1400)}`);
}

const results = [];
results.push(await requireLive('/learn/encyclopedia/', [
  'Browse by topic',
  'Search all published encyclopedia lessons',
  ...uniqueIds
], 'Encyclopedia index'));

for (const { topic, ids } of targetTopics.values()) {
  results.push(await requireLive(`/learn/encyclopedia/${topic.slug}/`, [
    `data-thc-topic="${topic.slug}"`,
    ...ids
  ], `${topic.title} topic hub`));
}

let articleIds;
if (Array.isArray(input.batches)) {
  const requested = Array.isArray(input.publicSentinels) ? input.publicSentinels : [];
  articleIds = requested.length ? requested : [...new Set(batches.flatMap(batch => [batch.ids[0], batch.ids.at(-1)]))];
} else {
  articleIds = uniqueIds;
}
for (const id of articleIds) {
  if (!uniqueIds.includes(id)) throw new Error(`Article sentinel ${id} is not part of the verification input.`);
  results.push(await requireLive(`/learn/encyclopedia/${id.toLowerCase()}/`, [
    id,
    'Controlled education content',
    'Terms to know'
  ], `${id} article`));
}

console.log(JSON.stringify({
  ok: true,
  input: inputPath,
  batchCount: batches.length,
  lessonIdsVerifiedOnIndex: uniqueIds.length,
  topicHubsVerified: targetTopics.size,
  articleRoutesVerified: articleIds.length,
  results
}, null, 2));
