import type { AiId, GameSettings, LocationId, PlanId, PlayerId } from '../types/game';

export type NonTempPlaceEffect =
  | { readonly kind: 'none' }
  | { readonly kind: 'supplier'; readonly planId: PlanId }
  | { readonly kind: 'builder'; readonly planId: PlanId }
  | {
      readonly kind: 'swap-meet';
      readonly givePlanId: PlanId;
      readonly takePlanId: PlanId;
    }
  | {
      readonly kind: 'recycler';
      readonly targetPlanId: PlanId;
      readonly from: 'plan' | 'building';
    };

export type PlaceEffect =
  | NonTempPlaceEffect
  | {
      readonly kind: 'temp-agency';
      readonly targetLocationId: LocationId;
      readonly targetSpaceIndex: number;
      readonly effect: NonTempPlaceEffect;
    };

export interface PlacePayload {
  readonly locationId: LocationId;
  readonly spaceIndex: number;
  readonly effect: PlaceEffect;
}

export type GameAction =
  | { type: 'NEW_GAME' }
  | { type: 'TICK' }
  | {
      type: 'START_GAME';
      payload: {
        readonly settings: GameSettings;
        readonly deckOrder: ReadonlyArray<PlanId>;
      };
    }
  | { type: 'PASS_TURN' }
  | { type: 'PLACE_ON_LOCATION'; payload: PlacePayload }
  | { type: 'RUN_AI_TURN' }
  | {
      type: 'RESOLVE_COOP_TARGET';
      payload: {
        readonly playerId: PlayerId;
        readonly targetPlayerId: PlayerId;
      };
    }
  | {
      type: '__TEST_LOAD_STATE';
      state: import('../types/game').GameState;
    }
  | {
      type: '__TEST_START_GAME';
      payload: {
        readonly settings: GameSettings;
        readonly deckOrder: ReadonlyArray<PlanId>;
      };
    }
  | {
      type: '__TEST_SET_AI';
      payload: { readonly aiId: AiId };
    };
