export function stripNonRenderedMarkup(html='') {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi,' ');
}

// Match only the real HTML id attribute. A word-boundary match also catches
// data-thc-lesson-visual-id and falsely reports duplicated lesson IDs.
export function duplicateHtmlIds(html='') {
  const counts=new Map();
  const withoutComments=String(html).replace(/<!--[\s\S]*?-->/g,'');
  for(const tag of withoutComments.matchAll(/<[a-z][^>]*?\sid\s*=\s*(["'])(.*?)\1[^>]*>/gi)){
    const id=tag[2];
    counts.set(id,(counts.get(id)||0)+1);
  }
  return [...counts.entries()].filter(([,count])=>count>1).map(([id,count])=>({id,count}));
}
