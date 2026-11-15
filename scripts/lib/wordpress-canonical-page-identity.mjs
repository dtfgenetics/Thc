/**
 * Choose a canonical WordPress page by exact slug across *all* statuses.
 * A draft owns its slug just as a published page does; ignoring drafts
 * causes repeated /shop-2/, /shop-3/ ... auto-suffixed publications.
 */
export function selectCanonicalPage(rows,slug){
 if(!Array.isArray(rows))throw new Error('Unexpected WordPress page response for '+slug);
 const exact=rows.filter(row=>row&&row.slug===slug);
 if(exact.length>1)throw new Error('Ambiguous canonical WordPress slug '+slug+': '+exact.length+' pages');
 return exact[0]||null;
}
export function isCanonicalPageResponse(page,slug){
 return Number.isInteger(Number(page?.id))&&Number(page?.id)>0&&page?.slug===slug&&page?.status==='publish';
}
