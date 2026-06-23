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
    if (!containerRef.current || gameRef.current) return;
    gameRef.current = createHighLandGame(containerRef.current);

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('game-state-update', { detail: state }));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [state]);

  return <div className="phaser-board" ref={containerRef} />;
}
