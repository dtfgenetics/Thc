#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';

const root = process.cwd();
const DRY_RUN = process.argv.includes('--dry-run');
const arr = value => Array.isArray(value) ? value.filter(Boolean) : [];
const rel = file => path.relative(root, file).replaceAll(path.sep, '/');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

const crossLinkRepairs = {
  'THC-ENC-170': 'THC-ENC-173 for clone intake quarantine; THC-ENC-304 for sanitation and biosecurity escalation.',
  'THC-ENC-361': 'THC-ENC-381 for target product profiles; THC-ENC-406 for environmental data logging.',
  'THC-ENC-380': 'THC-ENC-361 for site goals and constraints; THC-ENC-420 for evidence-system integration.',
  'THC-ENC-415': 'THC-ENC-419 for source hierarchy and revision control; THC-ENC-416 for experimental design and controls.',
  'THC-ENC-420': 'THC-ENC-403 for traceability; THC-ENC-419 for citation and revision control.'
};

function splitMeasurementGuide(lesson) {
  const existing = arr(lesson.measureAndRecord);
  if (existing.length >= 2) return false;
  const original = existing[0];
  const originalText = typeof original === 'string'
    ? original
    : `${original?.field || 'Controlled record set'}: ${original?.requirement || ''}`.trim();
  const title = lesson.title || lesson.id;
  const part = Number(lesson.__part || Math.ceil(Number(lesson.number || 0) / 20));

  if (part === 9) {
    lesson.measureAndRecord = [
      {
        field: 'Source and identity record',
        requirement: `For ${title}, record donor or batch ID, plant or tray ID, date, operator, source position, starting condition, sanitation step, and any test or quarantine status. Preserve the original controlled note: ${originalText}`
      },
      {
        field: 'Rooting or establishment outcome',
        requirement: 'Record rooting percentage, time to visible root or establishment, losses, abnormal growth, environmental conditions, treatment differences, and follow-up observations that would confirm or revise the interpretation.'
      }
    ];
    return true;
  }

  if (part === 20) {
    lesson.measureAndRecord = [
      {
        field: 'Breeding decision record',
        requirement: `For ${title}, record program ID, generation or cross ID, parent or family IDs, target traits, selection criteria, trait units, rejection rules, and the decision date. Preserve the original controlled note: ${originalText}`
      },
      {
        field: 'Evidence and population record',
        requirement: 'Record population size, sampling method, trial environment, replication, lab or field measurements, pedigree or marker evidence when used, selected individuals or families, and the reason the result does or does not meet the release standard.'
      }
    ];
    return true;
  }

  if (part === 21) {
    lesson.measureAndRecord = [
      {
        field: 'Measurement identity record',
        requirement: `For ${title}, record quantity, unit, instrument or source system, sample or plant identity, time, location, method, basis, and raw value. Preserve the original controlled note: ${originalText}`
      },
      {
        field: 'Traceability and review record',
        requirement: 'Record calibration or verification status, conversion or calculation rule, reviewer, uncertainty or limitation, revision history, linked evidence, and the decision made from the record.'
      }
    ];
    return true;
  }

  return false;
}

function repairCrossLinks(lesson) {
  const addition = crossLinkRepairs[lesson.id];
  if (!addition) return false;
  const current = typeof lesson.crossLinks === 'string' ? lesson.crossLinks : '';
  if (addition.match(/THC-ENC-\d{3}/g).every(id => current.includes(id))) return false;
  lesson.crossLinks = current ? `${current}; ${addition}` : addition;
  return true;
}

const changedFiles = new Map();
let measurementUpdates = 0;
let crossLinkUpdates = 0;

for (const lessonRef of readCanonicalEncyclopediaLessons(root)) {
  const file = path.join(root, lessonRef.__path);
  const json = changedFiles.get(file) || readJson(file);
  const lessons = Array.isArray(json.lessons) ? json.lessons : [json];
  const lesson = lessons.find(row => row.id === lessonRef.id);
  if (!lesson) continue;
  lesson.__part = lessonRef.__part;
  let changed = false;
  if (splitMeasurementGuide(lesson)) {
    measurementUpdates += 1;
    changed = true;
  }
  if (repairCrossLinks(lesson)) {
    crossLinkUpdates += 1;
    changed = true;
  }
  delete lesson.__part;
  if (changed) changedFiles.set(file, json);
}

if (!DRY_RUN) {
  for (const [file, json] of changedFiles) writeJson(file, json);
}

console.log(`Encyclopedia readiness field materialization ${DRY_RUN ? 'dry run' : 'complete'}: ${measurementUpdates} measurement record set(s), ${crossLinkUpdates} cross-link set(s).`);
if (changedFiles.size) console.log(`Changed ${changedFiles.size} source file(s):\n${[...changedFiles.keys()].map(file => ` - ${rel(file)}`).join('\n')}`);
