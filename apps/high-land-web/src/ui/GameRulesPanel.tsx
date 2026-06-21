export function GameRulesPanel() {
  return (
    <section className="message-card" aria-label="Game rules">
      <strong>Game Rules</strong>
      <p>Choose 2 to 10 players. Roll once, follow the single colored path, then pass the turn.</p>
      <p>Land on HIT to draw a card and apply its movement immediately.</p>
      <p>The first player to reach Cloud 9 Citadel wins. Movement stops at START and FINISH.</p>
    </section>
  );
}
