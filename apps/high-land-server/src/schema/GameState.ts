import { ArraySchema, Schema, type, MapSchema } from '@colyseus/schema';

export class PlayerState extends Schema {
  @type('string') id = '';
  @type('string') name = '';
  @type('string') color = '';
  @type('number') positionIndex = 0;
  @type('number') skipTurns = 0;
  @type('boolean') connected = true;
}

export class LogEntry extends Schema {
  @type('string') id = '';
  @type('string') text = '';
}

export class ServerGameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type(['string']) playerOrder = new ArraySchema<string>();
  @type('number') currentPlayerIndex = 0;
  @type('string') phase = 'lobby';
  @type('number') lastRoll = 0;
  @type('number') cardCursor = 0;
  @type('string') winnerId = '';
  @type('string') roomCode = '';
  @type('string') message = 'Waiting for players.';
  @type([LogEntry]) log = new ArraySchema<LogEntry>();
}
