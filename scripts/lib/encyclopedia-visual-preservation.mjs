export const LESSON_VISUAL_ANCHOR='<!-- THC-ENC-VISUAL-ANCHOR -->';
export const lessonVisualCommentPattern=/<!-- THC-ENC-VISUAL:THC-ENC-\d{3,} START -->[\s\S]*?<!-- THC-ENC-VISUAL:THC-ENC-\d{3,} END -->/i;
export const lessonVisualFigurePattern=/<figure\b[^>]*class=["'][^"']*\bthc-lesson-visual\b[^"']*["'][^>]*data-thc-lesson-visual-id=["']THC-ENC-\d{3,}["'][^>]*>[\s\S]*?<\/figure>/i;

export function existingLessonVisualBlock(raw){
  const text=String(raw||'');
  return text.match(lessonVisualCommentPattern)?.[0]||text.match(lessonVisualFigurePattern)?.[0]||null;
}

export function preserveExistingLessonVisual({slug,existingRaw,content}){
  if(!/^thc-enc-\d{3,}$/.test(String(slug||''))) return String(content??'');
  const next=String(content??'');
  const visual=existingLessonVisualBlock(existingRaw);
  if(!visual||next.includes('data-thc-lesson-visual-id=')) return next;
  const idx=next.indexOf(LESSON_VISUAL_ANCHOR);
  if(idx<0) return next;
  return next.slice(0,idx)+visual+'\n'+next.slice(idx);
}
