import assert from 'node:assert/strict';
import { isVisualBatchFilePath, isVisualBatchOutputFilename, isVisualLessonId } from './lib/encyclopedia-visual-batch-identifiers.mjs';

for (const id of ['THC-ENC-001','THC-ENC-420','THC-ENC-999','THC-ENC-1000','THC-ENC-12345']) assert.equal(isVisualLessonId(id),true,id);
for (const id of ['THC-ENC-1','THC-ENC-12','THC-ENC-1000-extra','OTHER-ENC-1000',null]) assert.equal(isVisualLessonId(id),false,String(id));
for (const number of ['001','999','1000','12345']) {
  assert.equal(isVisualBatchFilePath('content/encyclopedia/visual-production-batches/batch-'+number+'.json'),true,number);
  assert.equal(isVisualBatchOutputFilename('batch-'+number+'.json'),true,number);
  assert.equal(isVisualBatchOutputFilename('batch-'+number+'.md'),true,number);
}
for (const path of ['../batch-1000.json','content/encyclopedia/visual-production-batches/../batch-1000.json','content/encyclopedia/visual-production-batches/batch-10.json','content/encyclopedia/visual-production-batches/batch-1000.json.bak']) assert.equal(isVisualBatchFilePath(path),false,path);
for (const filename of ['batch-10.json','batch-1000.png','../batch-1000.json','batch-1000.json.bak']) assert.equal(isVisualBatchOutputFilename(filename),false,filename);
console.log('Visual batch extended ID contracts passed');
