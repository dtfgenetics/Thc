import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { createHighLandGame } from '../game/HighLandGame';
import { gameAssetPath } from '../game/systems/assetPath';
import type { GameState } from '../game/types/gameTypes';

type PhaserBoardProps = {
  state: GameState;
};

export function PhaserBoard({ state }: PhaserBoardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    let cancelled = false;
    const boardImageUrl = gameAssetPath('assets/images/board/high-land-board.png');
    const boardImage = new Image();
    const startGame = (imageUrl?: string) => {
      if (cancelled || !containerRef.current || gameRef.current) return;
      gameRef.current = createHighLandGame(containerRef.current, imageUrl, stateRef.current);
    };

    boardImage.onload = () => startGame(boardImageUrl);
    boardImage.onerror = () => startGame();
    boardImage.src = boardImageUrl;

    return () => {
      cancelled = true;
      boardImage.onload = null;
      boardImage.onerror = null;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('game-state-update', { detail: state }));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [state]);

  return <div className="phaser-board" ref={containerRef} />;
}
