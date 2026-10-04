import assert from 'node:assert/strict';
import { writeFile, unlink } from 'node:fs/promises';
import { ensureCanonicalLearnRoot } from './ensure-wordpress-learn-root.mjs';

function response(status,body){
  return {ok:status>=200&&status<300,status,async text(){return body==null?'':JSON.stringify(body);}};
}
function fakeWordPress(initial=[]){
  let pages=initial.map((row)=>({...row}));
  let nextId=900;
  const calls=[];
  async function fetchImpl(url,options={}){
    const u=new URL(url);
    const method=String(options.method||'GET').toUpperCase();
    calls.push([method,u.pathname+u.search]);
    if(method==='GET'&&u.pathname==='/wp-json/wp/v2/pages'){
      const slug=u.searchParams.get('slug');
      return response(200,pages.filter((page)=>page.slug===slug));
    }
    if(method==='POST'&&u.pathname==='/wp-json/wp/v2/pages'){
      const body=JSON.parse(options.body);
      const page={id:nextId++,...body};
      pages.push(page);
      return response(201,page);
    }
    const match=u.pathname.match(/^\/wp-json\/wp\/v2\/pages\/(\d+)$/);
    if(method==='POST'&&match){
      const id=Number(match[1]);
      const index=pages.findIndex((page)=>Number(page.id)===id);
      if(index<0)return response(404,{message:'missing'});
      pages[index]={...pages[index],...JSON.parse(options.body)};
      return response(200,pages[index]);
    }
    return response(404,{message:'unexpected'});
  }
  return {fetchImpl,calls,get pages(){return pages;}};
}

const env={siteUrl:'https://example.test',username:'u',password:'p'};

{
  const wp=fakeWordPress([{id:7,slug:'learn',parent:0,status:'publish'}]);
  const result=await ensureCanonicalLearnRoot({...env,fetchImpl:wp.fetchImpl});
  assert.deepEqual(result,{pageId:7,action:'reused',status:'publish'});
}
{
  const wp=fakeWordPress([{id:8,slug:'learn',parent:44,status:'draft'}]);
  const result=await ensureCanonicalLearnRoot({...env,fetchImpl:wp.fetchImpl});
  assert.deepEqual(result,{pageId:8,action:'repaired',status:'publish'});
  assert.equal(wp.pages[0].parent,0);
}
{
  const source='/tmp/dtf-learn-root-test.html';
  await writeFile(source,'<section><p>Teaching Healthy Cultivation</p><h1>Learn the plant.</h1></section>');
  const wp=fakeWordPress([]);
  const result=await ensureCanonicalLearnRoot({...env,sourcePath:source,fetchImpl:wp.fetchImpl});
  assert.equal(result.action,'created');
  assert.equal(wp.pages.length,1);
  assert.equal(wp.pages[0].slug,'learn');
  assert.equal(wp.pages[0].parent,0);
  await unlink(source);
}
{
  const wp=fakeWordPress([
    {id:1,slug:'learn',parent:0,status:'publish'},
    {id:2,slug:'learn',parent:0,status:'draft'}
  ]);
  await assert.rejects(
    ensureCanonicalLearnRoot({...env,fetchImpl:wp.fetchImpl}),
    /Multiple canonical Learn candidates/
  );
}

console.log('Canonical WordPress Learn root recovery contract: PASS');
