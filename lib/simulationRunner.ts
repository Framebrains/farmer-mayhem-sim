import { SimConfig, SingleGameResult, PlayerResult, SimulationStats } from './types';
import { initGame, runTurn } from './gameEngine';
import { aggregateResults } from './dataAggregator';

/** Run a single game and extract the result */
function runSingleGame(config: SimConfig): SingleGameResult {
  let state = initGame(config);

  while (!state.isOver) {
    state = runTurn(state);
  }

  const n = config.playerCount;
  const startId = state.startingPlayerId;

  const playerResults: PlayerResult[] = state.players.map(p => ({
    id: p.id,
    strategy: p.strategy,
    finalHp: p.hp,
    cardsPlayed: p.cardsPlayed,
    damageDealt: p.damageDealt,
    damageReceived: p.damageReceived,
    survivedTurns: p.turnsPlayed,
    hadInsurance: p.hasUsedInsurance || p.hand.includes('insurance'),
    insuranceTriggered: p.hasUsedInsurance,
    cardsInHandAtEnd: p.hand.length,
    // 0 = went first (won dice roll), 1 = second clockwise, etc.
    turnOrder: (p.id - startId + n) % n,
  }));

  return {
    winnerId: state.winnerId,
    isDraw: state.isDraw,
    turnsPlayed: state.turnNumber,
    playerCount: config.playerCount,
    startingPlayerId: startId,
    playerResults,
    events: state.events,
    deckConfig: config.deckConfig,
  };
}

/** Run N simulations and return aggregated statistics */
export async function runSimulations(
  config: SimConfig,
  onProgress?: (completed: number, total: number) => void
): Promise<SimulationStats> {
  const results: SingleGameResult[] = [];

  for (let i = 0; i < config.numSimulations; i++) {
    const result = runSingleGame(config);
    results.push(result);

    // Yield to UI every 100 games
    if (i % 100 === 0) {
      onProgress?.(i, config.numSimulations);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  onProgress?.(config.numSimulations, config.numSimulations);
  return aggregateResults(results, config);
}
