import fs from 'node:fs';
import path from 'node:path';

const baselinePath=process.env.WEB_QA_BASELINE_FILE||'configuration/web-quality-regression-baseline.json';
const reportDir=process.env.WEB_QA_LIGHTHOUSE_DIR||'.artifacts/web-qa/lighthouse';
const outputPath=process.env.WEB_QA_REGRESSION_REPORT||'.artifacts/web-qa/lighthouse-regression.json';
const enforce=process.env.WEB_QA_REGRESSION_ENFORCE==='1';
const requireCoverage=process.env.WEB_QA_REQUIRE_BASELINE_COVERAGE==='1';
const origin=(process.env.WEB_QA_BASE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8'));
const categories=['performance','accessibility','best-practices','seo'];

function normalizeRoute(value){
  const url=new URL(value,origin);
  let route=url.pathname||'/';
  if(route!=='/'&&!route.endsWith('/')&&route!=='/thc-grow-doc') route+='/';
  return route;
}

const current={};
if(fs.existsSync(reportDir)){
  for(const name of fs.readdirSync(reportDir)){
    if(!name.endsWith('.report.json'))continue;
    const report=JSON.parse(fs.readFileSync(path.join(reportDir,name),'utf8'));
    const route=normalizeRoute(report.finalUrl||report.requestedUrl||'/');
    const scores={};
    for(const category of categories)scores[category]=Number(report.categories?.[category]?.score);
    current[route]=scores;
  }
}

const findings=[];
const rows=[];
for(const [route,prior] of Object.entries(baseline.routes||{})){
  const now=current[route];
  if(!now){
    if(requireCoverage)findings.push({route,type:'missing-route-measurement'});
    continue;
  }
  const row={route,baseline:prior,current:now,deltas:{}};
  for(const category of categories){
    const floor=Number(baseline.policy?.absoluteFloors?.[category]??0);
    const allowed=Number(baseline.policy?.maxRegression?.[category]??0);
    const previous=Number(prior?.[category]);
    const score=Number(now?.[category]);
    const delta=Number((score-previous).toFixed(4));
    row.deltas[category]=delta;
    if(!Number.isFinite(score)) findings.push({route,category,type:'invalid-score'});
    else if(score<floor) findings.push({route,category,type:'below-floor',score,floor});
    if(Number.isFinite(previous)&&Number.isFinite(score)&&score<previous-allowed){
      findings.push({route,category,type:'regression',score,baseline:previous,allowedRegression:allowed,delta});
    }
  }
  rows.push(row);
}

const report={
  schemaVersion:1,
  generatedAt:new Date().toISOString(),
  baseline:baseline.source,
  policy:baseline.policy,
  measuredRoutes:Object.keys(current).length,
  comparedRoutes:rows.length,
  enforce,
  requireCoverage,
  findings,
  rows
};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({measuredRoutes:report.measuredRoutes,comparedRoutes:report.comparedRoutes,findings:findings.length,enforce},null,2));
if(enforce&&findings.length){
  for(const finding of findings)console.error('WEB QUALITY REGRESSION',JSON.stringify(finding));
  process.exit(1);
}
