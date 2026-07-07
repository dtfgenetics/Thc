import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { createHighLandGame } from '../game/HighLandGame';
import type { GameState } from '../game/types/gameTypes';

type PhaserBoardProps = {
  state: GameState;
};

export function PhaserBoard({ state }: PhaserBoardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent || gameRef.current) return;

    // Defer boot by one frame so React StrictMode can run its development
    // setup/cleanup probe without creating two overlapping Phaser games.
    let game: Phaser.Game | null = null;
    const bootFrame = window.requestAnimationFrame(() => {
      if (!parent.isConnected || gameRef.current) return;
      game = createHighLandGame(parent, state);
      gameRef.current = game;
    });

    return () => {
      window.cancelAnimationFrame(bootFrame);
      if (gameRef.current === game) gameRef.current = null;
      game?.destroy(true);
    };
  }, []); // The scene receives later state through game-state-update.

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('game-state-update', { detail: state }));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [state]);

  return <div className="phaser-board" ref={containerRef} />;
}
