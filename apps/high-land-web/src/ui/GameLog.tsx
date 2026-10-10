import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../game/types/gameTypes';
import { describeDiceMove } from './turnFeedback';

type LogEntry = {
  id: number;
  text: string;
  playerColor: string;
  playerName: string;
  timestamp: number;
};

type GameLogProps = {
  state: GameState;
  maxEntries?: number;
};

let entryId = 0;

export function GameLog({ state, maxEntries = 5 }: GameLogProps) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const prevMoveRef = useRef<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!state.lastRoll || !state.lastMove) return;

    const activePlayer =
      state.players.find((p) => p.id === state.lastMove?.playerId) ??
      state.players[state.currentPlayerIndex];
    if (!activePlayer) return;

    const text = describeDiceMove(activePlayer.name, state);
    if (text === prevMoveRef.current) return;
    prevMoveRef.current = text;

    setLog((prev) => {
      const next: LogEntry[] = [
        {
          id: ++entryId,
          text,
          playerColor: activePlayer.color,
          playerName: activePlayer.name,
          timestamp: Date.now(),
        },
        ...prev,
      ].slice(0, maxEntries);
      return next;
    });
  }, [state.lastRoll, state.lastMove, state.players, state.currentPlayerIndex, maxEntries]);

  // Add card events to log
  useEffect(() => {
    if (!state.lastCard) return;
    const cardMsg = state.message;
    if (!cardMsg || cardMsg === prevMoveRef.current) return;
    prevMoveRef.current = cardMsg;

    const activePlayer = state.players[state.currentPlayerIndex];
    if (!activePlayer) return;

    setLog((prev) => {
      const next: LogEntry[] = [
        {
          id: ++entryId,
          text: `🃏 ${cardMsg}`,
          playerColor: activePlayer.color,
          playerName: activePlayer.name,
          timestamp: Date.now(),
        },
        ...prev,
      ].slice(0, maxEntries);
      return next;
    });
  }, [state.lastCard, state.message, state.players, state.currentPlayerIndex, maxEntries]);

  if (log.length === 0) return null;

  return (
    <div className="game-log" aria-label="Recent game events" aria-live="polite" aria-atomic="false">
      <span className="game-log-label">Game Log</span>
      <ol ref={listRef} className="game-log-list" reversed>
        {log.map((entry, i) => (
          <li
            key={entry.id}
            className="game-log-entry"
            style={{
              borderLeftColor: entry.playerColor,
              opacity: 1 - i * 0.18,
            }}
          >
            <span
              className="game-log-dot"
              style={{ background: entry.playerColor }}
              aria-hidden="true"
            />
            <p>{entry.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
