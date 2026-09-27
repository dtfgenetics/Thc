import fs from 'node:fs';

const path='apps/growlens-web/src/CameraObservationWidget.tsx';
const source=fs.readFileSync(path,'utf8');

function count(token){ return source.split(token).length-1; }
function ok(value,message){ if(!value) throw new Error(message); }

ok(count('export default function CameraObservationWidget')===1,'CameraObservationWidget must have exactly one default component implementation');
ok(count("import { useModalFocusTrap } from './useModalFocusTrap';")===1,'CameraObservationWidget must import modal focus trap exactly once');
ok(count('function readableError(')===1,'CameraObservationWidget readableError helper duplicated');
ok(count('function formatBytes(')===1,'CameraObservationWidget formatBytes helper duplicated');

console.log('GrowLens camera widget source contract passed.');
