export function stripNonRenderedMarkup(html='') {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi,' ');
}

// Inspect opening-tag attributes, not arbitrary text containing "id=".
// This prevents data-*-id and quoted attribute values from creating false
// duplicate IDs. HTML also permits unquoted id values.
export function duplicateHtmlIds(html='') {
  const counts=new Map();
  const withoutComments=stripNonRenderedMarkup(String(html).replace(/<!--[\s\S]*?-->/g,''));
  // Each quoted segment is consumed whole, so > inside a quoted value cannot
  // prematurely terminate the opening tag.
  const openingTags=/<[a-z][\w:-]*(?=[\s/>])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
  for(const tag of withoutComments.matchAll(openingTags)) {
    const attributes=tag[1];
    const attrPattern=/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'\x60=<>]+)))?/g;
    for(const attr of attributes.matchAll(attrPattern)) {
      if(attr[1].toLowerCase()!=='id') continue;
      const id=attr[2]??attr[3]??attr[4]??'';
      if(id) counts.set(id,(counts.get(id)||0)+1);
      // Browsers keep only the first id attribute on a single element.
      // Repeated id attributes are invalid markup, but not two DOM IDs.
      break;
    }
  }
  return [...counts.entries()].filter(([,count])=>count>1).map(([id,count])=>({id,count}));
}

// Read one attribute from an HTML opening tag without confusing data-* or
// text inside quoted attribute values with an actual attribute.
export function getHtmlAttribute(tag, name) {
  const opening = String(tag).match(/^<[a-z][\w:-]*(?=[\s/>])((?:"[^"]*"|'[^']*'|[^'">])*)>/i);
  if (!opening) return null;
  const sought = String(name).toLowerCase();
  const attrPattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'\x60=<>]+)))?/g;
  for (const match of opening[1].matchAll(attrPattern)) {
    if (match[1].toLowerCase() === sought) return match[2] ?? match[3] ?? match[4] ?? '';
  }
  return null;
}
