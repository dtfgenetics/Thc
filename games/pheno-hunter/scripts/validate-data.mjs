import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const canonicalPath = path.resolve(here, '../data/phenos.json');
const publicPath = path.resolve(here, '../../../site/public-route-patch/games/pheno-hunter/data/phenos.json');

const canonical = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
const publicCopy = JSON.parse(fs.readFileSync(publicPath, 'utf8'));
const fail = (message) => { throw new Error(message); };
const unique = (values) => new Set(values).size === values.length;

if (JSON.stringify(canonical) !== JSON.stringify(publicCopy)) fail('Canonical and public Pheno Hunter data differ.');
if (canonical.schemaVersion !== 1) fail('Unexpected schemaVersion.');
if (!Array.isArray(canonical.visibleTraits) || canonical.visibleTraits.length !== 3) fail('Expected exactly three visible traits.');
if (!Array.isArray(canonical.hiddenTraits) || canonical.hiddenTraits.length !== 4) fail('Expected exactly four hidden traits.');
const traitIds = [...canonical.visibleTraits, ...canonical.hiddenTraits];
if (!unique(traitIds) || traitIds.length !== 7) fail('Expected seven unique total traits.');
if (traitIds.some((id) => !canonical.traitLabels?.[id])) fail('Every trait needs a label.');

if (!Array.isArray(canonical.briefs) || canonical.briefs.length !== 6) fail('Expected exactly six keeper briefs.');
if (!unique(canonical.briefs.map((brief) => brief.id))) fail('Brief ids must be unique.');
for (const brief of canonical.briefs) {
  if (!brief.title || !brief.summary) fail(`Brief ${brief.id} is missing display copy.`);
  const weightIds = Object.keys(brief.weights ?? {});
  if (weightIds.length !== traitIds.length || weightIds.some((id) => !traitIds.includes(id))) fail(`Brief ${brief.id} must weight all seven traits.`);
  const total = Object.values(brief.weights).reduce((sum, value) => sum + Number(value), 0);
  if (total !== 100) fail(`Brief ${brief.id} weights must total 100, got ${total}.`);
  if (Object.values(brief.weights).some((value) => !Number.isInteger(value) || value < 0 || value > 100)) fail(`Brief ${brief.id} has invalid weights.`);
}

if (!Array.isArray(canonical.candidates) || canonical.candidates.length !== 18) fail('Expected exactly 18 candidates.');
if (!unique(canonical.candidates.map((candidate) => candidate.id))) fail('Candidate ids must be unique.');
if (!unique(canonical.candidates.map((candidate) => candidate.name))) fail('Candidate names must be unique.');
for (const candidate of canonical.candidates) {
  if (!candidate.name || !candidate.family || !candidate.tagline) fail(`Candidate ${candidate.id} is missing display copy.`);
  if (Object.keys(candidate.traits ?? {}).length !== traitIds.length) fail(`Candidate ${candidate.id} must have all seven traits.`);
  for (const traitId of traitIds) {
    const value = candidate.traits?.[traitId];
    if (!Number.isInteger(value) || value < 1 || value > 10) fail(`Candidate ${candidate.id} ${traitId} must be an integer from 1 to 10.`);
  }
}

console.log(`Validated ${canonical.candidates.length} Pheno Hunter candidates and ${canonical.briefs.length} keeper briefs.`);
