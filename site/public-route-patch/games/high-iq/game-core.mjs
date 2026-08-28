export function hashString(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(seedText) {
  let state = hashString(String(seedText)) || 0x9e3779b9;
  return function rng() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle(items, seedText = `${Date.now()}`) {
  const copy = [...items];
  const rng = createRng(seedText);
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function balancedSample(items, count, seedText = `${Date.now()}-${Math.random()}`) {
  const target = Math.max(0, Math.min(Number(count) || 0, items.length));
  if (!target) return [];
  const rngSeed = String(seedText);
  const grouped = new Map();

  for (const item of items) {
    const key = `${item.category || 'Unknown'}|||${item.difficulty || 'Unknown'}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }

  const buckets = [...grouped.entries()].map(([key, values], index) => ({
    key,
    values: seededShuffle(values, `${rngSeed}|bucket|${index}|${key}`),
    cursor: 0
  }));
  const order = seededShuffle(buckets, `${rngSeed}|bucket-order`);
  const selected = [];
  const selectedIds = new Set();

  while (selected.length < target) {
    let added = false;
    for (const bucket of order) {
      if (selected.length >= target) break;
      while (bucket.cursor < bucket.values.length) {
        const candidate = bucket.values[bucket.cursor++];
        const id = candidate.id ?? candidate;
        if (selectedIds.has(id)) continue;
        selected.push(candidate);
        selectedIds.add(id);
        added = true;
        break;
      }
    }
    if (!added) break;
  }

  if (selected.length < target) {
    const remainder = seededShuffle(
      items.filter((item) => !selectedIds.has(item.id ?? item)),
      `${rngSeed}|remainder`
    );
    for (const item of remainder) {
      if (selected.length >= target) break;
      selected.push(item);
      selectedIds.add(item.id ?? item);
    }
  }

  return seededShuffle(selected, `${rngSeed}|final-order`);
}

export function shouldIgnoreQuizShortcutTarget(target = {}) {
  const tagName = String(target.tagName || '').toLowerCase();
  if (target.isContentEditable) return true;
  return ['a', 'input', 'select', 'textarea', 'summary'].includes(tagName);
}

export function rankForPercent(percent) {
  if (percent >= 92) return 'High IQ Master';
  if (percent >= 82) return 'Advanced';
  if (percent >= 70) return 'Proficient';
  if (percent >= 58) return 'Developing';
  return 'Study Run';
}
