import {CATEGORIES} from './project-os-quality-evidence.mjs';

export function summarizeQualityReport(report) {
  if (!Array.isArray(report?.results)) throw new TypeError('Quality report results must be an array');
  const categories = Object.fromEntries(CATEGORIES.map(category => [category, {pass:0,fail:0,unknown:0}]));
  const blockers = [];
  for(const app of report.results) {
    const missing = [];
    for(const category of CATEGORIES) {
      const item = app?.categories?.[category];
      const status = item?.status;
      const normalized = status === 'pass' || status === 'fail' ? status : 'unknown';
      categories[category][normalized]++;
      if(normalized !== 'pass') missing.push({category,status:normalized,reason:item?.reason || 'missing evidence'});
    }
    if(app?.ownerMatch === false) missing.push({category:'source',status:'fail',reason:'registry owner conflict'});
    if(app?.ownerMatch === null || app?.ownerMatch === undefined) missing.push({category:'source',status:'unknown',reason:'no matching registered project owner'});
    if(missing.length) blockers.push({appId:app.appId,route:app.route || null,repository:app.repository || null,missing});
  }
  return {
    schemaVersion:1,
    evaluatedAt:report.evaluatedAt,
    totalApps:report.results.length,
    readyApps:report.results.filter(row=>row.ready===true).length,
    blockedApps:blockers.length,
    categories, blockers,
    registryErrors:Array.isArray(report.errors)?report.errors:[]
  };
}
