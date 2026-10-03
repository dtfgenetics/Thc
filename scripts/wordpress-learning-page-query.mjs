export function buildWordPressPageQuery(slug,{parentId=null,context='edit',perPage=20}={}){
  const params=new URLSearchParams({
    slug:String(slug),
    context:String(context),
    per_page:String(perPage)
  });
  if(parentId!==null&&parentId!==undefined) params.set('parent',String(parentId));
  return `/wp-json/wp/v2/pages?${params}`;
}

export function requireSingleWordPressPage(rows,{slug,parentId=null}={}){
  const scope=parentId===null||parentId===undefined?'site-wide':`under parent ${parentId}`;
  if(!Array.isArray(rows)||rows.length!==1){
    throw new Error(`Expected exactly one WordPress page for ${slug} (${scope}); found ${Array.isArray(rows)?rows.length:'invalid response'}`);
  }
  return rows[0];
}
