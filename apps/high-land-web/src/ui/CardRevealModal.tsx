import { useState } from 'react';
import type { ActionCard } from '../game/types/gameTypes';

type CardRevealModalProps = {
  card: ActionCard | null;
  onDismiss?: () => void;
};

export function CardRevealModal({ card, onDismiss }: CardRevealModalProps) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!card) return null;

  return (
    <section className="card-reveal" aria-label="HIT card drawn" aria-modal="true" role="dialog">
      <div className="hit-card" role="document">
        <span className="hit-label">HIT CARD</span>
        {card.imageSrc && !imageFailed ? (
          <img
            className="hit-card-art"
            src={card.imageSrc}
            alt={card.imageAlt ?? `${card.title} HIT card artwork`}
            onError={() => setImageFailed(true)}
          />
        ) : null}
        <h2>{card.title}</h2>
        <p>{card.text}</p>
        <small>{describeEffect(card)}</small>
        {onDismiss ? (
          <button className="hit-card-close" onClick={onDismiss} type="button">
            Continue
          </button>
        ) : null}
      </div>
    </section>
  );
}

function describeEffect(card: ActionCard): string {
  const effect = card.effect;

  switch (effect.type) {
    case 'move':
      return effect.amount >= 0 ? `Move +${effect.amount}` : `Move ${effect.amount}`;
    case 'skip_turns':
      return `Skip ${effect.amount}`;
    case 'go_to_space':
      return `Go to space ${effect.index + 1}`;
    case 'swap_position':
      return `Swap with ${effect.target.replace('_', ' ')}`;
    case 'roll_again':
      return 'Roll again';
    case 'move_to_color':
      return `${effect.direction} ${effect.color}`;
    case 'move_all':
      return `${effect.filter.replace('_', ' ')} ${effect.amount >= 0 ? '+' : ''}${effect.amount}`;
    case 'move_leader':
      return `Leader ${effect.amount >= 0 ? '+' : ''}${effect.amount}`;
    case 'reverse_turn_order':
      return `Reverse ${effect.turns} turns`;
    case 'protect_from_backward':
      return `Protection x${effect.uses}`;
    case 'draw_again':
      return 'Draw again';
    case 'move_and_roll_again':
      return `Move +${effect.amount}, roll again`;
  }
}
