import process from 'node:process';
import { publishApprovedVisualMap } from './lib/publish-wordpress-approved-visual-map.mjs';

await publishApprovedVisualMap({
  apply:String(process.env.APPLY_ENVIRONMENT_VPD_VISUALS_V6||'').toLowerCase()==='true',
  mapPath:process.env.ENVIRONMENT_VPD_VISUAL_MAP||'site/wordpress/education/environment-vpd-v6-visual-map.json',
  curriculumId:'environment-vpd-v6',
  pageSlug:'environment-vpd',
  marker:'dtf-environment-vpd-visuals-v6',
  liveCurriculumMarker:'data-dtf-environment-vpd-v6="true"',
  title:'Environment & VPD visual atlas',
  intro:'Only approved finished environmental and plant-physiology visuals are shown. Reference-only and simple supplemental artwork is excluded.',
  backupRoot:process.env.BACKUP_ROOT||'/tmp/dtf-environment-vpd-visuals-v6'
});
