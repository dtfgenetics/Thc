import Phaser from 'phaser';
import { boardPath } from '../data/boardPath';
import type { GameState, Player, SpaceColor } from '../types/gameTypes';
import { gameAssetPath } from '../systems/assetPath';
import { getMoveDuration, getTokenOffset, getTokenRadius } from '../systems/tokenLayoutSystem';

const colorMap: Record<SpaceColor, number> = {
  red: 0xef4444,
  yellow: 0xfacc15,
  green: 0x22c55e,
  blue: 0x3b82f6,
  purple: 0xa855f7
};

type TokenTarget = {
  x: number;
  y: number;
};

export class BoardScene extends Phaser.Scene {
  private tokenSprites = new Map<string, Phaser.GameObjects.Arc>();
  private tokenLabels = new Map<string, Phaser.GameObjects.Text>();
  private lastPositions = new Map<string, number>();
  private messageText?: Phaser.GameObjects.Text;
  private hasBoardArt = false;

  constructor() {
    super('BoardScene');
  }

  preload(): void {
    this.load.image('board-background', gameAssetPath('assets/images/board/high-land-board.png'));
    this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {
      this.hasBoardArt = false;
    });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#141020');

    if (this.textures.exists('board-background')) {
      this.hasBoardArt = true;
      this.add.image(400, 450, 'board-background').setDisplaySize(800, 900).setDepth(0);
    } else {
      this.drawBackgroundZones();
    }

    this.drawPath();
    this.messageText = this.add.text(24, 18, 'Ready', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setDepth(20);

    if (typeof window !== 'undefined') {
      window.addEventListener('game-state-update', this.handleStateUpdate as EventListener);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.removeGameStateListener);
      this.events.once(Phaser.Scenes.Events.DESTROY, this.removeGameStateListener);
    }
  }

  private removeGameStateListener = (): void => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('game-state-update', this.handleStateUpdate as EventListener);
    }
  };

  private handleStateUpdate = (event: CustomEvent<GameState>): void => {
    this.renderGameState(event.detail);
  };

  private drawBackgroundZones(): void {
    const graphics = this.add.graphics();
    const zones = [
      { x: 0, y: 0, w: 240, h: 300, color: 0x284d3a, label: 'Rolling Hills' },
      { x: 240, y: 0, w: 260, h: 300, color: 0x17331f, label: 'Dankwood Forest' },
      { x: 500, y: 0, w: 300, h: 300, color: 0x6d3f18, label: 'Rosin Rail Station' },
      { x: 0, y: 300, w: 300, h: 300, color: 0x6b2f64, label: 'Munchie Mountain' },
      { x: 300, y: 300, w: 250, h: 300, color: 0x33323a, label: 'Kief Caves' },
      { x: 550, y: 300, w: 250, h: 300, color: 0x24506a, label: 'Trichome Towers' },
      { x: 0, y: 600, w: 800, h: 300, color: 0x3d4f8f, label: 'Cloud 9 Citadel' }
    ];

    zones.forEach((zone) => {
      graphics.fillStyle(zone.color, 0.56);
      graphics.fillRoundedRect(zone.x, zone.y, zone.w, zone.h, 28);
      this.add.text(zone.x + 18, zone.y + 18, zone.label, {
        fontFamily: 'Arial',
        fontSize: '19px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3
      }).setDepth(2);
    });
  }

  private drawPath(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(24, 0xffffff, this.hasBoardArt ? 0.55 : 0.92);

    for (let index = 0; index < boardPath.length - 1; index += 1) {
      const current = boardPath[index];
      const next = boardPath[index + 1];
      graphics.lineBetween(current.x, current.y, next.x, next.y);
    }

    boardPath.forEach((space) => {
      const fill = colorMap[space.color];
      const radius = space.type === 'start' || space.type === 'finish' ? 24 : space.type === 'action' ? 21 : 17;
      this.add.circle(space.x, space.y, radius + 4, 0xffffff, this.hasBoardArt ? 0.72 : 1).setDepth(5);
      this.add.circle(space.x, space.y, radius, fill, this.hasBoardArt ? 0.86 : 1).setDepth(6);

      if (space.label) {
        this.add.text(space.x, space.y - 8, space.label, {
          fontFamily: 'Arial',
          fontSize: space.label.length > 5 ? '10px' : '12px',
          color: '#111111',
          fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(7);
      }
    });
  }

  private renderGameState(state: GameState): void {
    if (this.messageText) {
      this.messageText.setText(state.message);
    }

    this.removeStalePlayers(state.players);
    state.players.forEach((player, playerIndex) => this.renderPlayer(player, playerIndex, state.players.length));
  }

  private removeStalePlayers(players: Player[]): void {
    const activePlayerIds = new Set(players.map((player) => player.id));

    this.tokenSprites.forEach((token, playerId) => {
      if (activePlayerIds.has(playerId)) return;
      this.tweens.killTweensOf(token);
      token.destroy();
      this.tokenSprites.delete(playerId);
      this.lastPositions.delete(playerId);
    });

    this.tokenLabels.forEach((label, playerId) => {
      if (activePlayerIds.has(playerId)) return;
      this.tweens.killTweensOf(label);
      label.destroy();
      this.tokenLabels.delete(playerId);
    });
  }

  private renderPlayer(player: Player, playerIndex: number, playerCount: number): void {
    const currentSpace = boardPath[player.positionIndex] ?? boardPath[0];
    const offset = getTokenOffset(playerIndex, playerCount);
    const tokenRadius = getTokenRadius(playerCount);
    const targetX = currentSpace.x + offset.x;
    const targetY = currentSpace.y + offset.y;

    let token = this.tokenSprites.get(player.id);
    let label = this.tokenLabels.get(player.id);

    if (!token) {
      token = this.add.circle(targetX, targetY, tokenRadius, Phaser.Display.Color.HexStringToColor(player.color).color, 1)
        .setStrokeStyle(3, 0xffffff)
        .setDepth(12);
      label = this.add.text(targetX, targetY, String(playerIndex + 1), {
        fontFamily: 'Arial',
        fontSize: playerCount > 8 ? '10px' : '12px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(13);
      this.tokenSprites.set(player.id, token);
      this.tokenLabels.set(player.id, label);
      this.lastPositions.set(player.id, player.positionIndex);
      return;
    }

    token.setRadius(tokenRadius);
    token.setFillStyle(Phaser.Display.Color.HexStringToColor(player.color).color, 1);
    label?.setText(String(playerIndex + 1));
    label?.setFontSize(playerCount > 8 ? '10px' : '12px');

    const fromIndex = this.lastPositions.get(player.id) ?? player.positionIndex;
    this.lastPositions.set(player.id, player.positionIndex);

    const pathIndexes = buildPathIndexes(fromIndex, player.positionIndex);
    const targets = pathIndexes.map((index) => {
      const space = boardPath[index] ?? currentSpace;
      return { x: space.x + offset.x, y: space.y + offset.y };
    });

    if (targets.length <= 1) {
      token.setPosition(targetX, targetY);
      label?.setPosition(targetX, targetY);
      return;
    }

    this.tweens.killTweensOf(token);
    if (label) this.tweens.killTweensOf(label);
    this.animateTokenTargets(label ? [token, label] : [token], targets, getMoveDuration(playerCount));
  }

  private animateTokenTargets(targets: Phaser.GameObjects.GameObject[], positions: TokenTarget[], duration: number, index = 0): void {
    const position = positions[index];
    if (!position) return;

    this.tweens.add({
      targets,
      x: position.x,
      y: position.y,
      duration,
      ease: 'Sine.easeInOut',
      onComplete: () => this.animateTokenTargets(targets, positions, duration, index + 1)
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
