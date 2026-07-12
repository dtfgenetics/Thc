import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { StoredRoom } from '../domain/roomTypes.js';

export interface RoomStore {
  get(code: string): StoredRoom | null;
  set(room: StoredRoom): void;
  delete(code: string): void;
  list(): StoredRoom[];
}

export class MemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, StoredRoom>();

  get(code: string): StoredRoom | null {
    return this.rooms.get(code) ?? null;
  }

  set(room: StoredRoom): void {
    this.rooms.set(room.code, room);
  }

  delete(code: string): void {
    this.rooms.delete(code);
  }

  list(): StoredRoom[] {
    return [...this.rooms.values()];
  }
}

export class JsonRoomStore implements RoomStore {
  private readonly rooms = new Map<string, StoredRoom>();

  constructor(private readonly filePath: string) {
    this.load();
  }

  get(code: string): StoredRoom | null {
    return this.rooms.get(code) ?? null;
  }

  set(room: StoredRoom): void {
    this.rooms.set(room.code, room);
    this.persist();
  }

  delete(code: string): void {
    this.rooms.delete(code);
    this.persist();
  }

  list(): StoredRoom[] {
    return [...this.rooms.values()];
  }

  private load(): void {
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as StoredRoom[];
      if (!Array.isArray(parsed)) return;
      for (const room of parsed) {
        if (room && typeof room.code === 'string') this.rooms.set(room.code, room);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') console.warn('Could not load room snapshot.', error);
    }
  }

  private persist(): void {
    const folder = dirname(this.filePath);
    mkdirSync(folder, { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(this.list(), null, 2), { encoding: 'utf8', mode: 0o600 });
    renameSync(temporaryPath, this.filePath);
  }
}

export function createRoomStoreFromEnvironment(): RoomStore {
  const filePath = process.env.ROOM_DATA_FILE?.trim();
  return filePath ? new JsonRoomStore(filePath) : new MemoryRoomStore();
}
