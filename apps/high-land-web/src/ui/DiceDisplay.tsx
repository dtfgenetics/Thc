type DiceDisplayProps = {
  value: number | null;
};

const pipLayouts: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

export function DiceDisplay({ value }: DiceDisplayProps) {
  const pips = value ? pipLayouts[value] ?? [] : [];

  return (
    <div className="dice-display" aria-label={`Last roll ${value ?? 'none'}`}>
      <div className="dice-face">
        {Array.from({ length: 9 }, (_, index) => (
          <span className={pips.includes(index) ? 'pip visible' : 'pip'} key={index} />
        ))}
      </div>
      <div>
        <span>Last Roll</span>
        <strong>{value ?? '-'}</strong>
      </div>
    </div>
  );
}
