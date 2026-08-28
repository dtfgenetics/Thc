import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createGame,
  legalPlay,
  playCard,
  legalAttack,
  attack,
  endTurn
} from "../src/engine.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataRoot = path.join(projectRoot, "data");
const manifest = JSON.parse(fs.readFileSync(path.join(dataRoot, "roster-manifest.json"), "utf8"));
const cards = manifest.files.flatMap((file) => JSON.parse(fs.readFileSync(path.join(dataRoot, file), "utf8")));
const families = ["kush", "haze", "skunk", "gas", "cookies", "fruit", "purple", "frost"];

const seedArg = process.argv.find((arg) => arg.startsWith("--seeds="));
const seedsPerMatchup = Math.max(1, Number.parseInt(seedArg?.split("=")[1] || "12", 10) || 12);
const assertBalanced = process.argv.includes("--assert-balanced");
const MIN_WIN_RATE = 0.4;
const MAX_WIN_RATE = 0.68;
const MAX_SPREAD = 0.25;

function sideKeys(actor) {
  return actor === "player" ? ["player", "cpu"] : ["cpu", "player"];
}

function chooseAction(state, actor) {
  const [selfKey, enemyKey] = sideKeys(actor);
  const side = state[selfKey];
  const enemy = state[enemyKey];

  const evolutions = [];
  side.hand.forEach((card, cardIndex) => {
    if (card.stage === 1) return;
    for (let lane = 0; lane < 3; lane += 1) {
      const check = legalPlay(state, actor, cardIndex, lane);
      if (check.ok) evolutions.push({ type: "play", cardIndex, lane, score: card.power + card.vigor + card.stage * 4 });
    }
  });
  if (evolutions.length) return evolutions.sort((a, b) => b.score - a.score)[0];

  const bases = [];
  side.hand.forEach((card, cardIndex) => {
    if (card.stage !== 1) return;
    for (let lane = 0; lane < 3; lane += 1) {
      const check = legalPlay(state, actor, cardIndex, lane);
      if (check.ok) bases.push({ type: "play", cardIndex, lane, score: card.power + card.vigor });
    }
  });
  if (bases.length) return bases.sort((a, b) => b.score - a.score)[0];

  const attacks = [];
  for (let lane = 0; lane < 3; lane += 1) {
    const check = legalAttack(state, actor, lane);
    const unit = side.lanes[lane];
    if (!check.ok || !unit) continue;
    const defender = enemy.lanes[lane];
    const openBonus = defender ? 0 : 8;
    const finishBonus = defender ? Math.max(0, 12 - defender.currentVigor) : Math.max(0, 8 - enemy.garden);
    attacks.push({ type: "attack", lane, score: unit.power + openBonus + finishBonus });
  }
  if (attacks.length) return attacks.sort((a, b) => b.score - a.score)[0];

  return { type: "end" };
}

function runGame(playerFamily, cpuFamily, seed) {
  const startingActor = seed % 2 === 0 ? "player" : "cpu";
  const state = createGame({ cards, playerFamily, cpuFamily, seed, startingActor });
  let actions = 0;
  while (!state.winner && actions < 600) {
    actions += 1;
    const actor = state.turn;
    const action = chooseAction(state, actor);
    if (action.type === "play") {
      const result = playCard(state, actor, action.cardIndex, action.lane);
      if (!result.ok) throw new Error(`${actor} illegal simulated play: ${result.reason}`);
    } else if (action.type === "attack") {
      const result = attack(state, actor, action.lane);
      if (!result.ok) throw new Error(`${actor} illegal simulated attack: ${result.reason}`);
    } else {
      const result = endTurn(state, actor);
      if (!result.ok) throw new Error(`${actor} illegal simulated end turn: ${result.reason}`);
    }
  }
  if (!state.winner) throw new Error(`Simulation failed to terminate for ${playerFamily} vs ${cpuFamily}, seed ${seed}`);
  return state;
}

const summary = Object.fromEntries(families.map((family) => [family, { wins: 0, losses: 0, draws: 0, games: 0, gardenFor: 0, gardenAgainst: 0 }]));
let totalGames = 0;
let totalRounds = 0;

for (let a = 0; a < families.length; a += 1) {
  for (let b = 0; b < families.length; b += 1) {
    if (a === b) continue;
    for (let sample = 0; sample < seedsPerMatchup; sample += 1) {
      const seed = 100_000 + a * 10_000 + b * 1_000 + sample;
      const playerFamily = families[a];
      const cpuFamily = families[b];
      const state = runGame(playerFamily, cpuFamily, seed);
      const stats = summary[playerFamily];
      stats.games += 1;
      stats.gardenFor += state.player.garden;
      stats.gardenAgainst += state.cpu.garden;
      if (state.winner === "player") stats.wins += 1;
      else if (state.winner === "cpu") stats.losses += 1;
      else stats.draws += 1;
      totalGames += 1;
      totalRounds += state.round;
    }
  }
}

const report = families.map((family) => {
  const stat = summary[family];
  return {
    family,
    games: stat.games,
    wins: stat.wins,
    losses: stat.losses,
    draws: stat.draws,
    winRate: Number((stat.wins / stat.games).toFixed(3)),
    avgGarden: Number((stat.gardenFor / stat.games).toFixed(2)),
    avgOpponentGarden: Number((stat.gardenAgainst / stat.games).toFixed(2))
  };
});

const payload = {
  ruleset: "0.2.0",
  seedsPerOrderedMatchup: seedsPerMatchup,
  totalGames,
  averageRounds: Number((totalRounds / totalGames).toFixed(2)),
  families: report
};

console.log(JSON.stringify(payload, null, 2));
if (assertBalanced) {
  const winRates = report.map((family) => family.winRate);
  const outsideRange = report.filter((family) => family.winRate < MIN_WIN_RATE || family.winRate > MAX_WIN_RATE);
  const spread = Math.max(...winRates) - Math.min(...winRates);
  if (outsideRange.length || spread > MAX_SPREAD) {
    const details = outsideRange.map((family) => `${family.family}=${family.winRate}`).join(', ') || `spread=${spread.toFixed(3)}`;
    throw new Error(`Balance gate failed (${details}); expected ${MIN_WIN_RATE}-${MAX_WIN_RATE} with spread <= ${MAX_SPREAD}.`);
  }
  console.log(`Balance gate passed: all family win rates are ${MIN_WIN_RATE}-${MAX_WIN_RATE}; spread ${spread.toFixed(3)}.`);
}
console.log(`Strain Showdown balance simulation completed: ${totalGames} deterministic games.`);
