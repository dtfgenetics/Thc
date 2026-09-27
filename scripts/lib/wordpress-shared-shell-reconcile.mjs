export const OWNED_HEADER_STYLE_IDS=[
  'dtf-sitewide-header-v5-style',
  'dtf-sitewide-header-v6-style',
  'dtf-content-density-v1-style',
  'dtf-sitewide-visual-repair-v2-style',
  'dtf-responsive-layout-v1',
  'dtf-sitewide-ux-polish-v1',
  'dtf-sitewide-mobile-polish-v1-style',
  'dtf-shared-footer-v6-style',
];

export const OWNED_HEADER_SCRIPT_IDS=[
  'dtf-sitewide-header-v5-script',
  'dtf-sitewide-header-v6-script',
  'dtf-content-density-v1-script',
  'dtf-sitewide-visual-repair-v2-script',
];

const CANONICAL_HEADER_SCRIPT_IDS=[
  'dtf-sitewide-header-v6-script',
  'dtf-content-density-v1-script',
  'dtf-sitewide-visual-repair-v2-script',
];

const escapeRegExp=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

export function stripOwnedHeaderAssets(original){
  let output=original;
  for(const id of OWNED_HEADER_STYLE_IDS) output=output.replace(new RegExp(`<style\\b[^>]*id=["']${escapeRegExp(id)}["'][^>]*>[\\s\\S]*?<\\/style>\\s*`,'gi'),'');
  for(const id of OWNED_HEADER_SCRIPT_IDS) output=output.replace(new RegExp(`<script\\b[^>]*id=["']${escapeRegExp(id)}["'][^>]*>[\\s\\S]*?<\\/script>\\s*`,'gi'),'');
  return output;
}

export function assertCanonicalHeaderAssets(content){
  for(const id of CANONICAL_HEADER_SCRIPT_IDS){
    const scripts=[...content.matchAll(new RegExp(`<script\\b[^>]*id=["']${escapeRegExp(id)}["'][^>]*>([\\s\\S]*?)<\\/script>`,'gi'))];
    if(scripts.length!==1) throw new Error(`Expected exactly one ${id} in rebuilt header; found ${scripts.length}`);
    const source=scripts[0][1];
    if(/&#0*38;|&#x0*26;|&amp;/i.test(source)) throw new Error(`${id} contains HTML-entity corruption`);
    try{new Function(source);}catch(error){throw new Error(`${id} is not valid JavaScript: ${error.message}`);}
  }
}

export function replaceShell(original,type,replacement){
  const tag=type==='header'?'header':'footer';
  const source=type==='header'?stripOwnedHeaderAssets(original):original;
  const block=new RegExp(`<!-- wp:html -->\\s*(?:<style[\\s\\S]*?<\\/style>\\s*)*<${tag}[\\s\\S]*?<\\/${tag}>[\\s\\S]*?<!-- \\/wp:html -->`,'i');
  if(block.test(source)) return source.replace(block,replacement);
  const bare=new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`,'i');
  if(bare.test(source)) return source.replace(bare,replacement.replace(/^<!-- wp:html -->|<!-- \/wp:html -->$/g,''));
  throw new Error(`Could not safely locate existing ${tag} shell block`);
}
