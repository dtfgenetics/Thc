import assert from 'node:assert/strict';
import { stripOutdoorAtlas } from './wordpress-outdoor-atlas-content.mjs';

const owner='<section data-dtf-learning-v4="topic-outdoor-cultivation">owner</section>';
const balanced=`${owner}<!-- dtf-outdoor-visuals-v6:start --><style id="dtf-outdoor-visuals-v6-style"></style><section class="outv6"><figure class="outv6-card"></figure></section><!-- dtf-outdoor-visuals-v6:end -->`;
assert.equal(stripOutdoorAtlas(balanced),owner);

const truncated=`${owner}<section class="outv6-group" data-outv6-group="water-rootzone"><figure class="outv6-card"></figure></section><section class="outv6-group" data-outv6-group="season-microclimate"><figure class="outv6-card"></figure></section><!-- dtf-outdoor-visuals-v6:end --><section data-dtf-outdoor-v6="true">curriculum</section>`;
assert.equal(stripOutdoorAtlas(truncated),`${owner}<section data-dtf-outdoor-v6="true">curriculum</section>`);

assert.throws(()=>stripOutdoorAtlas(`${owner}<!-- dtf-outdoor-visuals-v6:end -->`),/no recoverable atlas start/);
console.log('Outdoor atlas content recovery tests passed.');
