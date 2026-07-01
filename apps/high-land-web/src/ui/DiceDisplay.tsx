type DiceDisplayProps = {
  value: number | null;
  isRolling?: boolean;
  moveLabel?: string | null;
};

const pipLayouts: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

export function DiceDisplay({ value, isRolling = false, moveLabel = null }: DiceDisplayProps) {
  const pips = value ? pipLayouts[value] ?? [] : [];

  return (
    <div className={isRolling ? 'dice-display rolling' : 'dice-display'} aria-label={`Last roll ${value ?? 'none'}`}>
      <div className="dice-face" aria-hidden="true">
        {Array.from({ length: 9 }, (_, index) => (
          <span className={pips.includes(index) ? 'pip visible' : 'pip'} key={index} />
        ))}
      </div>
      <div className="dice-readout">
        <span>{isRolling ? 'Rolling...' : 'Last Roll'}</span>
        <strong>{value ?? '-'}</strong>
        {moveLabel ? <p>{moveLabel}</p> : null}
      </div>
    </div>
  );
}
