const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DEFAULT_ROOM_CODE_LENGTH = 6;

export function createRoomCode(random: () => number = Math.random, length = DEFAULT_ROOM_CODE_LENGTH): string {
  const safeLength = Math.max(4, Math.min(8, Math.floor(length)));
  let code = '';

  for (let index = 0; index < safeLength; index += 1) {
    const alphabetIndex = Math.floor(random() * ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET[alphabetIndex];
  }

  return code;
}

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function isValidRoomCode(input: string): boolean {
  const normalized = normalizeRoomCode(input);
  return normalized.length >= 4 && normalized.length <= 8 && [...normalized].every((character) => ROOM_CODE_ALPHABET.includes(character));
}

export function requireValidRoomCode(input: string): string {
  const normalized = normalizeRoomCode(input);
  if (!isValidRoomCode(normalized)) {
    throw new Error('Room code must be 4-8 supported letters or numbers.');
  }
  return normalized;
}
