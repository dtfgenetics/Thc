import type { HighLandRoomPlayer, HighLandRoomState } from './roomState';
import type { GameState } from '../types/gameTypes';

export type WebsiteRoomPayload = {
  code: string;
  status?: HighLandRoomState['status'];
  players?: HighLandRoomPlayer[];
  state?: GameState | null;
  createdAt?: string;
  updatedAt?: string;
};

type WebsiteRoomResponse = {
  ok: boolean;
  room?: WebsiteRoomPayload;
  error?: string;
};

export function defaultWebsiteRoomApiBase(): string {
  if (typeof window === 'undefined') return '/api/';
  return new URL('api/', window.location.href).toString();
}

export async function postWebsiteRoomApi(apiBase: string, endpoint: string, body: unknown): Promise<HighLandRoomState> {
  const response = await fetch(joinApiUrl(apiBase, endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return parseWebsiteRoomResponse(response);
}

export async function getWebsiteRoomApi(apiBase: string, roomCode: string): Promise<HighLandRoomState> {
  const url = `${joinApiUrl(apiBase, 'get-room.php')}?room=${encodeURIComponent(roomCode)}`;
  const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
  return parseWebsiteRoomResponse(response);
}

function joinApiUrl(apiBase: string, endpoint: string): string {
  return `${apiBase.endsWith('/') ? apiBase : `${apiBase}/`}${endpoint}`;
}

async function parseWebsiteRoomResponse(response: Response): Promise<HighLandRoomState> {
  const payload = (await response.json().catch(() => null)) as WebsiteRoomResponse | null;
  if (!response.ok || !payload?.ok || !payload.room) {
    throw new Error(payload?.error ?? `Room API failed with status ${response.status}.`);
  }
  return normalizeWebsiteRoom(payload.room);
}

function normalizeWebsiteRoom(room: WebsiteRoomPayload): HighLandRoomState {
  const players = Array.isArray(room.players) ? room.players.map(normalizeWebsitePlayer) : [];
  const host = players.find((player) => player.host) ?? players[0];
  const createdAt = room.createdAt ?? new Date().toISOString();
  return {
    id: room.code,
    code: room.code,
    status: room.status ?? 'waiting',
    hostPlayerId: host?.id ?? '',
    players,
    gameState: room.state ?? null,
    createdAt,
    updatedAt: room.updatedAt ?? createdAt
  };
}

function normalizeWebsitePlayer(player: HighLandRoomPlayer): HighLandRoomPlayer {
  return {
    ...player,
    connected: player.connected ?? true,
    host: player.host ?? false,
    joinedAt: player.joinedAt ?? new Date().toISOString()
  };
}
