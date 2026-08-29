import type { Player } from '../game/types/gameTypes';

type WinnerModalProps = {
  winner: Player;
  canRestart: boolean;
  onRestart: () => void;
};

const WINNER_PHRASES = [
  'Reached the Sweet Escape first!',
  'Blazed a trail to the finish!',
  'Crossed the finish line!',
  'First to the Sweet Escape!',
  'Made it through the High Land!',
];

function getWinnerPhrase(winnerId: string): string {
  // Deterministic pick based on winner id so it's stable across re-renders
  const index = winnerId.charCodeAt(winnerId.length - 1) % WINNER_PHRASES.length;
  return WINNER_PHRASES[index] ?? WINNER_PHRASES[0]!;
}

export function WinnerModal({ winner, canRestart, onRestart }: WinnerModalProps) {
  const phrase = getWinnerPhrase(winner.id);

  return (
    <section
      className="winner-overlay"
      aria-label="Game over"
      aria-modal="true"
      role="dialog"
    >
      {/* Leaf rain — pure CSS, no JS */}
      <div className="winner-leaves" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span
            key={i}
            className="winner-leaf"
            style={{
              left: `${10 + i * 11}%`,
              animationDelay: `${i * 0.22}s`,
              animationDuration: `${2.8 + (i % 3) * 0.6}s`,
              fontSize: `${1.1 + (i % 3) * 0.4}rem`,
              opacity: 0.7 + (i % 2) * 0.2,
            }}
          >
            🌿
          </span>
        ))}
      </div>

      <div
        className="winner-card"
        role="document"
        style={{ borderColor: winner.color }}
      >
        <div
          className="winner-trophy"
          style={{ background: winner.color, boxShadow: `0 8px 32px ${winner.color}88` }}
        >
          🏆
        </div>

        <span className="hit-label" style={{ background: winner.color, color: '#111827' }}>
          HIGH LAND · WINNER
        </span>

        <h2
          className="winner-name"
          style={{
            color: winner.color,
            textShadow: `0 0 48px ${winner.color}88, 0 2px 0 rgba(0,0,0,0.4)`,
          }}
        >
          {winner.name}
        </h2>

        <p className="winner-phrase">{phrase}</p>

        <div className="winner-badges">
          <span className="winner-badge-pill">🌿 Sweet Escape</span>
          <span className="winner-badge-pill">🎲 High Land Champion</span>
        </div>

        <div className="winner-actions">
          {canRestart ? (
            <button
              className="primary winner-restart-btn"
              onClick={onRestart}
              type="button"
            >
              Play Again
            </button>
          ) : (
            <p className="form-note" style={{ margin: 0 }}>
              Waiting for the host to start a new game…
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
