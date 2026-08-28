export const MAX_GARDEN = 24;
export const STARTING_GARDEN = 20;
export const LANES = 3;

export const FAMILY_PASSIVES = {
  kush: { name: "Deep Roots", text: "Cards enter with +1 maximum Vigor." },
  haze: { name: "Tailwind", text: "Your first attack each turn gets +1 Power." },
  skunk: { name: "Funk Jam", text: "Your first play each turn reduces enemy Focus by 1 next turn." },
  gas: { name: "Overpressure", text: "Your first attack each turn gets +2 Power and takes 1 recoil." },
  cookies: { name: "Hybrid Recipe", text: "Your first Base play each turn costs 1 less Focus." },
  fruit: { name: "Fresh Harvest", text: "Evolving heals your Garden by 2." },
  purple: { name: "Night Recovery", text: "End turn: heal your most-damaged active card by 2." },
  frost: { name: "Trichome Armor", text: "Elite evolutions enter with 1 Shield." }
};

const clone = (value) => JSON.parse(JSON.stringify(value));

export function seededRandom(seed = Date.now()) {
  let s = Math.abs(Number(seed) || 1) % 2147483647;
  if (s === 0) s = 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function shuffle(items, rng = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function splitOpeningDeck(cards, family, rng) {
  const familyCards = cards.filter((card) => card.family === family);
  if (familyCards.length !== 12) throw new Error(`Expected 12 cards for ${family}`);
  const byStage = [1, 2, 3].map((stage) => shuffle(familyCards.filter((card) => card.stage === stage), rng));
  const hand = [...byStage[0].slice(0, 3), byStage[1][0], byStage[2][0]];
  const remaining = [...byStage[0].slice(3), ...byStage[1].slice(1), ...byStage[2].slice(1)];
  return { hand: shuffle(hand, rng), deck: shuffle(remaining, rng) };
}

function createSide(cards, family, rng) {
  const { hand, deck } = splitOpeningDeck(cards, family, rng);
  return { family, garden: STARTING_GARDEN, focus: 3, maxFocus: 3, nextFocusPenalty: 0, turnsStarted: 0, hand, deck, lanes: Array(LANES).fill(null), flags: {}, stats: { cardsPlayed: 0, evolutions: 0, attacks: 0, damage: 0, cardsLost: 0 } };
}

export function createGame({ cards, playerFamily, cpuFamily, seed = Date.now(), startingActor = "player" }) {
  const rng = seededRandom(seed);
  if (!['player', 'cpu'].includes(startingActor)) throw new Error(`Unknown starting actor: ${startingActor}`);
  if (playerFamily === cpuFamily) {
    const options = [...new Set(cards.map((card) => card.family))].filter((family) => family !== playerFamily);
    cpuFamily = options[Math.floor(rng() * options.length)];
  }
  const state = { version: "0.2.1", seed, round: 1, turn: startingActor, winner: null, reason: null, player: createSide(cards, playerFamily, rng), cpu: createSide(cards, cpuFamily, rng), log: [] };
  pushLog(state, `Showdown begins: ${playerFamily.toUpperCase()} vs ${cpuFamily.toUpperCase()}.`);
  drawCard(state, "player");
  drawCard(state, "cpu");
  state[startingActor].turnsStarted = 1;
  return state;
}

function pushLog(state, text) { state.log.unshift({ round: state.round, turn: state.turn, text }); state.log = state.log.slice(0, 30); }
function sideKeys(actor) { return actor === "player" ? ["player", "cpu"] : ["cpu", "player"]; }
function playCost(card, side) { const base = card.stage; if (side.family === "cookies" && card.stage === 1 && !side.flags.cookiesDiscount) return Math.max(0, base - 1); return base; }

export function legalPlay(state, actor, cardIndex, laneIndex) {
  if (state.winner) return { ok: false, reason: "Game is over." };
  if (state.turn !== actor) return { ok: false, reason: "Not this side's turn." };
  const [selfKey] = sideKeys(actor); const side = state[selfKey]; const card = side.hand[cardIndex];
  if (!card) return { ok: false, reason: "Card not found." };
  if (laneIndex < 0 || laneIndex >= LANES) return { ok: false, reason: "Lane not found." };
  const current = side.lanes[laneIndex];
  if (card.stage === 1 && current) return { ok: false, reason: "Base cards need an empty lane." };
  if (card.stage > 1) {
    if (!current) return { ok: false, reason: `Stage ${card.stage} needs a Stage ${card.stage - 1} card in that lane.` };
    if (current.stage !== card.stage - 1) return { ok: false, reason: `This card must evolve a Stage ${card.stage - 1}.` };
    if (current.family !== card.family) return { ok: false, reason: "Evolution must stay in the same family." };
  }
  const cost = playCost(card, side); if (side.focus < cost) return { ok: false, reason: `Need ${cost} Focus.` }; return { ok: true, cost };
}

function makeUnit(card, side) { const kushBonus = side.family === "kush" ? 1 : 0; const maxVigor = card.vigor * 2 + kushBonus; return { ...clone(card), maxVigor, currentVigor: maxVigor, shield: 0, exhausted: false }; }

export function playCard(state, actor, cardIndex, laneIndex) {
  const check = legalPlay(state, actor, cardIndex, laneIndex); if (!check.ok) return check;
  const [selfKey, enemyKey] = sideKeys(actor); const side = state[selfKey]; const enemy = state[enemyKey]; const card = side.hand.splice(cardIndex, 1)[0]; const evolving = card.stage > 1;
  side.focus -= check.cost; if (side.family === "cookies" && card.stage === 1 && !side.flags.cookiesDiscount) side.flags.cookiesDiscount = true;
  const unit = makeUnit(card, side); if (card.stage === 3 && side.family === "frost") unit.shield += 1; side.lanes[laneIndex] = unit; side.stats.cardsPlayed += 1; if (evolving) side.stats.evolutions += 1;
  if (side.family === "skunk" && !side.flags.skunkJam) { enemy.nextFocusPenalty = Math.min(2, enemy.nextFocusPenalty + 1); side.flags.skunkJam = true; pushLog(state, `${card.name} jams 1 Focus from the opponent's next turn.`); }
  if (evolving && side.family === "fruit") side.garden = Math.min(MAX_GARDEN, side.garden + 2);
  pushLog(state, `${actor === "player" ? "You play" : "CPU plays"} ${card.name} into lane ${laneIndex + 1}${evolving ? " as an evolution" : ""}.`);
  return { ok: true, card: unit, evolving, cost: check.cost };
}

export function legalAttack(state, actor, laneIndex) {
  if (state.winner) return { ok: false, reason: "Game is over." }; if (state.turn !== actor) return { ok: false, reason: "Not this side's turn." };
  const [selfKey] = sideKeys(actor); const side = state[selfKey]; const unit = side.lanes[laneIndex];
  if (!unit) return { ok: false, reason: "No card in that lane." }; if (unit.exhausted) return { ok: false, reason: "That card already attacked this turn." };
  const cost = 1; if (side.focus < cost) return { ok: false, reason: `Need ${cost} Focus.` }; return { ok: true, cost };
}

function damageUnit(unit, amount) { let remaining = amount; if (unit.shield > 0) { const blocked = Math.min(unit.shield, remaining); unit.shield -= blocked; remaining -= blocked; } if (remaining > 0) unit.currentVigor -= remaining; return unit.currentVigor <= 0; }

export function attack(state, actor, laneIndex) {
  const check = legalAttack(state, actor, laneIndex); if (!check.ok) return check;
  const [selfKey, enemyKey] = sideKeys(actor); const side = state[selfKey]; const enemy = state[enemyKey]; const attacker = side.lanes[laneIndex];
  const firstHazeAttack = side.family === "haze" && !side.flags.hazeAttack;
  side.focus -= check.cost; attacker.exhausted = true; side.stats.attacks += 1; if (firstHazeAttack) side.flags.hazeAttack = true;
  let damage = attacker.power + (firstHazeAttack ? 1 : 0); if (side.family === "gas" && !side.flags.gasBurst) { damage += 2; side.flags.gasBurst = true; attacker.currentVigor -= 1; }
  const defender = enemy.lanes[laneIndex];
  if (defender) { const destroyed = damageUnit(defender, damage); side.stats.damage += damage; pushLog(state, `${attacker.name} hits ${defender.name} for ${damage}.`); if (destroyed) { pushLog(state, `${defender.name} is knocked out.`); enemy.lanes[laneIndex] = null; enemy.stats.cardsLost += 1; } }
  else { const direct = 2 + (attacker.stage === 3 ? 1 : 0) + (attacker.power >= 9 ? 1 : 0); enemy.garden = Math.max(0, enemy.garden - direct); side.stats.damage += direct; pushLog(state, `${attacker.name} breaks through lane ${laneIndex + 1} for ${direct} Garden damage.`); }
  if (attacker.currentVigor <= 0) { side.lanes[laneIndex] = null; side.stats.cardsLost += 1; pushLog(state, `${attacker.name} burns out from overpressure.`); }
  resolveWinner(state); return { ok: true, damage };
}

export function drawCard(state, actor) { const [selfKey] = sideKeys(actor); const side = state[selfKey]; if (!side.deck.length) return null; const card = side.deck.shift(); side.hand.push(card); return card; }
function recoverPurple(side) { if (side.family !== "purple") return null; const damaged = side.lanes.map((unit, index) => ({ unit, index })).filter(({ unit }) => unit && unit.currentVigor < unit.maxVigor).sort((a, b) => (a.unit.currentVigor / a.unit.maxVigor) - (b.unit.currentVigor / b.unit.maxVigor))[0]; if (!damaged) return null; damaged.unit.currentVigor = Math.min(damaged.unit.maxVigor, damaged.unit.currentVigor + 2); return damaged.unit.name; }
function startTurn(state, actor) { const side = state[actor]; side.maxFocus = Math.min(6, 3 + Math.floor((state.round - 1) / 2)); side.focus = Math.max(0, side.maxFocus - side.nextFocusPenalty); side.nextFocusPenalty = 0; side.flags = {}; side.lanes.forEach((unit) => { if (unit) unit.exhausted = false; }); if (side.turnsStarted > 0) drawCard(state, actor); side.turnsStarted += 1; }

export function endTurn(state, actor) {
  if (state.winner) return { ok: false, reason: "Game is over." }; if (state.turn !== actor) return { ok: false, reason: "Not this side's turn." };
  const side = state[actor]; const healed = recoverPurple(side); if (healed) pushLog(state, `${healed} recovers 2 Vigor under Purple's Night Recovery.`);
  if (actor === "player") { state.turn = "cpu"; startTurn(state, "cpu"); } else { state.round += 1; state.turn = "player"; startTurn(state, "player"); }
  resolveWinner(state); if (!state.winner && state.round > 18) resolveTiebreak(state); return { ok: true };
}

function boardScore(side) { return side.garden + side.lanes.reduce((sum, unit) => sum + (unit ? unit.currentVigor + unit.power : 0), 0); }
function resolveTiebreak(state) { const playerScore = boardScore(state.player); const cpuScore = boardScore(state.cpu); state.winner = playerScore === cpuScore ? "draw" : playerScore > cpuScore ? "player" : "cpu"; state.reason = "18-round showdown limit"; pushLog(state, `Showdown ends on board score: ${playerScore}–${cpuScore}.`); }
function resolveWinner(state) { if (state.player.garden <= 0 && state.cpu.garden <= 0) { state.winner = "draw"; state.reason = "both gardens depleted"; } else if (state.cpu.garden <= 0) { state.winner = "player"; state.reason = "opponent garden depleted"; } else if (state.player.garden <= 0) { state.winner = "cpu"; state.reason = "your garden depleted"; } return state.winner; }

export function chooseCpuAction(state) {
  if (state.turn !== "cpu" || state.winner) return { type: "end" }; const side = state.cpu;
  const evolutionOptions = []; side.hand.forEach((card, cardIndex) => { if (card.stage === 1) return; for (let lane = 0; lane < LANES; lane += 1) { const check = legalPlay(state, "cpu", cardIndex, lane); if (check.ok) evolutionOptions.push({ cardIndex, lane, card, score: card.power + card.vigor + card.stage * 4 }); } });
  if (evolutionOptions.length) { evolutionOptions.sort((a, b) => b.score - a.score); return { type: "play", cardIndex: evolutionOptions[0].cardIndex, lane: evolutionOptions[0].lane }; }
  const baseOptions = []; side.hand.forEach((card, cardIndex) => { if (card.stage !== 1) return; for (let lane = 0; lane < LANES; lane += 1) { const check = legalPlay(state, "cpu", cardIndex, lane); if (check.ok) baseOptions.push({ cardIndex, lane, card, score: card.power + card.vigor }); } });
  if (baseOptions.length) { baseOptions.sort((a, b) => b.score - a.score); return { type: "play", cardIndex: baseOptions[0].cardIndex, lane: baseOptions[0].lane }; }
  const attackOptions = []; for (let lane = 0; lane < LANES; lane += 1) { const check = legalAttack(state, "cpu", lane); const unit = side.lanes[lane]; if (check.ok && unit) { const openBonus = state.player.lanes[lane] ? 0 : 8; const targetBonus = state.player.lanes[lane] ? Math.max(0, 12 - state.player.lanes[lane].currentVigor) : 0; attackOptions.push({ lane, score: unit.power + openBonus + targetBonus }); } }
  if (attackOptions.length) { attackOptions.sort((a, b) => b.score - a.score); return { type: "attack", lane: attackOptions[0].lane }; }
  return { type: "end" };
}
export function getSnapshot(state) { return clone(state); }
