export const CARD_CODE_LENGTH = 6;
export const CARD_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeCardCode(value) {
  const allowed = new Set(CARD_CODE_ALPHABET);
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .split('')
    .filter((character) => allowed.has(character))
    .join('')
    .slice(0, CARD_CODE_LENGTH);
}

export function isValidCardCode(value) {
  return normalizeCardCode(value).length === CARD_CODE_LENGTH;
}
