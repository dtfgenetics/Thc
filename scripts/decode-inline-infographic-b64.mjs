import { createHash } from 'node:crypto';
import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dir = process.env.INFOGRAPHIC_SOURCE_DIR || join(process.cwd(), 'site/wordpress/assets/infographics');
const names = (await readdir(dir)).sort();
const singlePattern = /^(.*\.(?:png|jpe?g))\.b64$/i;
const partPattern = /^(.*\.(?:png|jpe?g))\.b64\.part-(\d+)$/i;
const groups = new Map();

for (const name of names) {
  let match = name.match(singlePattern);
  if (match) {
    const destinationName = match[1];
    const group = groups.get(destinationName) || { single: null, parts: [] };
    group.single = name;
    groups.set(destinationName, group);
    continue;
  }
  match = name.match(partPattern);
  if (match) {
    const destinationName = match[1];
    const group = groups.get(destinationName) || { single: null, parts: [] };
    group.parts.push({ name, index: Number(match[2]) });
    groups.set(destinationName, group);
  }
}

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const isJpeg = (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
const isPng = (bytes) => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
let created = 0;
let reused = 0;
let processed = 0;

for (const [destinationName, group] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  if (group.single && group.parts.length) {
    throw new Error(`Ambiguous inline intake has both single and chunked transports: ${destinationName}`);
  }
  const sourceNames = group.single
    ? [group.single]
    : group.parts.sort((a, b) => a.index - b.index).map((part) => part.name);
  if (!sourceNames.length) continue;

  if (!group.single) {
    const indexes = group.parts.map((part) => part.index).sort((a, b) => a - b);
    for (let i = 0; i < indexes.length; i += 1) {
      if (indexes[i] !== i + 1) {
        throw new Error(`Chunk sequence must be contiguous from part-1 for ${destinationName}; got ${indexes.join(',')}`);
      }
    }
  }

  let encoded = '';
  for (const sourceName of sourceNames) {
    encoded += (await readFile(join(dir, sourceName), 'utf8')).replace(/\s+/g, '');
  }
  if (!encoded || encoded.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(encoded)) {
    throw new Error(`Inline intake is not valid base64 text: ${destinationName}`);
  }

  const bytes = Buffer.from(encoded, 'base64');
  const lower = destinationName.toLowerCase();
  const valid = lower.endsWith('.png') ? isPng(bytes) : isJpeg(bytes);
  if (!valid) {
    throw new Error(`Inline intake signature does not match destination type: ${destinationName}`);
  }

  const destination = join(dir, destinationName);
  let existing = null;
  try {
    existing = await readFile(destination);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  if (existing) {
    if (hash(existing) !== hash(bytes)) {
      throw new Error(`Refusing to replace distinct canonical image: ${destination}`);
    }
    reused += 1;
  } else {
    await writeFile(destination, bytes);
    created += 1;
  }

  for (const sourceName of sourceNames) {
    await unlink(join(dir, sourceName));
  }
  processed += 1;
  console.log(`${existing ? 'Reused' : 'Decoded'} ${sourceNames.length} transport file(s) -> ${destinationName} (${bytes.length} bytes, sha256 ${hash(bytes)})`);
}

console.log(`INLINE_INFOGRAPHIC_B64_RESULT created=${created} reused=${reused} processed=${processed}`);
