import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const canonicalPath = path.resolve(here, '../data/cases.json');
const publicPath = path.resolve(here, '../../../site/public-route-patch/games/root-cause/data/cases.json');

const canonical = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
const publicCopy = JSON.parse(fs.readFileSync(publicPath, 'utf8'));

const fail = (message) => { throw new Error(message); };
const unique = (values) => new Set(values).size === values.length;

if (JSON.stringify(canonical) !== JSON.stringify(publicCopy)) fail('Canonical and public Root Cause data differ.');
if (canonical.schemaVersion !== 1) fail('Unexpected schemaVersion.');
if (!Array.isArray(canonical.diagnoses) || canonical.diagnoses.length !== 12) fail('Expected exactly 12 diagnoses.');
if (!Array.isArray(canonical.cases) || canonical.cases.length !== 12) fail('Expected exactly 12 cases.');
if (!unique(canonical.diagnoses.map((item) => item.id))) fail('Diagnosis ids must be unique.');
if (!unique(canonical.cases.map((item) => item.id))) fail('Case ids must be unique.');

const diagnosisIds = new Set(canonical.diagnoses.map((item) => item.id));
for (const diagnosis of canonical.diagnoses) {
  if (!diagnosis.id || !diagnosis.label || !diagnosis.family) fail(`Invalid diagnosis: ${diagnosis.id}`);
}

for (const gameCase of canonical.cases) {
  if (!gameCase.title || !gameCase.stage || !gameCase.summary || !gameCase.explanation || !gameCase.visual) fail(`Case ${gameCase.id} is missing display fields.`);
  if (!diagnosisIds.has(gameCase.diagnosisId)) fail(`Case ${gameCase.id} references unknown diagnosis.`);
  if (!Array.isArray(gameCase.distractorIds) || gameCase.distractorIds.length !== 3 || !unique(gameCase.distractorIds)) fail(`Case ${gameCase.id} must have three unique distractors.`);
  if (gameCase.distractorIds.includes(gameCase.diagnosisId)) fail(`Case ${gameCase.id} repeats the correct diagnosis as a distractor.`);
  if (gameCase.distractorIds.some((id) => !diagnosisIds.has(id))) fail(`Case ${gameCase.id} has an unknown distractor.`);
  if (!Array.isArray(gameCase.environment) || gameCase.environment.length < 3) fail(`Case ${gameCase.id} needs environment context.`);
  if (!Array.isArray(gameCase.symptoms) || gameCase.symptoms.length < 3) fail(`Case ${gameCase.id} needs symptoms.`);
  if (!Array.isArray(gameCase.inspections) || gameCase.inspections.length !== 4) fail(`Case ${gameCase.id} must have exactly four inspections.`);
  if (!unique(gameCase.inspections.map((item) => item.id))) fail(`Case ${gameCase.id} inspection ids must be unique.`);
  for (const inspection of gameCase.inspections) {
    if (!inspection.id || !inspection.label || !inspection.result) fail(`Case ${gameCase.id} has an incomplete inspection.`);
  }
}

console.log(`Validated ${canonical.cases.length} Root Cause cases and ${canonical.diagnoses.length} diagnoses.`);
