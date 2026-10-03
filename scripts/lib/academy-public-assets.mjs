export function assetIdFromBlock(block) {
  return block?.assetId || block?.extensions?.assetId || null;
}

export function lessonPrimaryVisuals(lesson) {
  const blocks = lesson?.content?.blocks || [];
  const blockAssetIds = new Set(blocks.map(assetIdFromBlock).filter(Boolean));
  return (lesson?.content?.extensions?.primaryVisuals || []).filter(visual =>
    visual?.type === 'image' &&
    assetIdFromBlock(visual) &&
    (visual.src || visual.url) &&
    !blockAssetIds.has(assetIdFromBlock(visual))
  );
}

export function lessonAssetBlocks(lesson) {
  const blocks = (lesson?.content?.blocks || []).filter(block =>
    (block?.type === 'image' && assetIdFromBlock(block) && (block.src || block.url)) ||
    (block?.type === 'resource' && assetIdFromBlock(block) && block.href)
  );
  return [...blocks, ...lessonPrimaryVisuals(lesson)];
}
