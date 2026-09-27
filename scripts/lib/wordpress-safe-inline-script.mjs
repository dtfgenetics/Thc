import { Buffer } from 'node:buffer';

export function getWordPressSafeInlineScriptTag(id,source){
  if(!/^[A-Za-z][\w:-]*$/.test(id)) throw new Error(`Invalid inline script id: ${id}`);
  const payload=Buffer.from(String(source),'utf8').toString('base64');
  return `<script id="${id}">(function(){var owner=document.currentScript;var script=document.createElement('script');script.text=atob('${payload}');owner.after(script);script.remove();})();</script>`;
}
