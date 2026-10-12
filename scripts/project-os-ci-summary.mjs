import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export function renderProjectOsSummary(summary) {
  if(!summary || !Array.isArray(summary.blockers) || !summary.categories || !Number.isSafeInteger(summary.totalApps))
    throw Error('Invalid Project OS summary');
  const escape=value=>String(value??'').replaceAll('|','\\|').replaceAll('\\n',' ').replaceAll('\\r',' ');
  const lines=['## Project OS quality evidence','',`**Applications:** ${summary.totalApps} · **Ready:** ${summary.readyApps} · **Blocked:** ${summary.blockedApps}`,'',
    '| Category | Pass | Fail | Unknown |','|---|---:|---:|---:|'];
  for(const category of ['source','build','responsive','content','security','production']){
    const row=summary.categories[category];
    if(!row)throw Error('Missing evidence category '+category);
    lines.push(`| ${category} | ${row.pass} | ${row.fail} | ${row.unknown} |`);
  }
  lines.push('','### Application blockers','','| Application | Blocked checks |','|---|---|');
  for(const app of summary.blockers.slice(0,40)){
    lines.push(`| ${escape(app.appId)} | ${escape((app.missing||[]).map(x=>x.category+': '+x.reason).join('; '))} |`);
  }
  if(summary.blockers.length>40)lines.push('',`Showing first 40 of ${summary.blockers.length} blocked applications; see attached JSON artifact for all.`);
  if(summary.registryErrors?.length)lines.push('','### Registry errors',...summary.registryErrors.map(x=>'- '+escape(x)));
  lines.push('','> Audit status is **not** production authorization. Evidence claims remain unverified until independently attested.','');
  return lines.join('\\n');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const file=process.env.PROJECT_OS_SUMMARY_REPORT || '.artifacts/project-os/evidence-summary.json';
  const markdown=renderProjectOsSummary(JSON.parse(fs.readFileSync(file,'utf8')));
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,markdown);
  else process.stdout.write(markdown);
}
