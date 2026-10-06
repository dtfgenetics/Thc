const ID_PATTERN=/^THC-ENC-(\d{3,})$/;

export function encyclopediaLessonNumber(value){
  if(typeof value==='number'&&Number.isInteger(value)&&value>0)return value;
  const match=String(value??'').match(ID_PATTERN);
  if(!match)throw new Error(`Invalid encyclopedia lesson identity: ${value}`);
  return Number(match[1]);
}

export function encyclopediaLessonId(value){
  const n=encyclopediaLessonNumber(value);
  return `THC-ENC-${String(n).padStart(3,'0')}`;
}

export function encyclopediaLessonSlug(value){
  return encyclopediaLessonId(value).toLowerCase();
}

export function encyclopediaLessonRoute(value){
  return `/learn/encyclopedia/${encyclopediaLessonSlug(value)}/`;
}

export function isCanonicalEncyclopediaLessonRoute(route,value){
  return String(route??'')===encyclopediaLessonRoute(value);
}
