import Phaser from 'phaser';
import { boardHeight, boardPath, boardWidth } from '../data/boardPath';
import type { GameState, Player } from '../types/gameTypes';
import { getMoveDuration, getTokenOffset, getTokenRadius } from '../systems/tokenLayoutSystem';

const colorMap: Record<string, number> = {
  red: 0xef4444,
  yellow: 0xfacc15,
  green: 0x22c55e,
  blue: 0x3b82f6,
  purple: 0xa855f7,
  special: 0xffffff
};

export class BoardScene extends Phaser.Scene {
  private tokenContainers = new Map<string, Phaser.GameObjects.Container>();
  private tokenSprites = new Map<string, Phaser.GameObjects.Arc>();
  private tokenLabels = new Map<string, Phaser.GameObjects.Text>();
  private tokenNameLabels = new Map<string, Phaser.GameObjects.Text>();
  private lastPositions = new Map<string, number>();
  private hasBoardArt = false;

  constructor() {
    super('BoardScene');
  }

  preload(): void {
    const boardImageUrl = this.registry.get('board-image-url') as string | null;
    if (boardImageUrl) {
      this.load.image('board-background', boardImageUrl);
      this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {
        this.hasBoardArt = false;
      });
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#141020');

    if (this.textures.exists('board-background')) {
      this.hasBoardArt = true;
      this.add.image(boardWidth / 2, boardHeight / 2, 'board-background')
        .setDisplaySize(boardWidth, boardHeight)
        .setDepth(0);
    } else {
      this.drawBackgroundZones();
      this.drawPath();
    }

    window.addEventListener('game-state-update', this.handleStateUpdate as EventListener);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
    const initialState = this.registry.get('initial-game-state') as GameState | undefined;
    if (initialState) this.renderGameState(initialState);
  }

  private cleanup(): void {
    window.removeEventListener('game-state-update', this.handleStateUpdate as EventListener);
    this.tweens.killAll();
    this.tokenContainers.clear();
    this.tokenSprites.clear();
    this.tokenLabels.clear();
    this.tokenNameLabels.clear();
    this.lastPositions.clear();
  }

  private handleStateUpdate = (event: CustomEvent<GameState>): void => {
    if (!this.sys.isActive()) return;
    this.renderGameState(event.detail);
  };

  private drawBackgroundZones(): void {
    const graphics = this.add.graphics();
    const zones = [
      { x: 0, y: 0, w: 384, h: 320, color: 0x284d3a, label: 'Rolling Hills' },
      { x: 384, y: 0, w: 416, h: 320, color: 0x17331f, label: 'Dankwood Forest' },
      { x: 800, y: 0, w: 480, h: 320, color: 0x6d3f18, label: 'Rosin Rail Station' },
      { x: 0, y: 320, w: 480, h: 320, color: 0x6b2f64, label: 'Munchie Mountain' },
      { x: 480, y: 320, w: 400, h: 320, color: 0x33323a, label: 'Kief Caves' },
      { x: 880, y: 320, w: 400, h: 320, color: 0x24506a, label: 'Trichome Towers' },
      { x: 0, y: 640, w: 1280, h: 320, color: 0x3d4f8f, label: 'Cloud 9 Citadel' }
    ];

    zones.forEach((zone) => {
      graphics.fillStyle(zone.color, 0.56);
      graphics.fillRoundedRect(zone.x, zone.y, zone.w, zone.h, 32);
      this.add.text(zone.x + 24, zone.y + 24, zone.label, {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3
      }).setDepth(2);
    });
  }

  private drawPath(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(36, 0xffffff, 0.92);

    for (let index = 0; index < boardPath.length - 1; index += 1) {
      const current = boardPath[index];
      const next = boardPath[index + 1];
      graphics.lineBetween(current.x, current.y, next.x, next.y);
    }

    boardPath.forEach((space) => {
      const fill = colorMap[space.color];
      const radius = space.type === 'start' || space.type === 'finish' ? 32 : space.type === 'action' ? 28 : 22;
      this.add.circle(space.x, space.y, radius + 5, 0xffffff, 1).setDepth(5);
      this.add.circle(space.x, space.y, radius, fill, 1).setDepth(6);

      if (space.label) {
        this.add.text(space.x, space.y - 8, space.label, {
          fontFamily: 'Arial',
          fontSize: space.label.length > 5 ? '14px' : '16px',
          color: '#111111',
          fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(7);
      }
    });
  }

  private renderGameState(state: GameState): void {
    state.players.forEach((player, playerIndex) => this.renderPlayer(
      player,
      playerIndex,
      state.players.length,
      playerIndex === state.currentPlayerIndex && state.phase !== 'game_over'
    ));
  }

  private renderPlayer(player: Player, playerIndex: number, playerCount: number, isCurrentPlayer: boolean): void {
    const currentSpace = boardPath[player.positionIndex] ?? boardPath[0];
    const offset = getTokenOffset(playerIndex, playerCount);
    const tokenRadius = getTokenRadius(playerCount);
    const targetX = currentSpace.x + offset.x;
    const targetY = currentSpace.y + offset.y;

    let container = this.tokenContainers.get(player.id);
    const token = this.tokenSprites.get(player.id);
    const label = this.tokenLabels.get(player.id);
    const nameLabel = this.tokenNameLabels.get(player.id);

    if (!container || !token) {
      const newToken = this.add.circle(0, 0, tokenRadius, Phaser.Display.Color.HexStringToColor(player.color).color, 1)
        .setStrokeStyle(isCurrentPlayer ? 6 : 3, isCurrentPlayer ? 0xffd86a : 0xffffff);
      const newLabel = this.add.text(0, 0, String(playerIndex + 1), {
        fontFamily: 'Arial',
        fontSize: playerCount > 8 ? '10px' : '12px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      const newNameLabel = this.add.text(0, tokenRadius + 12, player.name, {
        fontFamily: 'Arial',
        fontSize: playerCount > 6 ? '9px' : '11px',
        color: '#ffffff',
        backgroundColor: 'rgba(8, 10, 9, 0.82)',
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5, 0);
      container = this.add.container(targetX, targetY, [newToken, newLabel, newNameLabel]).setDepth(12);
      this.tokenContainers.set(player.id, container);
      this.tokenSprites.set(player.id, newToken);
      this.tokenLabels.set(player.id, newLabel);
      this.tokenNameLabels.set(player.id, newNameLabel);
      this.lastPositions.set(player.id, player.positionIndex);
      return;
    }

    token.setRadius(tokenRadius);
    token.setStrokeStyle(isCurrentPlayer ? 6 : 3, isCurrentPlayer ? 0xffd86a : 0xffffff);
    token.setScale(isCurrentPlayer ? 1.12 : 1);
    label?.setText(String(playerIndex + 1));
    nameLabel?.setText(player.name).setPosition(0, tokenRadius + 12);

    const fromIndex = this.lastPositions.get(player.id) ?? player.positionIndex;
    this.lastPositions.set(player.id, player.positionIndex);

    const pathIndexes = buildPathIndexes(fromIndex, player.positionIndex);
    const targets = pathIndexes.map((index) => {
      const space = boardPath[index] ?? currentSpace;
      return { x: space.x + offset.x, y: space.y + offset.y };
    });

    if (targets.length <= 1) {
      container.setPosition(targetX, targetY);
      return;
    }

    this.tweens.killTweensOf(container);

    this.tweens.chain({
      targets: container,
      tweens: targets.map((target) => ({
        x: target.x,
        y: target.y,
        duration: getMoveDuration(playerCount),
        ease: 'Sine.easeInOut'
      }))
    });
  }
}

function buildPathIndexes(fromIndex: number, toIndex: number): number[] {
  if (fromIndex === toIndex) return [toIndex];
  const step = toIndex > fromIndex ? 1 : -1;
  const indexes: number[] = [];
  for (let index = fromIndex + step; step > 0 ? index <= toIndex : index >= toIndex; index += step) {
    indexes.push(index);
  }
  return indexes;
}
