#!/usr/bin/env node
import assert from 'node:assert/strict';
import { displaySourceNote } from './lib/encyclopedia-source-note-display.mjs';

assert.equal(
  displaySourceNote('Nemali K. Understanding the Pores of a Soilless Substrate. Purdue Extension. 2018.  Open source'),
  'Nemali K. Understanding the Pores of a Soilless Substrate. Purdue Extension. 2018.'
);
assert.equal(
  displaySourceNote('Plant Physiology and Development. 2022.  Publisher record'),
  'Plant Physiology and Development. 2022.'
);
assert.equal(
  displaySourceNote('Research note: Open source methods require attribution.'),
  'Research note: Open source methods require attribution.'
);
assert.equal(
  displaySourceNote('Paper. 2020. https://doi.org/10.3390/plants9060745'),
  'Paper. 2020. https://doi.org/10.3390/plants9060745'
);
assert.equal(
  displaySourceNote('2018. Open source'),
  '2018. Open source',
  'single-spaced ambiguous phrases must remain unchanged'
);
console.log('Encyclopedia bibliography display regression passed.');
