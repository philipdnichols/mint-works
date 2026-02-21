import type { GameAction } from './actions';
import type { GameState } from '../types/game';
import { applyPassTurn, applyPlaceAction, resolveCoopChoice, runAiTurn } from '../logic/game';
import { createIdleState, startGame } from '../logic/setup';

export function makeInitialState(): GameState {
  return createIdleState();
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'NEW_GAME':
      return createIdleState();

    case 'START_GAME':
      return startGame(action.payload.settings, action.payload.deckOrder);

    case 'TICK':
      if (state.status !== 'playing') return state;
      return { ...state, elapsedSeconds: state.elapsedSeconds + 1 };

    case 'PASS_TURN':
      return applyPassTurn(state);

    case 'PLACE_ON_LOCATION':
      return applyPlaceAction(state, action.payload);

    case 'RUN_AI_TURN':
      return runAiTurn(state);

    case 'RESOLVE_COOP_TARGET':
      return resolveCoopChoice(state, action.payload.playerId, action.payload.targetPlayerId);

    case '__TEST_START_GAME':
      return startGame(action.payload.settings, action.payload.deckOrder);

    case '__TEST_LOAD_STATE':
      return action.state;

    default:
      return state;
  }
}
