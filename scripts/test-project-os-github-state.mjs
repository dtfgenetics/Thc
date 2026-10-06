#!/usr/bin/env node
import assert from 'node:assert/strict';
import {referencedPullRequests,collectGithubPullRequests} from './collect-project-os-github-state.mjs';

const queue={items:[
 {workItemId:'a',pullRequest:9},
 {workItemId:'b',pullRequest:7},
 {workItemId:'c',pullRequest:9},
 {workItemId:'d',pullRequest:null}
]};
assert.deepEqual(referencedPullRequests(queue),[7,9]);

const seen=[];
const prs=await collectGithubPullRequests(queue,{fetchPullRequest:async number=>{
 seen.push(number);
 if(number===7) return {state:'closed',merged:true,head:{sha:'h7'},base:{sha:'b7'},html_url:'https://example/7'};
 return {state:'open',merged:false,headSha:'h9',baseSha:'b9',url:'https://example/9'};
}});
assert.deepEqual(seen,[7,9]);
assert.deepEqual(prs,[
 {number:7,state:'closed',merged:true,headSha:'h7',baseSha:'b7',url:'https://example/7'},
 {number:9,state:'open',merged:false,headSha:'h9',baseSha:'b9',url:'https://example/9'}
]);

const missing=await collectGithubPullRequests({items:[{pullRequest:3}]},{fetchPullRequest:async()=>null});
assert.deepEqual(missing,[]);
await assert.rejects(()=>collectGithubPullRequests(queue,{}),/fetchPullRequest is required/);
console.log('Project OS GitHub state collector tests passed');
