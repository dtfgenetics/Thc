export function GameRulesPanel() {
  return (
    <section className="message-card" aria-label="Game rules">
      <strong>Game Rules</strong>
      <p>Play locally with 1 to 10 players, or invite 2 to 10 players online.</p>
      <p>Roll once, follow the single colored path, then pass the turn unless a HIT card gives you another roll.</p>
      <p>Land on any HIT space to draw a card and apply its reaction immediately. The current board map has 25 HIT triggers.</p>
      <p>HIT reactions can move players forward or backward, skip turns, swap positions, protect against backward movement, reverse turn order, draw again, or let the same player roll again.</p>
      <p>The first player to reach Cloud 9 Citadel wins. Movement stops at START and FINISH.</p>
    </section>
  );
}
