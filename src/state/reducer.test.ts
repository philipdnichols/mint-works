import { describe, it, expect } from 'vitest';
import { gameReducer, makeInitialState } from './reducer';
import { getAllPlanIds } from '../logic/setup';
import { createSeededRng, shuffleWithRng } from '../logic/random';

function buildSettings() {
  return {
    playerCount: 2 as const,
    boardPlayerCount: 2 as const,
    soloMode: false,
    advancedLocations: ['crowdfunder', 'recycler'] as const,
    seed: 1,
  };
}

describe('gameReducer', () => {
  it('starts in idle status', () => {
    expect(makeInitialState().status).toBe('idle');
  });

  it('START_GAME moves to playing', () => {
    const rng = createSeededRng(1);
    const deck = shuffleWithRng(getAllPlanIds(), rng);
    const next = gameReducer(makeInitialState(), {
      type: 'START_GAME',
      payload: { settings: buildSettings(), deckOrder: deck },
    });
    expect(next.status).toBe('playing');
    expect(next.planSupply).toHaveLength(3);
  });

  it('NEW_GAME resets to idle', () => {
    const rng = createSeededRng(2);
    const deck = shuffleWithRng(getAllPlanIds(), rng);
    const state = gameReducer(makeInitialState(), {
      type: 'START_GAME',
      payload: { settings: buildSettings(), deckOrder: deck },
    });
    const next = gameReducer(state, { type: 'NEW_GAME' });
    expect(next.status).toBe('idle');
  });

  it('TICK increments when playing and ignores non-playing states', () => {
    const idle = makeInitialState();
    const ignored = gameReducer(idle, { type: 'TICK' });
    expect(ignored).toBe(idle);

    const rng = createSeededRng(3);
    const deck = shuffleWithRng(getAllPlanIds(), rng);
    const playing = gameReducer(makeInitialState(), {
      type: 'START_GAME',
      payload: { settings: buildSettings(), deckOrder: deck },
    });
    const ticked = gameReducer(playing, { type: 'TICK' });
    expect(ticked.elapsedSeconds).toBe(playing.elapsedSeconds + 1);
  });

  it('PASS_TURN tracks passed players', () => {
    const rng = createSeededRng(1);
    const deck = shuffleWithRng(getAllPlanIds(), rng);
    const state = gameReducer(makeInitialState(), {
      type: 'START_GAME',
      payload: { settings: buildSettings(), deckOrder: deck },
    });
    const next = gameReducer(state, { type: 'PASS_TURN' });
    expect(next.passedPlayers).toHaveLength(1);
  });

  it('PLACE_ON_LOCATION routes to game logic', () => {
    const rng = createSeededRng(4);
    const deck = shuffleWithRng(getAllPlanIds(), rng);
    const state = gameReducer(makeInitialState(), {
      type: 'START_GAME',
      payload: { settings: buildSettings(), deckOrder: deck },
    });
    const next = gameReducer(state, {
      type: 'PLACE_ON_LOCATION',
      payload: { locationId: 'producer', spaceIndex: 0, effect: { kind: 'none' } },
    });
    expect(next.players[0].mints).toBeGreaterThan(state.players[0].mints);
    const producer = next.locations.find((loc) => loc.id === 'producer')!;
    expect(producer.spaces[0].occupiedBy).toBe('p1');
  });

  it('RUN_AI_TURN is a no-op for human games', () => {
    const rng = createSeededRng(5);
    const deck = shuffleWithRng(getAllPlanIds(), rng);
    const state = gameReducer(makeInitialState(), {
      type: 'START_GAME',
      payload: { settings: buildSettings(), deckOrder: deck },
    });
    const next = gameReducer(state, { type: 'RUN_AI_TURN' });
    expect(next).toBe(state);
  });

  it('RESOLVE_COOP_TARGET forwards to logic', () => {
    const rng = createSeededRng(6);
    const deck = shuffleWithRng(getAllPlanIds(), rng);
    let state = gameReducer(makeInitialState(), {
      type: 'START_GAME',
      payload: { settings: buildSettings(), deckOrder: deck },
    });
    state = {
      ...state,
      pendingChoice: { type: 'COOP_TARGET', playerId: 'p1' },
      upkeepQueue: [],
    };
    const next = gameReducer(state, {
      type: 'RESOLVE_COOP_TARGET',
      payload: { playerId: 'p1', targetPlayerId: 'p2' },
    });
    expect(next.pendingChoice).toBeNull();
  });

  it('__TEST_START_GAME behaves like START_GAME', () => {
    const rng = createSeededRng(7);
    const deck = shuffleWithRng(getAllPlanIds(), rng);
    const next = gameReducer(makeInitialState(), {
      type: '__TEST_START_GAME',
      payload: { settings: buildSettings(), deckOrder: deck },
    });
    expect(next.status).toBe('playing');
  });

  it('__TEST_LOAD_STATE replaces state entirely', () => {
    const preset = { ...makeInitialState(), status: 'won' as const };
    const next = gameReducer(makeInitialState(), { type: '__TEST_LOAD_STATE', state: preset });
    expect(next.status).toBe('won');
  });

  it('returns state for unknown actions', () => {
    const state = makeInitialState();
    const next = gameReducer(state, { type: 'UNKNOWN' } as never);
    expect(next).toBe(state);
  });
});
