// Genetics slots use their reviewed registry, independently of education media.
// Self-contained so the runtime publisher can embed this function in /tmp.
export function reviewedGeneticsMedia(cards, media, slug) {
  const card = cards.find(item => item.wordpressSlug === slug);
  if (!card || !/^https:\/\//i.test(card.sourceUrl || '') || !card.altText) {
    throw new Error(`Missing reviewed genetics artwork for ${slug}`);
  }
  const match = media.find(item => item.slug === slug && /^https:\/\//i.test(item.source_url || ''));
  return {
    ...(match || {}),
    source_url: match?.source_url || card.sourceUrl,
    alt_text: card.altText
  };
}
