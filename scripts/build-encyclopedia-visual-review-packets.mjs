#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const batchesDir=path.join(root,'content','encyclopedia','visual-production-batches');
const outDir=path.join(root,'review','encyclopedia-visuals');
const pre=JSON.parse(fs.readFileSync(path.join(root,'data','encyclopedia-visual-machine-preflight.json'),'utf8'));
const promo=JSON.parse(fs.readFileSync(path.join(root,'data','encyclopedia-visual-promotion-manifest.json'),'utf8'));
const visualQueue=JSON.parse(fs.readFileSync(path.join(root,'content','encyclopedia','visual-production-queue-v1.json'),'utf8'));
const producedVisuals=(visualQueue.items||[]).filter(x=>x.productionStatus==='raster_artwork_produced_review_pending');
const producedById=new Map(producedVisuals.map(x=>[x.lessonId,x]));
const evidence=JSON.parse(fs.readFileSync(path.join(root,'data','encyclopedia-evidence-tracking.json'),'utf8'));
const evidenceById=new Map((evidence.lessons||[]).map(x=>[x.id,x]));
const preById=new Map((pre.candidates||[]).map(x=>[x.lessonId,x]));
const promoById=new Map((promo.items||[]).map(x=>[x.lessonId,x]));

fs.mkdirSync(outDir,{recursive:true});
for(const file of fs.readdirSync(outDir)) if(/^batch-\d{3}\.(?:json|md)$/i.test(file)) fs.unlinkSync(path.join(outDir,file));

const batchFiles=fs.readdirSync(batchesDir).filter(x=>/^batch-\d{3}\.json$/i.test(x)).sort();
const index=[];
const covered=new Set();

for(const file of batchFiles){
  const batch=JSON.parse(fs.readFileSync(path.join(batchesDir,file),'utf8'));
  const rows=(batch.items||[]).map(item=>{
    covered.add(item.lessonId);
    const p=preById.get(item.lessonId)||{};
    const ev=evidenceById.get(item.lessonId)||{};
    const promotion=promoById.get(item.lessonId)||{};
    return {
      lessonId:item.lessonId,
      title:item.title,
      visualFamily:item.visualFamily,
      purpose:item.purpose,
      targetRepositoryPath:item.targetRepositoryPath,
      machineChecks:p.machineChecks||{},
      machinePreflightPassed:Boolean(p.machinePreflightPassed),
      evidence:{
        claimEvidenceCount:Number(ev.evidence?.claimEvidenceCount||0),
        authoritativeSourceIds:ev.evidence?.authoritativeSourceIds||[],
        claimEvidenceIds:ev.evidence?.claimEvidenceIds||[],
        reviewState:ev.evidence?.reviewState||null
      },
      reviewInput:{
        decision:null,
        reviewerId:null,
        reviewerName:null,
        reviewedAt:null,
        reviewNotes:null,
        scienceAccuracy:null,
        labelingAccuracy:null,
        misconceptionSafety:null,
        accessibilityQuality:null,
        provenanceRights:null,
        responsiveLegibility:null
      },
      currentPromotionEligible:Boolean(promotion.promotionEligible)
    };
  });

  const packet={
    schemaVersion:'1.0.0',
    batchId:batch.batchId,
    packetType:'independent-review-input',
    boundary:'Reviewer fields must be completed by a real independent reviewer. Blank fields are intentional and must never be auto-filled.',
    decisionValues:['approved','changes_requested','rejected'],
    booleanReviewFields:['scienceAccuracy','labelingAccuracy','misconceptionSafety','accessibilityQuality','provenanceRights','responsiveLegibility'],
    items:rows
  };
  const num=String(batch.batchId).match(/(\d+)$/)?.[1]||'000';
  fs.writeFileSync(path.join(outDir,`batch-${num}.json`),JSON.stringify(packet,null,2)+'\n');

  const md=[
    `# ${batch.batchId} — Independent Visual Review Packet`,
    '',
    '> Reviewer identity, timestamp, decision, and notes must be entered by a real reviewer. This packet does not authorize publication.',
    '',
    ...rows.flatMap((row,i)=>[
      `## ${i+1}. ${row.lessonId} — ${row.title}`,
      '',
      `- Family: ${row.visualFamily}`,
      `- Purpose: ${row.purpose}`,
      `- Candidate target: ${row.targetRepositoryPath}`,
      `- Machine preflight: **${row.machinePreflightPassed?'PASS':'FAIL'}**`,
      `- Claim evidence records: **${row.evidence.claimEvidenceCount}**`,
      `- Evidence IDs: ${row.evidence.claimEvidenceIds.join(', ')||'(none)'}`,
      `- Authoritative source IDs: ${row.evidence.authoritativeSourceIds.join(', ')||'(traceable controlled references used; see evidence records)'}`,
      '',
      'Reviewer checklist:',
      '- [ ] Science/mechanism is accurate within stated scope',
      '- [ ] Labels are accurate and unambiguous',
      '- [ ] Visual does not reinforce a known misconception',
      '- [ ] Alt/caption/accessibility treatment is adequate',
      '- [ ] Provenance/rights are acceptable',
      '- [ ] Text and labels remain legible responsively',
      '',
      'Decision: approved / changes_requested / rejected',
      'Reviewer ID:',
      'Reviewer name:',
      'Reviewed at (ISO 8601):',
      'Review notes:',
      ''
    ])
  ].join('\n');
  fs.writeFileSync(path.join(outDir,`batch-${num}.md`),md+'\n');
  index.push({batchId:batch.batchId,json:`review/encyclopedia-visuals/batch-${num}.json`,markdown:`review/encyclopedia-visuals/batch-${num}.md`,itemCount:rows.length});
}
const producedRows=producedVisuals.filter(item=>!covered.has(item.lessonId)).map(item=>{
  const ev=evidenceById.get(item.lessonId)||{};
  return {
    lessonId:item.lessonId,title:item.title,visualFamily:item.visualFamily,purpose:item.purpose,
    candidateAssetPaths:item.canonicalAssetPaths||[],candidateCount:Number(item.assetCandidateCount||0),
    evidence:{claimEvidenceCount:Number(ev.evidence?.claimEvidenceCount||0),authoritativeSourceIds:ev.evidence?.authoritativeSourceIds||[],claimEvidenceIds:ev.evidence?.claimEvidenceIds||[],reviewState:ev.evidence?.reviewState||null},
    reviewInput:{decision:null,reviewerId:null,reviewerName:null,reviewedAt:null,reviewNotes:null,scienceAccuracy:null,labelingAccuracy:null,misconceptionSafety:null,accessibilityQuality:null,provenanceRights:null,responsiveLegibility:null}
  };
});
if(producedRows.length){
  const packet={schemaVersion:'1.0.0',batchId:'ENC-VIS-PRODUCED-REVIEW-001',packetType:'existing-raster-independent-review-input',boundary:'These assets already exist in the canonical raster tree but remain unapproved. Reviewer fields must be completed by a real independent reviewer.',decisionValues:['approved','changes_requested','rejected'],booleanReviewFields:['scienceAccuracy','labelingAccuracy','misconceptionSafety','accessibilityQuality','provenanceRights','responsiveLegibility'],items:producedRows};
  fs.writeFileSync(path.join(outDir,'produced-review-001.json'),JSON.stringify(packet,null,2)+'\n');
  const md=['# Existing Raster Candidates — Independent Review Packet','', '> These raster assets already exist but are not publication-approved. A real reviewer must record identity, timestamp, decision, notes, science/accessibility/rights/responsive checks.','',...producedRows.flatMap((row,i)=>[`## ${i+1}. ${row.lessonId} — ${row.title}`,'',`- Family: ${row.visualFamily}`,`- Candidate assets: ${row.candidateAssetPaths.join(', ')}`,`- Claim evidence records: **${row.evidence.claimEvidenceCount}**`,'','Decision: approved / changes_requested / rejected','Reviewer ID:','Reviewer name:','Reviewed at (ISO 8601):','Review notes:',''])].join('\n');
  fs.writeFileSync(path.join(outDir,'produced-review-001.md'),md+'\n');
  index.unshift({batchId:packet.batchId,json:'review/encyclopedia-visuals/produced-review-001.json',markdown:'review/encyclopedia-visuals/produced-review-001.md',itemCount:producedRows.length});
}
const total=index.reduce((n,x)=>n+x.itemCount,0);
fs.writeFileSync(path.join(outDir,'index.json'),JSON.stringify({schemaVersion:'1.0.0',batchCount:index.length,candidateCount:total,existingRasterReviewCount:producedRows.length,productionBriefReviewCount:total-producedRows.length,batches:index},null,2)+'\n');
console.log(`Built ${index.length} independent-review packets covering ${total} visual candidates/briefs, including ${producedRows.length} existing raster candidates.`);
