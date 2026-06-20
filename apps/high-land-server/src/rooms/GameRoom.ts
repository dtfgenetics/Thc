import { Client, Room } from 'colyseus';
import { PlayerState, ServerGameState, LogEntry } from '../schema/GameState.js';

const maxPlayers = 10;
const finishIndex = 71;

type JoinOptions = {
  name?: string;
  color?: string;
};

export class GameRoom extends Room<ServerGameState> {
  maxClients = maxPlayers;

  onCreate(): void {
    this.setState(new ServerGameState());
    this.state.phase = 'lobby';

    this.onMessage('ready', () => this.tryStartGame());
    this.onMessage('roll', (client) => this.rollForClient(client));
  }

  onJoin(client: Client, options: JoinOptions): void {
    const player = new PlayerState();
    player.id = client.sessionId;
    player.name = options.name || `Player ${this.state.playerOrder.length + 1}`;
    player.color = options.color || defaultColor(this.state.playerOrder.length);
    player.positionIndex = 0;
    player.connected = true;

    this.state.players.set(client.sessionId, player);
    this.state.playerOrder.push(client.sessionId);
    this.addLog(`${player.name} joined.`);
  }

  onLeave(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.connected = false;
      this.addLog(`${player.name} disconnected.`);
    }
  }

  private tryStartGame(): void {
    if (this.state.phase !== 'lobby') return;
    if (this.state.playerOrder.length < 2) return;
    this.state.phase = 'ready';
    this.addLog('Game started.');
  }

  private rollForClient(client: Client): void {
    if (this.state.phase === 'game_over') return;
    if (this.state.phase === 'lobby') this.tryStartGame();

    const currentPlayerId = this.state.playerOrder[this.state.currentPlayerIndex];
    if (client.sessionId !== currentPlayerId) return;

    const player = this.state.players.get(currentPlayerId);
    if (!player) return;

    if (player.skipTurns > 0) {
      player.skipTurns -= 1;
      this.addLog(`${player.name} misses this turn.`);
      this.advanceTurn();
      return;
    }

    const roll = Math.floor(Math.random() * 6) + 1;
    this.state.lastRoll = roll;
    player.positionIndex = Math.min(player.positionIndex + roll, finishIndex);
    this.addLog(`${player.name} rolled ${roll}.`);

    if (player.positionIndex >= finishIndex) {
      this.state.phase = 'game_over';
      this.state.winnerId = player.id;
      this.addLog(`${player.name} wins.`);
      return;
    }

    this.advanceTurn();
  }

  private advanceTurn(): void {
    if (this.state.playerOrder.length === 0) return;
    this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.playerOrder.length;
    this.state.phase = 'ready';
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
  return [
    '#f43f5e',
    '#22c55e',
    '#3b82f6',
    '#eab308',
    '#a855f7',
    '#14b8a6',
    '#f97316',
    '#ec4899',
    '#84cc16',
    '#38bdf8'
  ][index] || '#ffffff';
}
