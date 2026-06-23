export function GameRulesPanel() {
  return (
    <section className="message-card" aria-label="Game rules">
      <strong>Game Rules</strong>
      <p>Choose 2 to 10 players. Roll, move, and race to the final space.</p>
      <p>Land on a HIT space to randomly draw a card from the HIT card list. The card creates the action.</p>
      <p>Some cards move players, reverse turns, protect players, or make a player skip a future turn.</p>
      <p>The first player to reach the final space wins.</p>
    </section>
  );
}
