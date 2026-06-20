import Phaser from 'phaser';
import { BoardScene } from './scenes/BoardScene';
import type { GameState } from './types/gameTypes';

export function createHighLandGame(
  parent: HTMLElement,
  boardImageUrl: string | undefined,
  initialState: GameState
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width: 800,
    height: 900,
    backgroundColor: '#141020',
    fps: {
      target: 30,
      forceSetTimeOut: true
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    callbacks: {
      preBoot: (game) => {
        game.registry.set('board-image-url', boardImageUrl ?? null);
        game.registry.set('initial-game-state', initialState);
      }
    },
    scene: [BoardScene]
  });
}
