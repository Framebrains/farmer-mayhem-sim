// ─── KORT ────────────────────────────────────────────────────
export type CardType = 'attack' | 'specialty' | 'stationary' | 'trap';
export type CardTiming = 'any_time' | 'own_turn' | 'automatic' | 'trap';

export interface CardDefinition {
  id: string;
  name: string;
  type: CardType;
  timing: CardTiming;
  count: number;
  canBeNopedByGodMode: boolean;
}

// ─── SPELARE ─────────────────────────────────────────────────
/**
 * Player AI strategy. All "smart" variants share the same core decision-making
 * (Expert's brain) with different style biases. Only 'random' is a naive baseline.
 *   expert     = Smart (balanserad) — realistic default
 *   aggressive = Smart variant biased toward offence / risk
 *   defensive  = Smart variant biased toward survival / patience
 *   random     = Naive baseline (no heuristics, fully random)
 */
export type Strategy = 'expert' | 'aggressive' | 'defensive' | 'random';

export interface PlayerState {
  id: number;
  hp: number;
  hand: string[];
  stationaryCards: StationarySlot[];
  strategy: Strategy;
  isEliminated: boolean;
  hasUsedInsurance: boolean;
  turnsPlayed: number;
  cardsPlayed: number;
  damageDealt: number;
  damageReceived: number;
}

export interface StationarySlot {
  cardId: string;
  ownerId: number;
}

// ─── SPELSTATUS ──────────────────────────────────────────────
export interface PlayerSnapshot {
  hp: number;
  hand: string[];
  stationary: string[]; // cardIds on this player's farm
  isEliminated: boolean;
}

export interface GameState {
  players: PlayerState[];
  deck: string[];
  discardPile: string[];
  currentPlayerIndex: number;
  /** The player ID who went first (won the opening dice roll) — stays fixed for the whole game */
  startingPlayerId: number;
  turnNumber: number;
  phase: TurnPhase;
  pendingAttack: PendingAttack | null;
  isOver: boolean;
  winnerId: number | null;
  isDraw: boolean;
  events: GameEvent[];
  /**
   * Hand snapshots indexed by turn number.
   *   [0]  = state right after dealing (starting hands)
   *   [N]  = state at the START of turn N (before any cards are played)
   * Each entry is a PlayerSnapshot[] indexed by player ID.
   */
  handSnapshots: PlayerSnapshot[][];
}

export type TurnPhase =
  | 'play_cards'
  | 'attack_chain'
  | 'resolve_attack'
  | 'draw_card'
  | 'end_turn';

export interface PendingAttack {
  attackerId: number;
  targetId: number;
  attackCardId: string;
  chainHistory: ChainEvent[];
}

export interface ChainEvent {
  type: 'redirect' | 'nope' | 'wrong_goat' | 'counter_nope';
  playerId: number;
  cardId: string;
  newTargetId?: number;
  previousTargetId?: number; // target BEFORE this redirect (used to revert if God Mode nopes it)
}

// ─── SPELLOGGHÄNDELSER ───────────────────────────────────────
export type GameEventType =
  | 'turn_start'
  | 'attack_declared'
  | 'attack_hit'
  | 'attack_missed'
  | 'attack_noped'
  | 'attack_redirected'
  | 'dice_rolled'        // pre-Adrenaline dice result (so log shows initial roll before reroll)
  | 'card_played'
  | 'player_damaged'
  | 'player_eliminated'
  | 'insurance_triggered'
  | 'mad_cow_triggered'
  | 'haunted_barn_triggered'
  | 'sacrifice_wheel_spun'
  | 'draw'
  | 'game_over';

export interface GameEvent {
  turn: number;
  type: GameEventType;
  actorId: number;
  targetId?: number;
  cardId?: string;
  diceRoll?: number;
  detail?: string;
  /** Specific card IDs involved (e.g. drawn by Polacken, stolen by Steal, received via Begger) */
  cards?: string[];
}

// ─── SIMULERINGSRESULTAT ─────────────────────────────────────
export interface SingleGameResult {
  winnerId: number | null;
  isDraw: boolean;
  turnsPlayed: number;
  playerCount: number;
  /** Player ID that went first (won opening dice roll). Display as Spelare 1. */
  startingPlayerId: number;
  playerResults: PlayerResult[];
  events: GameEvent[];
  /** Per-turn hand snapshots — same shape as GameState.handSnapshots */
  handSnapshots: PlayerSnapshot[][];
  deckConfig: DeckConfig;
}

export interface PlayerResult {
  id: number;
  strategy: Strategy;
  finalHp: number;
  cardsPlayed: number;
  damageDealt: number;
  damageReceived: number;
  survivedTurns: number;
  hadInsurance: boolean;
  insuranceTriggered: boolean;
  cardsInHandAtEnd: number;
  turnOrder: number;
}

// ─── AGGREGERAD STATISTIK ────────────────────────────────────
export interface SimulationStats {
  totalGames: number;
  playerCount: number;
  deckConfig: DeckConfig;

  avgTurns: number;
  /** Sample standard deviation of turnsPlayed across all games */
  turnsStdDev: number;
  minTurns: number;
  maxTurns: number;
  avgMinutes: number;

  winsByPosition: number[];
  winRateByPosition: number[];
  winsByStrategy: Record<Strategy, number>;
  winRateByStrategy: Record<Strategy, number>;
  drawCount: number;
  drawRate: number;

  cardStats: Record<string, CardStat>;

  /** How many times each card delivered the decisive killing blow (last elimination) */
  killingBlowCounts: Record<string, number>;
  /** Why draws happened: game reached max turns vs. The Sacrifice nuke */
  drawCauses: { timeout: number; nuke: number };

  /** Pair-level synergy / anti-synergy. Key = "cardA|cardB" (sorted alphabetically). */
  cardSynergies: Record<string, CardPairStat>;

  redFlags: RedFlag[];

  sampleGame?: SingleGameResult;
}

export interface CardPairStat {
  cardA: string;
  cardB: string;
  /** Number of (player, game) pairs where the player used BOTH cards */
  instances: number;
  /** Of those, how many resulted in the player winning */
  wins: number;
  /** Bayesian-smoothed observed win rate when both cards are played */
  smoothedWinRate: number;
  /** Smoothed solo win rate of each card individually */
  soloA: number;
  soloB: number;
  /**
   * Synergy ratio. >1.0 means the pair wins MORE than the best individual card
   * (true synergy). <1.0 means the pair wins LESS (anti-synergy / redundancy).
   * 1.0 = pair performs exactly as well as its strongest component alone.
   */
  synergy: number;
}

export interface CardStat {
  cardId: string;
  timesDrawn: number;
  timesPlayed: number;
  playRate: number;
  winnerHadCard: number;
  winCorrelation: number;     // Bayesian-smoothed normalised win rate (0.5 = balanced)
  rawWinRate: number;         // Raw observed win rate (unsmoothed) for display
  instanceCount: number;      // How many (player, game) pairs used this card
  avgTimesPerGame: number;
}

export interface RedFlag {
  severity: 'critical' | 'warning' | 'info';
  category: 'card_balance' | 'player_balance' | 'game_length' | 'strategy_balance';
  message: string;
  detail: string;
  suggestion: string;
  value: number;
  threshold: number;
}

// ─── KONFIGURATION ───────────────────────────────────────────
export interface SimConfig {
  playerCount: number;
  numSimulations: number;
  strategies: Strategy[];
  deckConfig: DeckConfig;
}

export interface DeckConfig {
  overrides: Record<string, number>;
}
