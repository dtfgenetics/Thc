import type { CSSProperties } from 'react';
import { gameAssetPath } from '../game/systems/assetPath';
import type { ActionCard, Player } from '../game/types/gameTypes';

type CardRevealModalProps = {
  card: ActionCard | null;
  choicePlayers?: Player[];
  choiceRequired?: boolean;
  onChoosePlayer?: (playerId: string) => void;
  onDismiss?: () => void;
};

export function CardRevealModal({
  card,
  choicePlayers = [],
  choiceRequired = false,
  onChoosePlayer,
  onDismiss
}: CardRevealModalProps) {
  if (!card) return null;

  const artStyle = card.art
    ? ({
        '--card-image': `url("${gameAssetPath(`assets/images/cards/hit-card-sheet-0${card.art.sheet}.jpg`)}")`,
        '--card-x': `${(card.art.column * 100) / 3}%`,
        '--card-y': `${card.art.row * 100}%`
      } as CSSProperties)
    : undefined;

  return (
    <div className="card-reveal" role="dialog" aria-modal="true" aria-labelledby="hit-card-title">
      <section className="hit-card-panel">
        {card.art ? (
          <div
            className="hit-card-art"
            data-card-art={card.id}
            role="img"
            aria-label={`${card.title} HIT card artwork`}
            style={artStyle}
          />
        ) : (
          <div className="hit-card-art hit-card-art-fallback" aria-hidden="true">HIT</div>
        )}

        <div className="hit-card-copy">
          <span className="hit-label">HIT CARD</span>
          <h2 id="hit-card-title">{card.title}</h2>
          <p>{card.text}</p>
          <small>{describeEffect(card)}</small>

          {choiceRequired ? (
            <div className="card-choice" aria-label="Choose a player">
              <strong>Choose a player</strong>
              <div className="card-choice-buttons">
                {choicePlayers.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => onChoosePlayer?.(player.id)}
                    style={{ borderColor: player.color }}
                    type="button"
                  >
                    <span className="token-dot" style={{ background: player.color }} />
                    {player.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button className="primary card-continue" onClick={onDismiss} type="button">
              Continue
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function describeEffect(card: ActionCard): string {
  const effect = card.effect;

  switch (effect.type) {
    case 'move':
      return effect.amount >= 0 ? `Move +${effect.amount}` : `Move ${effect.amount}`;
    case 'skip_turns':
      return `Skip ${effect.amount} turn${effect.amount === 1 ? '' : 's'}`;
    case 'go_to_space':
      return `Go to space ${effect.index}`;
    case 'swap_position':
      return `Swap with ${effect.target.replace('_', ' ')}`;
    case 'roll_again':
      return 'Bonus roll';
    case 'move_to_color':
      return `${effect.direction === 'next' ? 'Next' : 'Previous'} ${effect.color} space`;
    case 'move_all':
      return `${effect.filter.replace('_', ' ')} ${effect.amount >= 0 ? '+' : ''}${effect.amount}`;
    case 'move_leader':
      return `Leader ${effect.amount >= 0 ? '+' : ''}${effect.amount}`;
    case 'reverse_turn_order':
      return effect.turns === 'round' ? 'Reverse for one round' : `Reverse ${effect.turns} turns`;
    case 'protect_from_backward':
      return `Backward protection x${effect.uses}`;
    case 'draw_again':
      return 'Draw again';
    case 'move_and_roll_again':
      return `Move +${effect.amount}, then roll again`;
    case 'move_and_draw_again':
      return `Move ${effect.amount >= 0 ? '+' : ''}${effect.amount}, then draw again`;
    case 'skip_others':
      return `Other players skip ${effect.amount}`;
    case 'choose_player_move':
      return `You +${effect.currentAmount}, chosen player +${effect.targetAmount}`;
  }
}
