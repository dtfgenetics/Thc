import Phaser from 'phaser';
import { BoardScene } from './scenes/BoardScene';
import type { GameState } from './types/gameTypes';

export function createHighLandGame(parent: HTMLElement, initialState: GameState): Phaser.Game {
  return new Phaser.Game({
    type: getHighLandRendererType(),
    parent,
    width: 1280,
    height: 960,
    backgroundColor: '#080b09',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    callbacks: {
      preBoot: (game) => game.registry.set('initial-game-state', initialState)
    },
    scene: [BoardScene]
  });
}

export function getHighLandRendererType(matchMedia: typeof window.matchMedia = window.matchMedia): typeof Phaser.AUTO | typeof Phaser.CANVAS {
  return matchMedia('(max-width: 720px)').matches ? Phaser.CANVAS : Phaser.AUTO;
}
