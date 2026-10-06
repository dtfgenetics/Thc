#!/usr/bin/env node
import assert from 'node:assert/strict';
import {referencedPullRequests,collectGithubPullRequests} from './collect-project-os-github-state.mjs';

const queue={items:[
 {workItemId:'a',pullRequest:12},
 {workItemId:'b',pullRequest:7},
 {workItemId:'c',pullRequest:12},
 {workItemId:'d',pullRequest:null}
]};
assert.deepEqual(referencedPullRequests(queue),[7,12]);

const seen=[];
const rows=await collectGithubPullRequests(queue,{fetchPullRequest:async number=>{
 seen.push(number);
 if(number===7) return {state:'open',merged:false,head:{sha:'head7'},base:{sha:'base7'},html_url:'https://github.test/pull/7'};
 return {state:'closed',merged:true,headSha:'head12',baseSha:'base12',url:'https://github.test/pull/12'};
}});
assert.deepEqual(seen,[7,12]);
assert.deepEqual(rows,[
 {number:7,state:'open',merged:false,headSha:'head7',baseSha:'base7',url:'https://github.test/pull/7'},
 {number:12,state:'closed',merged:true,headSha:'head12',baseSha:'base12',url:'https://github.test/pull/12'}
]);

const missing=await collectGithubPullRequests({items:[{pullRequest:9}]},{fetchPullRequest:async()=>null});
assert.deepEqual(missing,[]);
await assert.rejects(()=>collectGithubPullRequests(queue,{}),/fetchPullRequest is required/);
console.log('Project OS GitHub collector tests passed');
