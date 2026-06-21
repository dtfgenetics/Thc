import { Client, Room } from 'colyseus';
import { PlayerState, ServerGameState, LogEntry } from '../schema/GameState.js';
import { MAX_PLAYERS, MIN_PLAYERS, WIN_POSITION, calculateServerMove, normalizePlayerName, rollSixSidedDie } from '../rules/HighLandRules.js';

const tokenColors = ['#f43f5e', '#22c55e', '#3b82f6', '#eab308'];

type JoinOptions = { name?: string; color?: string };
type SetNameMessage = { name?: string };

export class GameRoom extends Room<ServerGameState> {
  maxClients = MAX_PLAYERS;

  onCreate(): void {
    this.setState(new ServerGameState());
    this.state.phase = 'lobby';
    this.state.roomCode = this.roomId;
    this.state.message = `Invite code: ${this.roomId}`;
    this.onMessage('setName', (client, message: SetNameMessage) => this.setPlayerName(client, message));
    this.onMessage('ready', () => this.tryStartGame());
    this.onMessage('roll', (client) => this.rollForClient(client));
  }

  onJoin(client: Client, options: JoinOptions): void {
    const playerNumber = this.state.playerOrder.length + 1;
    const player = new PlayerState();
    player.id = client.sessionId;
    player.name = normalizePlayerName(options.name, `Player ${playerNumber}`);
    player.color = options.color || defaultColor(this.state.playerOrder.length);
    player.positionIndex = 0;
    player.connected = true;
    this.state.players.set(client.sessionId, player);
    this.state.playerOrder.push(client.sessionId);
    this.state.message = `${player.name} joined the room.`;
    this.addLog(`${player.name} joined.`);
  }

  onLeave(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    player.connected = false;
    this.state.message = `${player.name} disconnected.`;
    this.addLog(`${player.name} disconnected.`);
  }

  private setPlayerName(client: Client, message: SetNameMessage): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || this.state.phase !== 'lobby') return;
    const fallback = player.name || `Player ${this.state.playerOrder.indexOf(client.sessionId) + 1}`;
    player.name = normalizePlayerName(message?.name, fallback);
    this.state.message = `${player.name} is ready.`;
  }

  private tryStartGame(): void {
    if (this.state.phase !== 'lobby') return;
    if (this.state.playerOrder.length < MIN_PLAYERS) {
      this.state.message = `Need at least ${MIN_PLAYERS} players to start.`;
      return;
    }
    this.state.phase = 'ready';
    this.state.currentPlayerIndex = 0;
    this.state.message = `${this.currentPlayerName()} starts. Roll the die.`;
    this.addLog('Game started.');
  }

  private rollForClient(client: Client): void {
    if (this.state.phase === 'game_over') return;
    if (this.state.phase === 'lobby') this.tryStartGame();
    if (this.state.phase !== 'ready') return;
    const currentPlayerId = this.state.playerOrder[this.state.currentPlayerIndex];
    if (client.sessionId !== currentPlayerId) {
      this.state.message = `It is ${this.currentPlayerName()}'s turn.`;
      return;
    }
    const player = this.state.players.get(currentPlayerId);
    if (!player) return;
    if (player.skipTurns > 0) {
      player.skipTurns -= 1;
      this.state.lastRoll = 0;
      this.addLog(`${player.name} misses this turn.`);
      this.advanceTurn();
      return;
    }
    const roll = rollSixSidedDie();
    const move = calculateServerMove(player.positionIndex, roll, 'dice');
    this.state.lastRoll = roll;
    player.positionIndex = move.toPosition;
    this.addLog(`${player.name} rolled ${roll} and moved to ${move.toPosition}.`);
    if (move.crossedFinish || player.positionIndex >= WIN_POSITION) {
      this.state.phase = 'game_over';
      this.state.winnerId = player.id;
      this.state.message = `${player.name} crossed the finish line and wins.`;
      this.addLog(`${player.name} wins.`);
      return;
    }
    this.advanceTurn();
  }

  private advanceTurn(): void {
    if (this.state.playerOrder.length === 0) return;
    this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.playerOrder.length;
    this.state.phase = 'ready';
    this.state.message = `${this.currentPlayerName()}'s turn.`;
  }

  private currentPlayerName(): string {
    const playerId = this.state.playerOrder[this.state.currentPlayerIndex];
    return this.state.players.get(playerId)?.name || 'next player';
  }

  private addLog(text: string): void {
    const entry = new LogEntry();
    entry.id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    entry.text = text;
    this.state.log.push(entry);
    while (this.state.log.length > 20) this.state.log.shift();
  }
}

function defaultColor(index: number): string {
  return tokenColors[index] || '#ffffff';
}
