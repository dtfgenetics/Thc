import Phaser from 'phaser';
import { BoardScene } from './scenes/BoardScene';

export const boardArtWidth = 1536;
export const boardArtHeight = 1152;

export function createHighLandGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: boardArtWidth,
    height: boardArtHeight,
    backgroundColor: '#141020',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BoardScene]
  });
}
