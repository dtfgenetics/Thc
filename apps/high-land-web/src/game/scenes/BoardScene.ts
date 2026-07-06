import Phaser from 'phaser';
import { boardHeight, boardPath, boardWidth } from '../data/boardPath';
import { gameAssetPath } from '../systems/assetPath';
import { playMoveTickSound } from '../systems/audioSystem';
import { getMoveDuration, getTokenOffset, getTokenRadius } from '../systems/tokenLayoutSystem';
import type { BoardSpace, GameState, Player } from '../types/gameTypes';

type Point = { x: number; y: number };

export class BoardScene extends Phaser.Scene {
  private halos = new Map<string, Phaser.GameObjects.Arc>();
  private pieces = new Map<string, Phaser.GameObjects.Arc>();
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private lastPositions = new Map<string, number>();
  private calibrationText?: Phaser.GameObjects.Text;

  constructor() {
    super('BoardScene');
  }

  preload(): void {
    this.load.image('board-background', gameAssetPath('assets/images/board/high-land-board.png'));
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#080b09');

    if (this.textures.exists('board-background')) {
      this.add.image(boardWidth / 2, boardHeight / 2, 'board-background')
        .setDisplaySize(boardWidth, boardHeight)
        .setDepth(0);
    } else {
      this.add.text(boardWidth / 2, boardHeight / 2, 'The High Land board art could not be loaded.', {
        fontFamily: 'Arial',
        fontSize: '30px',
        color: '#ffffff',
        backgroundColor: '#521a2f',
        padding: { x: 24, y: 18 }
      }).setOrigin(0.5).setDepth(1);
    }

    if (showDebugSpaces()) this.drawSpaceMarkers();
    if (showCalibrationMode()) this.enableCalibrationMode();

    if (typeof window !== 'undefined') {
      window.addEventListener('game-state-update', this.handleStateUpdate as EventListener);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.removeGameStateListener);
      this.events.once(Phaser.Scenes.Events.DESTROY, this.removeGameStateListener);
    }

    const initialState = this.registry.get('initial-game-state') as GameState | undefined;
    if (initialState) this.renderGameState(initialState);
  }

  private removeGameStateListener = (): void => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('game-state-update', this.handleStateUpdate as EventListener);
    }
    this.tweens.killAll();
  };

  private handleStateUpdate = (event: CustomEvent<GameState>): void => {
    if (!this.sys.isActive()) return;
    this.renderGameState(event.detail);
  };

  private drawSpaceMarkers(): void {
    const graphics = this.add.graphics().setDepth(5);
    boardPath.forEach((space) => {
      graphics.lineStyle(space.type === 'action' ? 3 : 1, 0xffffff, space.type === 'action' ? 0.9 : 0.45);
      graphics.strokeRect(space.bounds.x, space.bounds.y, space.bounds.width, space.bounds.height);
      this.add.text(space.x, space.y, space.label ?? String(space.index + 1), {
        fontFamily: 'Arial',
        fontSize: space.type === 'action' ? '10px' : '8px',
        color: space.type === 'action' ? '#facc15' : '#ffffff',
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(6);
    });
  }

  private enableCalibrationMode(): void {
    this.calibrationText = this.add.text(12, boardHeight - 48, 'calibratePath: click a board square to copy x/y', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#111827',
      padding: { x: 10, y: 8 }
    }).setDepth(50);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const x = Math.round(pointer.worldX);
      const y = Math.round(pointer.worldY);
      const nearest = nearestBoardSpace(x, y);
      const text = `{ x: ${x}, y: ${y} } nearest space ${nearest.index + 1} (${Math.round(nearest.distance)}px)`;
      this.calibrationText?.setText(text);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(`{ x: ${x}, y: ${y} }`).catch(() => undefined);
      }
      if (typeof console !== 'undefined') console.info(`[High Land calibration] ${text}`);
    });
  }

  private renderGameState(state: GameState): void {
    this.removeStalePlayers(state.players);
    state.players.forEach((player, index) => this.renderPlayer(player, index, state.players.length, state));
  }

  private removeStalePlayers(players: Player[]): void {
    const activePlayerIds = new Set(players.map((player) => player.id));
    this.halos.forEach((halo, playerId) => {
      if (activePlayerIds.has(playerId)) return;
      this.tweens.killTweensOf(halo);
      halo.destroy();
      this.halos.delete(playerId);
    });
    this.pieces.forEach((piece, playerId) => {
      if (activePlayerIds.has(playerId)) return;
      this.tweens.killTweensOf(piece);
      piece.destroy();
      this.pieces.delete(playerId);
      this.lastPositions.delete(playerId);
    });
    this.labels.forEach((label, playerId) => {
      if (activePlayerIds.has(playerId)) return;
      this.tweens.killTweensOf(label);
      label.destroy();
      this.labels.delete(playerId);
    });
  }

  private renderPlayer(player: Player, playerIndex: number, playerCount: number, state: GameState): void {
    const currentSpace = boardPath[player.positionIndex] ?? boardPath[0];
    const offset = getTokenOffset(playerIndex, playerCount);
    const radius = getTokenRadius(playerCount);
    const target = getTokenTarget(currentSpace, offset.x, offset.y, radius);
    const activePlayerId = state.players[state.currentPlayerIndex]?.id;
    const isActivePlayer = player.id === activePlayerId && state.phase !== 'game_over';
    let halo = this.halos.get(player.id);
    let piece = this.pieces.get(player.id);
    let label = this.labels.get(player.id);

    if (!halo) {
      halo = this.add.circle(target.x, target.y, radius + 6, 0xfacc15, 0)
        .setStrokeStyle(3, 0xfacc15, 0)
        .setDepth(18);
      this.halos.set(player.id, halo);
    }

    if (!piece) {
      piece = this.add.circle(target.x, target.y, radius, Phaser.Display.Color.HexStringToColor(player.color).color, 1)
        .setStrokeStyle(3, 0xffffff)
        .setDepth(20);
      label = this.add.text(target.x, target.y, String(playerIndex + 1), {
        fontFamily: 'Arial',
        fontSize: playerCount > 8 ? '9px' : '11px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#111111',
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(21);
      this.pieces.set(player.id, piece);
      this.labels.set(player.id, label);
      this.lastPositions.set(player.id, player.positionIndex);
      this.updateTokenEmphasis(halo, piece, isActivePlayer, radius);
      return;
    }

    this.updateTokenEmphasis(halo, piece, isActivePlayer, radius);
    piece.setRadius(isActivePlayer ? radius + 1 : radius);
    piece.setFillStyle(Phaser.Display.Color.HexStringToColor(player.color).color, 1);
    label?.setText(String(playerIndex + 1));
    label?.setFontSize(playerCount > 8 ? '9px' : '11px');

    const fromIndex = this.lastPositions.get(player.id) ?? player.positionIndex;
    this.lastPositions.set(player.id, player.positionIndex);
    const targets = buildAnimationPath(player.id, fromIndex, player.positionIndex, state).map((index) => {
      const space = boardPath[index] ?? currentSpace;
      return getTokenTarget(space, offset.x, offset.y, radius);
    });

    if (targets.length === 0) {
      halo.setPosition(target.x, target.y);
      piece.setPosition(target.x, target.y);
      label?.setPosition(target.x, target.y);
      return;
    }

    this.tweens.killTweensOf(halo);
    this.tweens.killTweensOf(piece);
    if (label) this.tweens.killTweensOf(label);
    this.animateTargets(label ? [halo, piece, label] : [halo, piece], targets, getMoveDuration(playerCount));
  }

  private updateTokenEmphasis(halo: Phaser.GameObjects.Arc, piece: Phaser.GameObjects.Arc, isActivePlayer: boolean, radius: number): void {
    halo.setRadius(isActivePlayer ? radius + 7 : radius + 4);
    halo.setAlpha(isActivePlayer ? 0.92 : 0.18);
    halo.setStrokeStyle(isActivePlayer ? 3 : 1, isActivePlayer ? 0xfacc15 : 0xffffff, isActivePlayer ? 0.95 : 0.28);
    piece.setStrokeStyle(isActivePlayer ? 4 : 3, isActivePlayer ? 0xfacc15 : 0xffffff, 1);
  }

  private animateTargets(targets: Phaser.GameObjects.GameObject[], positions: Point[], duration: number, index = 0): void {
    const position = positions[index];
    if (!position) return;
    this.tweens.add({
      targets,
      x: position.x,
      y: position.y,
      duration,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        playMoveTickSound();
        this.animateTargets(targets, positions, duration, index + 1);
      }
    });
  }
}

function showDebugSpaces(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debugPath');
}

function showCalibrationMode(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('calibratePath');
}

function getTokenTarget(space: BoardSpace, offsetX: number, offsetY: number, radius: number): Point {
  const padding = radius + 3;
  return {
    x: Phaser.Math.Clamp(space.x + offsetX, space.bounds.x + padding, space.bounds.x + space.bounds.width - padding),
    y: Phaser.Math.Clamp(space.y + offsetY, space.bounds.y + padding, space.bounds.y + space.bounds.height - padding)
  };
}

function buildAnimationPath(playerId: string, fromIndex: number, finalIndex: number, state: GameState): number[] {
  const lastMove = state.lastMove;
  if (lastMove?.playerId !== playerId || lastMove.fromIndex !== fromIndex) {
    return buildPathIndexes(fromIndex, finalIndex);
  }

  const dicePath = lastMove.traversedIndexes;
  if (lastMove.toIndex === finalIndex) return dicePath;
  return [...dicePath, ...buildPathIndexes(lastMove.toIndex, finalIndex)];
}

function buildPathIndexes(fromIndex: number, toIndex: number): number[] {
  if (fromIndex === toIndex) return [];
  const step = toIndex > fromIndex ? 1 : -1;
  const indexes: number[] = [];
  for (let index = fromIndex + step; step > 0 ? index <= toIndex : index >= toIndex; index += step) {
    indexes.push(index);
  }
  return indexes;
}

function nearestBoardSpace(x: number, y: number): { index: number; distance: number } {
  return boardPath.reduce(
    (nearest, space) => {
      const distance = Math.hypot(space.x - x, space.y - y);
      return distance < nearest.distance ? { index: space.index, distance } : nearest;
    },
    { index: 0, distance: Number.POSITIVE_INFINITY }
  );
}
