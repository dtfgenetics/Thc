# High Life core system

## Turn model

Each turn must resolve in this order: movement/choice → space effect → optional opportunity decision → risk/event resolution → resource update → end-of-turn checks. Digital and physical versions must share the same rule order.

## Branching path

Players choose among path branches at designated decision spaces. Branches may favor different resource profiles, but no branch may be a guaranteed best route. Re-entry points should keep the board readable and prevent runaway path length.

## Resources

Use a small set of legible resources: reputation, liquid funds/harvest value, assets, and era-specific progress. Avoid creating many currencies that do the same thing.

## Era transitions

Era transitions are shared milestones in the game state. The board, decks, opportunities, and risk profile can change when the table enters a new era. A transition must never erase a player's earlier decisions; it should transform their value.

## Legacy scoring

Final scoring combines reputation and durable assets with selected achievements. Cash alone must not determine the winner. Exact weights remain tunable until simulation and playtest evidence are stored.

## Implementation requirement

Create a pure rules module with seeded randomness before UI work. Every card/space effect must be representable as structured data and covered by deterministic tests.
