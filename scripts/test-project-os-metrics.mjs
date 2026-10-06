#!/usr/bin/env node
import assert from 'node:assert/strict';
import {collectMetrics} from './collect-project-os-metrics.mjs';

const status={lanes:{
 encyclopedia:{evidence:{canonicalRoutes:'420/420',visitorVerificationPassed:true}},
 tools:{evidence:{canonicalRoutes:23,liveAvailabilityVerified:'23-route canonical contract verified live'}}
}};
const queue={items:[
 {state:'review',branch:'a'},
 {state:'review',branch:'a'},
 {state:'done',branch:'a'},
 {state:'review',branch:'b'}
]};
const metrics=collectMetrics({status,queue,env:{
 PROJECT_OS_NOW:'2026-10-06T12:00:00Z',
 PROJECT_OS_MAIN_GREEN:'1',
 PROJECT_OS_RELEASE_FINGERPRINT_VISIBLE:'0',
 PROJECT_OS_KNOWN_404S:'2',
 PROJECT_OS_CRITICAL_A11Y:'0'
}});
assert.equal(metrics.encyclopediaRoutesVerified,420);
assert.equal(metrics.toolRoutesVerified,23);
assert.equal(metrics.duplicateActiveRepairBranches,1);
assert.equal(metrics.canonicalMainGreen,1);
assert.equal(metrics.releaseFingerprintVisible,0);
assert.equal(metrics.knownProduction404s,2);
assert.equal(metrics.criticalAccessibilityFindings,0);

const uncertain=collectMetrics({status:{lanes:{encyclopedia:{evidence:{canonicalRoutes:'420/420',visitorVerificationPassed:false}}}},queue:{items:[]},env:{}});
assert.equal(uncertain.encyclopediaRoutesVerified,undefined);
assert.equal(uncertain.toolRoutesVerified,undefined);
console.log('Project OS metric collection tests passed');
