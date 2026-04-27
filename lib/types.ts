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
export type Strategy = 'aggressive' | 'defensive' | 'balanced' | 'random';

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
export interface GameState {
  players: PlayerState[];
  deck: string[];
  discardPile: string[];
  currentPlayerIndex: number;
  turnNumber: number;
  phase: TurnPhase;
  pendingAttack: PendingAttack | null;
  isOver: boolean;
  winnerId: number | null;
  isDraw: boolean;
  events: GameEvent[];
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
}

// ─── SIMULERINGSRESULTAT ─────────────────────────────────────
export interface SingleGameResult {
  winnerId: number | null;
  isDraw: boolean;
  turnsPlayed: number;
  playerCount: number;
  playerResults: PlayerResult[];
  events: GameEvent[];
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

  redFlags: RedFlag[];

  sampleGame?: SingleGameResult;
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
