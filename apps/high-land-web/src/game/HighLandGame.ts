import Phaser from 'phaser';
import { BoardScene } from './scenes/BoardScene';

export function createHighLandGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 800,
    height: 900,
    backgroundColor: '#141020',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BoardScene]
  });
}
