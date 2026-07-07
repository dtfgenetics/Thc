import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { ActionCard } from '../game/types/gameTypes';

type CardRevealModalProps = {
  card: ActionCard | null;
  effectApplied?: boolean;
  onDismiss?: () => void;
};

const genericFallbackHitCard = 'assets/images/cards/hit/fallback-hit-card.svg';

type CardArtMode = 'primary' | 'sheet' | 'fallback' | 'missing';

function startingArtMode(card: ActionCard | null): CardArtMode {
  if (card?.imageSrc) return 'primary';
  if (card?.sheetArt) return 'sheet';
  return 'fallback';
}

export function CardRevealModal({ card, effectApplied = false, onDismiss }: CardRevealModalProps) {
  const [imageMode, setImageMode] = useState<CardArtMode>(() => startingArtMode(card));

  useEffect(() => {
    setImageMode(startingArtMode(card));
  }, [card?.id, card?.sheetArt]);

  const sheetStyle = useMemo<CSSProperties | undefined>(() => {
    if (!card?.sheetArt) return undefined;
    return {
      backgroundImage: `url("${card.sheetArt.src}")`,
      backgroundSize: '400% 200%',
      backgroundPosition: `${(card.sheetArt.column * 100) / 3}% ${card.sheetArt.row * 100}%`,
      backgroundRepeat: 'no-repeat',
      aspectRatio: '720 / 1000',
      height: 'min(46vh, 500px)'
    };
  }, [card?.sheetArt]);

  if (!card) return null;

  const imageSrc = imageMode === 'primary'
    ? card.imageSrc
    : imageMode === 'fallback'
      ? card.fallbackImageSrc ?? genericFallbackHitCard
      : null;
  const showingSheet = imageMode === 'sheet' && Boolean(card.sheetArt);
  const showingEmergencyArt = imageMode === 'fallback' || imageMode === 'missing';

  function handleImageError(): void {
    if (imageMode === 'primary' && card?.sheetArt) {
      setImageMode('sheet');
      return;
    }
    if (imageMode === 'primary' || imageMode === 'sheet') {
      setImageMode('fallback');
      return;
    }
    setImageMode('missing');
  }

  return (
    <section className="card-reveal" aria-label="HIT card drawn" aria-modal="true" role="dialog">
      <div className="hit-card" role="document">
        <span className="hit-label">HIT CARD</span>
        {imageSrc ? (
          <img
            className="hit-card-art"
            src={imageSrc}
            alt={card.imageAlt ?? `${card.title} HIT card artwork`}
            data-art-source={imageMode === 'primary' ? 'approved-master' : 'fallback'}
            data-card-art={card.id}
            onError={handleImageError}
          />
        ) : showingSheet ? (
          <>
            <img
              className="hit-card-sheet-preload"
              src={card.sheetArt?.src}
              alt=""
              aria-hidden="true"
              onError={handleImageError}
            />
            <div
              className="hit-card-art"
              data-art-source="approved-sheet"
              data-card-art={card.id}
              role="img"
              aria-label={card.imageAlt ?? `${card.title} HIT card artwork`}
              style={sheetStyle}
            />
          </>
        ) : null}
        {showingEmergencyArt ? (
          <div className="hit-card-missing-art" role="note">
            <strong>{imageMode === 'missing' ? 'Card image missing' : 'Showing fallback art'}</strong>
            <span>{card.imageSrc ?? 'No approved image path set'}</span>
          </div>
        ) : null}
        <h2>{card.title}</h2>
        <p>{card.text}</p>
        <span className={`hit-effect-status ${effectApplied ? 'applied' : 'preview'}`}>
          {effectApplied ? 'Effect applied to the game' : 'Preview only'}
        </span>
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
    case 'move': return effect.amount >= 0 ? `Move +${effect.amount}` : `Move ${effect.amount}`;
    case 'skip_turns': return `Skip ${effect.amount}`;
    case 'go_to_space': return `Go to space ${effect.index + 1}`;
    case 'swap_position': return `Swap with ${effect.target.replace('_', ' ')}`;
    case 'roll_again': return 'Roll again';
    case 'move_to_color': return `${effect.direction} ${effect.color}`;
    case 'move_all': return `${effect.filter.replace('_', ' ')} ${effect.amount >= 0 ? '+' : ''}${effect.amount}`;
    case 'move_leader': return `Leader ${effect.amount >= 0 ? '+' : ''}${effect.amount}`;
    case 'reverse_turn_order': return `Reverse ${effect.turns} turn${effect.turns === 1 ? '' : 's'}`;
    case 'protect_from_backward': return `Protection x${effect.uses}`;
    case 'draw_again': return 'Draw again';
    case 'move_and_roll_again': return `Move +${effect.amount}, roll again`;
    case 'move_and_draw_again': return `Move ${effect.amount >= 0 ? '+' : ''}${effect.amount}, draw again`;
    case 'skip_others': return `Other players skip ${effect.amount}`;
    case 'choose_player_move': return `You +${effect.currentAmount}, chosen player +${effect.targetAmount}`;
  }
}
