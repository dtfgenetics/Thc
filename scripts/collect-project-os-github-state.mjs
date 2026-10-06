#!/usr/bin/env node
import fs from 'node:fs';

export function referencedPullRequests(queue){
 return [...new Set((queue.items||[]).map(x=>x.pullRequest).filter(Number.isInteger))].sort((a,b)=>a-b);
}
export async function collectGithubPullRequests(queue,{fetchPullRequest}){
 if(typeof fetchPullRequest!=='function') throw new TypeError('fetchPullRequest is required');
 const pullRequests=[];
 for(const number of referencedPullRequests(queue)){
  const pr=await fetchPullRequest(number);
  if(!pr) continue;
  pullRequests.push({
   number,
   state:pr.state,
   merged:Boolean(pr.merged),
   headSha:pr.head?.sha||pr.headSha||null,
   baseSha:pr.base?.sha||pr.baseSha||null,
   url:pr.html_url||pr.url||null
  });
 }
 return pullRequests;
}
async function githubFetch(repository,token,number){
 const response=await fetch(`https://api.github.com/repos/${repository}/pulls/${number}`,{
  headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'}
 });
 if(response.status===404) return null;
 if(!response.ok) throw new Error(`GitHub PR ${number} request failed: ${response.status}`);
 return response.json();
}
if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const [queuePath]=process.argv.slice(2);
 const repository=process.env.GITHUB_REPOSITORY, token=process.env.GITHUB_TOKEN;
 if(!queuePath||!repository||!token) throw new Error('usage: GITHUB_REPOSITORY=owner/repo GITHUB_TOKEN=... collect-project-os-github-state.mjs queue.json');
 const queue=JSON.parse(fs.readFileSync(queuePath,'utf8'));
 const pullRequests=await collectGithubPullRequests(queue,{fetchPullRequest:n=>githubFetch(repository,token,n)});
 console.log(JSON.stringify({pullRequests},null,2));
}
