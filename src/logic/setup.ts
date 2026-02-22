import type { AiId, GameSettings, GameState, PlayerId, PlayerState, PlanId } from '../types/game';
import { buildLocations } from './locations';
import { appendLogs } from './log';

export const RACHAEL_MINT_SUPPLY = 30;

const ALL_PLAN_IDS: ReadonlyArray<PlanId> = [
  'assembler',
  'gardens',
  'statue',
  'bridge',
  'landfill',
  'stripmine',
  'coop',
  'truck',
  'corporate-hq',
  'mine',
  'vault',
  'crane',
  'museum',
  'factory',
  'obelisk',
  'windmill',
  'gallery',
  'wholesaler',
  'plant',
  'workshop',
  'lotto',
];

const AI_STARTING_MINTS: Record<AiId, number> = {
  justin: 3,
  rachael: 5,
  sonic: 5,
  mort: 999,
};

export function getAllPlanIds(): ReadonlyArray<PlanId> {
  return ALL_PLAN_IDS;
}

export function createIdleState(): GameState {
  return {
    status: 'idle',
    phase: 'development',
    elapsedSeconds: 0,
    settings: null,
    players: [],
    currentPlayerIndex: 0,
    startingPlayerId: null,
    planDeck: [],
    planSupply: [],
    locations: [],
    passedPlayers: [],
    round: 0,
    mintSupply: 'unlimited',
    lockedLocations: [],
    sonicBonusTurnUsed: false,
    upkeepQueue: [],
    pendingChoice: null,
    results: null,
    log: [],
    lastError: undefined,
  };
}

export function startGame(settings: GameSettings, deckOrder: ReadonlyArray<PlanId>): GameState {
  const planSupplySize = settings.soloMode ? 2 : 3;
  const deck = [...deckOrder];
  const planSupply = deck.splice(0, planSupplySize);

  const players = createPlayers(settings);
  const locations = buildLocations(
    settings.boardPlayerCount,
    settings.advancedLocations,
    settings.soloMode,
  );

  const startingPlayerId = getStartingPlayerId(settings, players);

  let mintSupply: number | 'unlimited' =
    settings.soloMode && settings.aiOpponent === 'rachael' ? RACHAEL_MINT_SUPPLY : 'unlimited';

  if (mintSupply !== 'unlimited') {
    mintSupply = Math.max(0, mintSupply - players.reduce((sum, p) => sum + p.mints, 0));
  }

  const baseState: GameState = {
    status: 'playing',
    phase: 'development',
    elapsedSeconds: 0,
    settings,
    players,
    currentPlayerIndex: players.findIndex((p) => p.id === startingPlayerId),
    startingPlayerId,
    planDeck: deck,
    planSupply,
    locations,
    passedPlayers: [],
    round: 1,
    mintSupply,
    lockedLocations: [],
    sonicBonusTurnUsed: false,
    upkeepQueue: [],
    pendingChoice: null,
    results: null,
    log: [],
    lastError: undefined,
  };

  const playerNames = players.map((player) => player.name).join(', ');
  const advancedNames =
    locations
      .filter((location) => location.type === 'advanced')
      .map((location) => location.name)
      .join(', ') || 'None';
  const startName = players.find((p) => p.id === startingPlayerId)?.name ?? startingPlayerId;

  const logEntries: Array<{ kind: 'system'; text: string; round: number }> = [
    {
      kind: 'system',
      text: `Game started with ${playerNames}. Advanced locations: ${advancedNames}.`,
      round: 1,
    },
    {
      kind: 'system',
      text: `Starting player: ${startName}.`,
      round: 1,
    },
  ];

  if (settings.soloMode && settings.aiOpponent) {
    const aiName = players.find((player) => player.type === 'ai')?.name ?? 'AI';
    logEntries.push({
      kind: 'system',
      text: `Solo opponent: ${aiName}.`,
      round: 1,
    });
  }

  return appendLogs(baseState, logEntries);
}

function createPlayers(settings: GameSettings): ReadonlyArray<PlayerState> {
  if (settings.soloMode) {
    const aiId = settings.aiOpponent ?? 'justin';
    return [
      {
        id: 'p1',
        name: 'Player',
        type: 'human',
        mints: 3,
        plans: [],
        buildings: [],
      },
      {
        id: 'ai',
        name: aiName(aiId),
        type: 'ai',
        aiId,
        mints: AI_STARTING_MINTS[aiId],
        plans: [],
        buildings: [],
      },
    ];
  }

  const ids: PlayerId[] = ['p1', 'p2', 'p3', 'p4'];
  return ids.slice(0, settings.playerCount).map((id, index) => ({
    id,
    name: `Player ${index + 1}`,
    type: 'human',
    mints: 3,
    plans: [],
    buildings: [],
  }));
}

function getStartingPlayerId(
  settings: GameSettings,
  players: ReadonlyArray<PlayerState>,
): PlayerId {
  if (settings.soloMode && settings.aiOpponent === 'justin') {
    return 'ai';
  }
  return players[0].id;
}

function aiName(aiId: AiId): string {
  switch (aiId) {
    case 'justin':
      return 'Justin';
    case 'rachael':
      return 'Rachael';
    case 'sonic':
      return 'Sonic';
    case 'mort':
      return 'Mort';
    default:
      return 'AI';
  }
}
