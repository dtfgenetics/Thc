import Phaser from 'phaser';
import { boardPath } from '../data/boardPath';
import type { BoardSpace, GameState, Player } from '../types/gameTypes';
import { gameAssetPath } from '../systems/assetPath';
import { getMoveDuration, getTokenOffset, getTokenRadius } from '../systems/tokenLayoutSystem';

type Point = { x: number; y: number };

export class BoardScene extends Phaser.Scene {
  private pieces = new Map<string, Phaser.GameObjects.Arc>();
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private lastPositions = new Map<string, number>();
  private messageText?: Phaser.GameObjects.Text;

  constructor() {
    super('BoardScene');
  }

  preload(): void {
    this.load.image('board-background', gameAssetPath('assets/images/board/high-land-board.png'));
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#141020');
    this.add.image(400, 450, 'board-background').setDisplaySize(800, 900).setDepth(0);

    if (showDebugSpaces()) this.drawSpaceMarkers();

    this.messageText = this.add.text(24, 18, 'Ready', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setDepth(30);

    if (typeof window !== 'undefined') {
      window.addEventListener('game-state-update', this.handleStateUpdate as EventListener);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.removeGameStateListener);
      this.events.once(Phaser.Scenes.Events.DESTROY, this.removeGameStateListener);
    }
  }

  private removeGameStateListener = (): void => {
    if (typeof window !== 'undefined') window.removeEventListener('game-state-update', this.handleStateUpdate as EventListener);
  };

  private handleStateUpdate = (event: CustomEvent<GameState>): void => this.renderGameState(event.detail);

  private drawSpaceMarkers(): void {
    const graphics = this.add.graphics().setDepth(5);
    boardPath.forEach((space) => {
      graphics.lineStyle(space.type === 'action' ? 3 : 1, 0xffffff, space.type === 'action' ? 0.9 : 0.45);
      graphics.strokeRect(space.bounds.x, space.bounds.y, space.bounds.width, space.bounds.height);
      if (space.label) {
        this.add.text(space.x, space.y, space.label, {
          fontFamily: 'Arial',
          fontSize: space.type === 'action' ? '10px' : '9px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3
        }).setOrigin(0.5).setDepth(6);
      }
    });
  }

  private renderGameState(state: GameState): void {
    this.messageText?.setText(state.message);
    this.removeStalePlayers(state.players);
    state.players.forEach((player, index) => this.renderPlayer(player, index, state.players.length));
  }

  private removeStalePlayers(players: Player[]): void {
    const activePlayerIds = new Set(players.map((player) => player.id));
    this.pieces.forEach((piece, playerId) => {
      if (activePlayerIds.has(playerId)) return;
      piece.destroy();
      this.pieces.delete(playerId);
      this.lastPositions.delete(playerId);
    });
    this.labels.forEach((label, playerId) => {
      if (activePlayerIds.has(playerId)) return;
      label.destroy();
      this.labels.delete(playerId);
    });
  }

  private renderPlayer(player: Player, playerIndex: number, playerCount: number): void {
    const currentSpace = boardPath[player.positionIndex] ?? boardPath[0];
    const offset = getTokenOffset(playerIndex, playerCount);
    const radius = getTokenRadius(playerCount);
    const target = getTokenTarget(currentSpace, offset.x, offset.y);
    let piece = this.pieces.get(player.id);
    let label = this.labels.get(player.id);

    if (!piece) {
      piece = this.add.circle(target.x, target.y, radius, Phaser.Display.Color.HexStringToColor(player.color).color, 1).setStrokeStyle(3, 0xffffff).setDepth(20);
      label = this.add.text(target.x, target.y, String(playerIndex + 1), { fontFamily: 'Arial', fontSize: playerCount > 8 ? '10px' : '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(21);
      this.pieces.set(player.id, piece);
      this.labels.set(player.id, label);
      this.lastPositions.set(player.id, player.positionIndex);
      return;
    }

    piece.setRadius(radius);
    piece.setFillStyle(Phaser.Display.Color.HexStringToColor(player.color).color, 1);
    label?.setText(String(playerIndex + 1));
    label?.setFontSize(playerCount > 8 ? '10px' : '12px');

    const fromIndex = this.lastPositions.get(player.id) ?? player.positionIndex;
    this.lastPositions.set(player.id, player.positionIndex);
    const targets = buildPathIndexes(fromIndex, player.positionIndex).map((index) => getTokenTarget(boardPath[index] ?? currentSpace, offset.x, offset.y));

    if (targets.length <= 1) {
      piece.setPosition(target.x, target.y);
      label?.setPosition(target.x, target.y);
      return;
    }

    this.animateTargets(label ? [piece, label] : [piece], targets, getMoveDuration(playerCount));
  }

  private animateTargets(targets: Phaser.GameObjects.GameObject[], positions: Point[], duration: number, index = 0): void {
    const position = positions[index];
    if (!position) return;
    this.tweens.add({ targets, x: position.x, y: position.y, duration, ease: 'Sine.easeInOut', onComplete: () => this.animateTargets(targets, positions, duration, index + 1) });
  }
}

function showDebugSpaces(): boolean {
  return typeof window !== 'undefined' && (import.meta.env.DEV || new URLSearchParams(window.location.search).has('debugPath'));
}

function getTokenTarget(space: BoardSpace, offsetX: number, offsetY: number): Point {
  const padding = 6;
  return {
    x: Phaser.Math.Clamp(space.x + offsetX, space.bounds.x + padding, space.bounds.x + space.bounds.width - padding),
    y: Phaser.Math.Clamp(space.y + offsetY, space.bounds.y + padding, space.bounds.y + space.bounds.height - padding)
  };
}

function buildPathIndexes(fromIndex: number, toIndex: number): number[] {
  if (fromIndex === toIndex) return [toIndex];
  const step = toIndex > fromIndex ? 1 : -1;
  const indexes: number[] = [];
  for (let index = fromIndex + step; step > 0 ? index <= toIndex : index >= toIndex; index += step) indexes.push(index);
  return indexes;
}