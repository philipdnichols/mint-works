export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';
export type Phase = 'development' | 'upkeep' | 'scoring';

export type PlayerCount = 1 | 2 | 3 | 4;
export type PlayerType = 'human' | 'ai';
export type AiId = 'justin' | 'rachael' | 'sonic' | 'mort';
export type PlayerId = 'p1' | 'p2' | 'p3' | 'p4' | 'ai';

export type PlanTag = 'Culture' | 'Utility' | 'Production' | 'Deed';

export type PlanId =
  | 'assembler'
  | 'gardens'
  | 'statue'
  | 'bridge'
  | 'landfill'
  | 'stripmine'
  | 'coop'
  | 'truck'
  | 'corporate-hq'
  | 'mine'
  | 'vault'
  | 'crane'
  | 'museum'
  | 'factory'
  | 'obelisk'
  | 'windmill'
  | 'gallery'
  | 'wholesaler'
  | 'plant'
  | 'workshop'
  | 'lotto';

export type LocationId =
  | 'producer'
  | 'supplier'
  | 'builder'
  | 'leadership-council'
  | 'wholesaler-location'
  | 'lotto-location'
  | 'crowdfunder'
  | 'recycler'
  | 'temp-agency'
  | 'swap-meet';

export type CoreLocationId = 'producer' | 'supplier' | 'builder' | 'leadership-council';
export type DeedLocationId = 'wholesaler-location' | 'lotto-location';
export type AdvancedLocationId = 'crowdfunder' | 'recycler' | 'temp-agency' | 'swap-meet';
export type LocationType = 'core' | 'deed' | 'advanced';

export type LocationCost =
  | { readonly kind: 'fixed'; readonly amount: number }
  | { readonly kind: 'planCost' }
  | { readonly kind: 'tempAgency' };

export interface LocationSpaceState {
  readonly cost: LocationCost;
  readonly occupiedBy?: PlayerId;
  readonly mints: number;
}

export interface LocationState {
  readonly id: LocationId;
  readonly name: string;
  readonly type: LocationType;
  readonly isOpen: boolean;
  readonly ownerId?: PlayerId;
  readonly spaces: ReadonlyArray<LocationSpaceState>;
}

export interface BuildingState {
  readonly planId: PlanId;
  readonly storedMints: number;
}

export interface PlayerState {
  readonly id: PlayerId;
  readonly name: string;
  readonly type: PlayerType;
  readonly aiId?: AiId;
  readonly age?: number;
  readonly mints: number;
  readonly plans: ReadonlyArray<PlanId>;
  readonly buildings: ReadonlyArray<BuildingState>;
}

export interface GameSettings {
  readonly playerCount: PlayerCount;
  readonly boardPlayerCount: PlayerCount;
  readonly soloMode: boolean;
  readonly aiOpponent?: AiId;
  readonly advancedLocations: ReadonlyArray<AdvancedLocationId>;
  readonly seed: number;
}

export interface PlanDefinition {
  readonly id: PlanId;
  readonly name: string;
  readonly cost: number;
  readonly tag: PlanTag;
  readonly stars: number | 'var';
}

export type UpkeepEffect =
  | {
      readonly type: 'GAIN_MINTS';
      readonly playerId: PlayerId;
      readonly amount: number;
      readonly sourcePlanId: PlanId;
    }
  | {
      readonly type: 'GAIN_MINTS_PER_BUILDING';
      readonly playerId: PlayerId;
      readonly sourcePlanId: PlanId;
    }
  | { readonly type: 'COOP'; readonly playerId: PlayerId; readonly sourcePlanId: PlanId }
  | { readonly type: 'GALLERY'; readonly playerId: PlayerId; readonly planId: PlanId };

export type PendingChoice =
  | {
      readonly type: 'COOP_TARGET';
      readonly playerId: PlayerId;
    }
  | {
      readonly type: 'SUPPLIER_PLAN';
      readonly playerId: PlayerId;
    }
  | {
      readonly type: 'BUILDER_PLAN';
      readonly playerId: PlayerId;
    }
  | {
      readonly type: 'SWAP_MEET';
      readonly playerId: PlayerId;
    }
  | {
      readonly type: 'RECYCLER';
      readonly playerId: PlayerId;
    }
  | {
      readonly type: 'TEMP_AGENCY_TARGET';
      readonly playerId: PlayerId;
    };

export type GameLogKind = 'system' | 'action' | 'ai' | 'upkeep' | 'info';

export interface GameLogEntry {
  readonly id: number;
  readonly round: number;
  readonly phase: Phase;
  readonly kind: GameLogKind;
  readonly text: string;
}

export interface GameResults {
  readonly scores: ReadonlyArray<{ readonly playerId: PlayerId; readonly stars: number }>;
  readonly winnerIds: ReadonlyArray<PlayerId>;
  readonly tiebreaker: 'stars' | 'neighborhood' | 'mints' | 'age' | 'tie';
}

export interface GameState {
  readonly status: GameStatus;
  readonly phase: Phase;
  readonly elapsedSeconds: number;
  readonly settings: GameSettings | null;
  readonly players: ReadonlyArray<PlayerState>;
  readonly currentPlayerIndex: number;
  readonly startingPlayerId: PlayerId | null;
  readonly planDeck: ReadonlyArray<PlanId>;
  readonly planSupply: ReadonlyArray<PlanId>;
  readonly locations: ReadonlyArray<LocationState>;
  readonly passedPlayers: ReadonlyArray<PlayerId>;
  readonly round: number;
  readonly mintSupply: number | 'unlimited';
  readonly lockedLocations: ReadonlyArray<LocationId>;
  readonly sonicBonusTurnUsed: boolean;
  readonly upkeepQueue: ReadonlyArray<UpkeepEffect>;
  readonly pendingChoice: PendingChoice | null;
  readonly results: GameResults | null;
  readonly log: ReadonlyArray<GameLogEntry>;
  readonly logSequence: number;
  readonly lastError?: string;
}
