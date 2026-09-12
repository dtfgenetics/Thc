import fs from 'node:fs';

const path = 'site/public-route-patch/games/root-cause/app.js';
let source = fs.readFileSync(path, 'utf8');

const helperAnchor = `function prefersReducedMotion() {\n  try { return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; }\n  catch { return false; }\n}\n`;
const helper = `${helperAnchor}\nfunction revealStackedResult(target) {\n  let stacked = false;\n  try { stacked = globalThis.matchMedia?.('(max-width: 1050px)').matches ?? false; }\n  catch {}\n  if (!stacked || !target?.scrollIntoView) return;\n  const reveal = () => target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });\n  if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(reveal);\n  else reveal();\n}\n`;
if (!source.includes(helperAnchor)) throw new Error('Reduced-motion helper anchor not found');
source = source.replace(helperAnchor, helper);

const inspectionAnchor = `      ui.announce.textContent = \`${'${item.label}'}: ${'${item.result}'}\`;\n      render();\n`;
const inspectionReplacement = `${inspectionAnchor}      revealStackedResult(ui.evidence.closest('.evidence-card') ?? ui.evidence);\n`;
if (!source.includes(inspectionAnchor)) throw new Error('Inspection render anchor not found');
source = source.replace(inspectionAnchor, inspectionReplacement);

const diagnosisAnchor = `      ui.announce.textContent = wasCorrect ? \`Correct: ${'${diagnosisLabel(id)}'}.\` : \`Not the strongest fit: ${'${diagnosisLabel(id)}'}.\`;\n      render();\n`;
const diagnosisReplacement = `${diagnosisAnchor}      revealStackedResult(ui.feedback);\n`;
if (!source.includes(diagnosisAnchor)) throw new Error('Diagnosis render anchor not found');
source = source.replace(diagnosisAnchor, diagnosisReplacement);

fs.writeFileSync(path, source);
console.log('Applied Root Cause stacked-result visibility fix.');
