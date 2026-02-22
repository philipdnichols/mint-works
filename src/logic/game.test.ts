import { describe, expect, it } from 'vitest';
import type {
  GameState,
  LocationId,
  LocationState,
  PlanId,
  PlayerId,
  PlayerState,
} from '../types/game';
import { getAllPlanIds, startGame } from './setup';
import {
  applyPassTurn,
  applyPlaceAction,
  getBuilderCost,
  getLocationCost,
  getSupplierCostForPlayer,
  getTempAgencyCost,
  getTempAgencyTargets,
  resolveCoopChoice,
  runAiTurn,
} from './game';

function baseSettings() {
  return {
    playerCount: 2 as const,
    boardPlayerCount: 2 as const,
    soloMode: false,
    advancedLocations: ['recycler', 'swap-meet'] as const,
    seed: 1,
  };
}

function soloSettings(aiId: 'justin' | 'rachael' | 'sonic' | 'mort') {
  return {
    playerCount: 1 as const,
    boardPlayerCount: 1 as const,
    soloMode: true,
    aiOpponent: aiId,
    advancedLocations: ['crowdfunder'] as const,
    seed: 1,
  };
}

function buildDeck(order?: ReadonlyArray<PlanId>): ReadonlyArray<PlanId> {
  return order ?? getAllPlanIds();
}

function withPlayer(
  state: GameState,
  playerId: PlayerId,
  update: (player: PlayerState) => PlayerState,
): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? update(player) : player)),
  };
}

function setCurrentPlayer(state: GameState, playerId: PlayerId): GameState {
  const index = state.players.findIndex((player) => player.id === playerId);
  return {
    ...state,
    currentPlayerIndex: index < 0 ? 0 : index,
    passedPlayers: [],
  };
}

function updateLocation(
  state: GameState,
  locationId: LocationId,
  update: (location: LocationState) => LocationState,
): GameState {
  return {
    ...state,
    locations: state.locations.map((location) =>
      location.id === locationId ? update(location) : location,
    ),
  };
}

function fillLocation(
  state: GameState,
  locationId: LocationId,
  playerId: PlayerId = 'p1',
  mints: number = 1,
): GameState {
  return updateLocation(state, locationId, (location) => ({
    ...location,
    spaces: location.spaces.map((space) => ({
      ...space,
      occupiedBy: playerId,
      mints,
    })),
  }));
}

function occupySpace(
  location: LocationState,
  spaceIndex: number,
  playerId: PlayerId,
  mints: number,
): LocationState {
  return {
    ...location,
    spaces: location.spaces.map((space, index) =>
      index === spaceIndex ? { ...space, occupiedBy: playerId, mints } : space,
    ),
  };
}

function openSpaceIndex(location: LocationState): number {
  return location.spaces.findIndex((space) => !space.occupiedBy);
}

function passAllPlayers(state: GameState): GameState {
  let next = state;
  for (let i = 0; i < state.players.length; i += 1) {
    next = applyPassTurn(next);
  }
  return next;
}

describe('game logic', () => {
  it('builds a plan at the builder and opens deed locations', () => {
    const deck = buildDeck([
      'wholesaler',
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
      'assembler',
      'plant',
      'workshop',
      'lotto',
    ]);
    let state = startGame(baseSettings(), deck);
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      mints: 10,
      plans: ['wholesaler'],
    }));

    const builder = state.locations.find((loc) => loc.id === 'builder')!;
    const next = applyPlaceAction(state, {
      locationId: 'builder',
      spaceIndex: openSpaceIndex(builder),
      effect: { kind: 'builder', planId: 'wholesaler' },
    });

    const deed = next.locations.find((loc) => loc.id === 'wholesaler-location')!;
    expect(deed.isOpen).toBe(true);
    expect(deed.ownerId).toBe('p1');
  });

  it('assembler auto-builds supplier gains', () => {
    const deck = buildDeck([
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
      'assembler',
      'plant',
      'workshop',
      'lotto',
    ]);
    let state = startGame(baseSettings(), deck);
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      mints: 10,
      buildings: [{ planId: 'assembler', storedMints: 0 }],
    }));

    const supplier = state.locations.find((loc) => loc.id === 'supplier')!;
    const next = applyPlaceAction(state, {
      locationId: 'supplier',
      spaceIndex: openSpaceIndex(supplier),
      effect: { kind: 'supplier', planId: state.planSupply[0] },
    });

    const builtIds = next.players[0].buildings.map((b) => b.planId);
    expect(builtIds).toContain(state.planSupply[0]);
  });

  it('recycler converts a plan into mints', () => {
    const deck = buildDeck([
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
      'assembler',
      'plant',
      'workshop',
      'lotto',
    ]);
    let state = startGame(baseSettings(), deck);
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      mints: 2,
      plans: ['gardens'],
    }));

    const recycler = state.locations.find((loc) => loc.id === 'recycler')!;
    const next = applyPlaceAction(state, {
      locationId: 'recycler',
      spaceIndex: openSpaceIndex(recycler),
      effect: { kind: 'recycler', targetPlanId: 'gardens', from: 'plan' },
    });

    expect(next.players[0].mints).toBeGreaterThan(0);
    expect(next.players[0].plans).not.toContain('gardens');
  });

  it('passes into upkeep and resolves co-op choice', () => {
    const deck = buildDeck([
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
      'assembler',
      'plant',
      'workshop',
      'lotto',
    ]);
    let state = startGame(baseSettings(), deck);
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      buildings: [{ planId: 'coop', storedMints: 0 }],
    }));

    state = passAllPlayers(state);

    expect(state.pendingChoice?.type).toBe('COOP_TARGET');
    const next = resolveCoopChoice(state, 'p1', 'p2');
    expect(next.pendingChoice).toBeNull();
  });

  it('runs a basic AI turn', () => {
    const deck = buildDeck([
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
      'assembler',
      'plant',
      'workshop',
      'lotto',
    ]);
    let state = startGame(soloSettings('justin'), deck);
    state = setCurrentPlayer(state, 'ai');
    state = runAiTurn(state);
    const occupied = state.locations.some((loc) => loc.spaces.some((space) => space.occupiedBy));
    expect(occupied).toBe(true);
  });

  it('handles location effects and deed usage', () => {
    const deck = buildDeck([
      'wholesaler',
      'lotto',
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
      'assembler',
      'plant',
      'workshop',
    ]);
    let state = startGame(
      { ...baseSettings(), advancedLocations: ['crowdfunder', 'recycler'] },
      deck,
    );
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      mints: 12,
      plans: ['wholesaler', 'lotto'],
    }));

    state = setCurrentPlayer(state, 'p1');
    const producer = state.locations.find((loc) => loc.id === 'producer')!;
    state = applyPlaceAction(state, {
      locationId: 'producer',
      spaceIndex: openSpaceIndex(producer),
      effect: { kind: 'none' },
    });
    expect(state.players[0].mints).toBe(13);

    state = setCurrentPlayer(state, 'p1');
    const leadership = state.locations.find((loc) => loc.id === 'leadership-council')!;
    state = applyPlaceAction(state, {
      locationId: 'leadership-council',
      spaceIndex: openSpaceIndex(leadership),
      effect: { kind: 'none' },
    });
    expect(state.startingPlayerId).toBe('p1');

    state = setCurrentPlayer(state, 'p1');
    const crowdfunder = state.locations.find((loc) => loc.id === 'crowdfunder')!;
    state = applyPlaceAction(state, {
      locationId: 'crowdfunder',
      spaceIndex: openSpaceIndex(crowdfunder),
      effect: { kind: 'none' },
    });
    expect(state.players[0].mints).toBeGreaterThan(10);
    expect(state.players[1].mints).toBeGreaterThan(3);

    state = setCurrentPlayer(state, 'p1');
    const builder = state.locations.find((loc) => loc.id === 'builder')!;
    state = applyPlaceAction(state, {
      locationId: 'builder',
      spaceIndex: openSpaceIndex(builder),
      effect: { kind: 'builder', planId: 'wholesaler' },
    });

    const wholesalerLocation = state.locations.find((loc) => loc.id === 'wholesaler-location')!;
    expect(wholesalerLocation.isOpen).toBe(true);

    state = setCurrentPlayer(state, 'p1');
    const lottoBuilder = state.locations.find((loc) => loc.id === 'builder')!;
    state = applyPlaceAction(state, {
      locationId: 'builder',
      spaceIndex: openSpaceIndex(lottoBuilder),
      effect: { kind: 'builder', planId: 'lotto' },
    });

    state = setCurrentPlayer(state, 'p1');
    state = applyPlaceAction(state, {
      locationId: 'wholesaler-location',
      spaceIndex: openSpaceIndex(wholesalerLocation),
      effect: { kind: 'none' },
    });

    state = setCurrentPlayer(state, 'p1');
    const lottoLocation = state.locations.find((loc) => loc.id === 'lotto-location')!;
    state = applyPlaceAction(state, {
      locationId: 'lotto-location',
      spaceIndex: openSpaceIndex(lottoLocation),
      effect: { kind: 'none' },
    });
    expect(state.players[0].plans).toContain('statue');
  });

  it('supports swap meet and recycler with buildings', () => {
    const deck = buildDeck([
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
      'assembler',
      'plant',
      'workshop',
      'lotto',
    ]);
    let state = startGame(baseSettings(), deck);
    state = {
      ...state,
      mintSupply: 5,
    };
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      mints: 6,
      buildings: [{ planId: 'gallery', storedMints: 2 }],
    }));

    const swap = state.locations.find((loc) => loc.id === 'swap-meet')!;
    state = applyPlaceAction(state, {
      locationId: 'swap-meet',
      spaceIndex: openSpaceIndex(swap),
      effect: { kind: 'swap-meet', givePlanId: 'gallery', takePlanId: state.planSupply[0] },
    });
    expect(state.players[0].buildings.length).toBe(0);
    expect(state.players[0].plans).toContain('gardens');
    expect(state.mintSupply).toBe(7);

    state = setCurrentPlayer(state, 'p1');
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      buildings: [{ planId: 'mine', storedMints: 0 }],
    }));
    const recycler = state.locations.find((loc) => loc.id === 'recycler')!;
    state = applyPlaceAction(state, {
      locationId: 'recycler',
      spaceIndex: openSpaceIndex(recycler),
      effect: { kind: 'recycler', targetPlanId: 'mine', from: 'building' },
    });
    expect(state.players[0].buildings.length).toBe(0);
    expect(state.players[0].mints).toBeGreaterThan(0);
  });

  it('handles temp agency targeting occupied locations', () => {
    const deck = buildDeck([
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
      'assembler',
      'plant',
      'workshop',
      'lotto',
    ]);
    let state = startGame(
      { ...baseSettings(), advancedLocations: ['temp-agency', 'swap-meet'] },
      deck,
    );
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      mints: 5,
    }));

    state = updateLocation(state, 'producer', (location) => occupySpace(location, 0, 'p2', 1));

    const temp = state.locations.find((loc) => loc.id === 'temp-agency')!;
    state = applyPlaceAction(state, {
      locationId: 'temp-agency',
      spaceIndex: openSpaceIndex(temp),
      effect: {
        kind: 'temp-agency',
        targetLocationId: 'producer',
        targetSpaceIndex: 0,
        effect: { kind: 'none' },
      },
    });

    expect(state.players[0].mints).toBe(5);

    state = setCurrentPlayer(state, 'p1');
    const tempAgain = state.locations.find((loc) => loc.id === 'temp-agency')!;
    const invalid = applyPlaceAction(state, {
      locationId: 'temp-agency',
      spaceIndex: openSpaceIndex(tempAgain),
      effect: {
        kind: 'temp-agency',
        targetLocationId: 'builder',
        targetSpaceIndex: 0,
        effect: { kind: 'none' },
      },
    });
    expect(invalid.lastError).toBeTruthy();
  });

  it('filters temp agency targets to occupied unlocked locations', () => {
    const deck = buildDeck();
    let state = startGame({ ...baseSettings(), advancedLocations: ['temp-agency'] as const }, deck);
    state = updateLocation(state, 'producer', (location) => occupySpace(location, 0, 'p1', 1));
    state = updateLocation(state, 'builder', (location) => occupySpace(location, 0, 'p1', 1));
    state = updateLocation(state, 'temp-agency', (location) => occupySpace(location, 0, 'p2', 1));
    state = { ...state, lockedLocations: ['producer'] };

    const targets = getTempAgencyTargets(state).map((location) => location.id);
    expect(targets).toContain('builder');
    expect(targets).not.toContain('producer');
    expect(targets).not.toContain('temp-agency');
  });

  it('reports invalid placements', () => {
    const deck = buildDeck([
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
      'assembler',
      'plant',
      'workshop',
      'lotto',
    ]);
    let state = startGame(baseSettings(), deck);

    const deedAttempt = applyPlaceAction(state, {
      locationId: 'wholesaler-location',
      spaceIndex: 0,
      effect: { kind: 'none' },
    });
    expect(deedAttempt.lastError).toBeTruthy();

    const producer = state.locations.find((loc) => loc.id === 'producer')!;
    state = applyPlaceAction(state, {
      locationId: 'producer',
      spaceIndex: openSpaceIndex(producer),
      effect: { kind: 'none' },
    });

    state = setCurrentPlayer(state, 'p1');
    const occupiedAttempt = applyPlaceAction(state, {
      locationId: 'producer',
      spaceIndex: 0,
      effect: { kind: 'none' },
    });
    expect(occupiedAttempt.lastError).toBeTruthy();

    const costlessState = updateLocation(state, 'producer', (location) => ({
      ...location,
      spaces: location.spaces.map((space) => ({
        ...space,
        cost: { kind: 'planCost' },
      })),
    }));
    const invalidCost = applyPlaceAction(costlessState, {
      locationId: 'producer',
      spaceIndex: 0,
      effect: { kind: 'none' },
    });
    expect(invalidCost.lastError).toBeTruthy();

    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      mints: 0,
      plans: [state.planSupply[0]],
    }));
    const builder = state.locations.find((loc) => loc.id === 'builder')!;
    const insufficient = applyPlaceAction(state, {
      locationId: 'builder',
      spaceIndex: openSpaceIndex(builder),
      effect: { kind: 'builder', planId: state.planSupply[0] },
    });
    expect(insufficient.lastError).toBeTruthy();
  });

  it('refills supplier immediately in solo mode and honors truck discount', () => {
    const deck = buildDeck([
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
      'assembler',
      'plant',
      'workshop',
      'lotto',
    ]);
    let state = startGame(soloSettings('justin'), deck);
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      mints: 5,
      buildings: [{ planId: 'truck', storedMints: 0 }],
    }));
    state = setCurrentPlayer(state, 'p1');

    const supplier = state.locations.find((loc) => loc.id === 'supplier')!;
    const planId = state.planSupply[0];
    const next = applyPlaceAction(state, {
      locationId: 'supplier',
      spaceIndex: openSpaceIndex(supplier),
      effect: { kind: 'supplier', planId },
    });

    expect(next.planSupply).toHaveLength(2);
    expect(next.players[0].mints).toBe(
      5 - (getSupplierCostForPlayer(next.players[0], planId) ?? 0),
    );
  });

  it('rachael wins when the mint supply runs out', () => {
    const deck = buildDeck([
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
      'assembler',
      'plant',
      'workshop',
      'lotto',
    ]);
    let state = startGame(soloSettings('rachael'), deck);
    state = {
      ...state,
      mintSupply: 1,
    };

    const producer = state.locations.find((loc) => loc.id === 'producer')!;
    const next = applyPlaceAction(state, {
      locationId: 'producer',
      spaceIndex: openSpaceIndex(producer),
      effect: { kind: 'none' },
    });

    expect(next.status).toBe('lost');
    expect(next.results?.winnerIds).toContain('ai');
  });

  it('does not return supplier mints for rachael during upkeep', () => {
    const deck = buildDeck([
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
      'assembler',
      'plant',
      'workshop',
      'lotto',
    ]);
    let state = startGame(soloSettings('rachael'), deck);
    state = {
      ...state,
      mintSupply: 10,
    };
    state = updateLocation(state, 'supplier', (location) => occupySpace(location, 0, 'ai', 3));
    state = updateLocation(state, 'producer', (location) => occupySpace(location, 0, 'p1', 2));

    state = passAllPlayers(state);

    expect(state.mintSupply).toBe(10);
  });

  it('mort skips income during upkeep', () => {
    const deck = buildDeck([
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
      'assembler',
      'plant',
      'workshop',
      'lotto',
    ]);
    let state = startGame(soloSettings('mort'), deck);
    const aiMints = state.players.find((p) => p.id === 'ai')!.mints;
    state = passAllPlayers(state);
    const nextAiMints = state.players.find((p) => p.id === 'ai')!.mints;
    expect(nextAiMints).toBe(aiMints);
  });

  it('sonic gets a bonus turn and justin locks locations', () => {
    const deck = buildDeck([
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
      'assembler',
      'plant',
      'workshop',
      'lotto',
    ]);
    let sonicState = startGame(soloSettings('sonic'), deck);
    sonicState = setCurrentPlayer(sonicState, 'ai');
    sonicState = runAiTurn(sonicState);
    expect(sonicState.currentPlayerIndex).toBe(1);
    expect(sonicState.sonicBonusTurnUsed).toBe(true);

    let justinState = startGame(soloSettings('justin'), deck);
    justinState = setCurrentPlayer(justinState, 'ai');
    justinState = runAiTurn(justinState);
    expect(justinState.lockedLocations.length).toBeGreaterThan(0);
  });

  it('sonic clears the bonus flag after the extra turn', () => {
    const deck = buildDeck();
    let state = startGame(soloSettings('sonic'), deck);
    state = setCurrentPlayer(state, 'ai');
    state = { ...state, sonicBonusTurnUsed: true };
    const next = applyPassTurn(state);
    expect(next.sonicBonusTurnUsed).toBe(false);
  });

  it('calculates costs correctly for builder, supplier, and temp agency', () => {
    const deck = buildDeck([
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
      'assembler',
      'plant',
      'workshop',
      'lotto',
    ]);
    let state = startGame(baseSettings(), deck);
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      buildings: [
        { planId: 'truck', storedMints: 0 },
        { planId: 'crane', storedMints: 0 },
      ],
    }));

    const player = state.players[0];
    expect(getBuilderCost(player)).toBe(1);
    expect(getSupplierCostForPlayer(player, 'gardens')).toBe(2);
    expect(getLocationCost(state, player, 'producer')).toBe(1);
    expect(getLocationCost(state, player, 'builder')).toBe(1);
    expect(getLocationCost(state, player, 'supplier', 'gardens')).toBe(2);
    expect(getTempAgencyCost(state, player, 'producer')).toBe(2);
  });

  it('resolves end-game tiebreakers', () => {
    const deck = buildDeck([
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
      'assembler',
      'plant',
      'workshop',
      'lotto',
    ]);

    let state = startGame(baseSettings(), deck);
    state = {
      ...state,
      planDeck: [],
      planSupply: [],
    };
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      buildings: [{ planId: 'gardens', storedMints: 0 }],
      plans: [],
    }));
    state = withPlayer(state, 'p2', (player) => ({
      ...player,
      buildings: [{ planId: 'gardens', storedMints: 0 }],
      plans: ['statue'],
    }));
    state = passAllPlayers(state);
    expect(state.results?.tiebreaker).toBe('neighborhood');

    state = startGame(baseSettings(), deck);
    state = {
      ...state,
      planDeck: [],
      planSupply: [],
    };
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      buildings: [{ planId: 'gardens', storedMints: 0 }],
      mints: 5,
    }));
    state = withPlayer(state, 'p2', (player) => ({
      ...player,
      buildings: [{ planId: 'gardens', storedMints: 0 }],
      mints: 2,
    }));
    state = passAllPlayers(state);
    expect(state.results?.tiebreaker).toBe('mints');

    state = startGame(baseSettings(), deck);
    state = {
      ...state,
      planDeck: [],
      planSupply: [],
    };
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      buildings: [{ planId: 'gardens', storedMints: 0 }],
      mints: 2,
      age: 40,
    }));
    state = withPlayer(state, 'p2', (player) => ({
      ...player,
      buildings: [{ planId: 'gardens', storedMints: 0 }],
      mints: 2,
      age: 30,
    }));
    state = passAllPlayers(state);
    expect(state.results?.tiebreaker).toBe('age');

    state = startGame(baseSettings(), deck);
    state = {
      ...state,
      planDeck: [],
      planSupply: [],
    };
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      buildings: [{ planId: 'gardens', storedMints: 0 }],
      mints: 2,
      age: 40,
    }));
    state = withPlayer(state, 'p2', (player) => ({
      ...player,
      buildings: [{ planId: 'gardens', storedMints: 0 }],
      mints: 2,
      age: 40,
    }));
    state = passAllPlayers(state);
    expect(state.results?.tiebreaker).toBe('tie');
  });

  it('sets solo status based on winner', () => {
    const deck = buildDeck([
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
      'assembler',
      'plant',
      'workshop',
      'lotto',
    ]);
    let state = startGame(soloSettings('justin'), deck);
    state = {
      ...state,
      planDeck: [],
      planSupply: [],
    };
    state = withPlayer(state, 'ai', (player) => ({
      ...player,
      buildings: [{ planId: 'gardens', storedMints: 0 }],
    }));
    state = passAllPlayers(state);
    expect(state.status).toBe('lost');
  });

  it('marks solo games as won when the human wins', () => {
    const deck = buildDeck();
    let state = startGame(soloSettings('justin'), deck);
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      buildings: [
        { planId: 'gardens', storedMints: 0 },
        { planId: 'statue', storedMints: 0 },
        { planId: 'windmill', storedMints: 0 },
        { planId: 'mine', storedMints: 0 },
      ],
    }));
    state = passAllPlayers(state);
    expect(state.status).toBe('won');
  });

  it('rejects placement when not in development or location invalid', () => {
    const deck = buildDeck();
    const state = startGame(baseSettings(), deck);
    const producer = state.locations.find((loc) => loc.id === 'producer')!;
    const payload = {
      locationId: 'producer' as const,
      spaceIndex: openSpaceIndex(producer),
      effect: { kind: 'none' as const },
    };
    const wrongPhase = applyPlaceAction({ ...state, phase: 'upkeep' }, payload);
    expect(wrongPhase.lastError).toBeTruthy();

    const wrongStatus = applyPlaceAction({ ...state, status: 'idle' }, payload);
    expect(wrongStatus.lastError).toBeTruthy();

    const unknown = applyPlaceAction(state, {
      locationId: 'unknown' as LocationId,
      spaceIndex: 0,
      effect: { kind: 'none' },
    });
    expect(unknown.lastError).toBeTruthy();

    const locked = applyPlaceAction({ ...state, lockedLocations: ['producer'] }, payload);
    expect(locked.lastError).toBeTruthy();
  });

  it('rejects invalid placement options for supplier and temp agency', () => {
    const deck = buildDeck();
    const state = startGame(baseSettings(), deck);
    const supplier = state.locations.find((loc) => loc.id === 'supplier')!;
    const invalidSupplier = applyPlaceAction(state, {
      locationId: 'supplier',
      spaceIndex: openSpaceIndex(supplier),
      effect: { kind: 'none' },
    });
    expect(invalidSupplier.lastError).toBeTruthy();

    const tempSettings = {
      playerCount: 2 as const,
      boardPlayerCount: 2 as const,
      soloMode: false,
      advancedLocations: ['temp-agency'] as const,
      seed: 1,
    };
    let tempState = startGame(tempSettings, deck);
    tempState = withPlayer(tempState, 'p1', (player) => ({ ...player, mints: 5 }));
    const tempAgency = tempState.locations.find((loc) => loc.id === 'temp-agency')!;
    const invalidTemp = applyPlaceAction(tempState, {
      locationId: 'temp-agency',
      spaceIndex: openSpaceIndex(tempAgency),
      effect: { kind: 'none' },
    });
    expect(invalidTemp.lastError).toBeTruthy();
  });

  it('reports temp agency target issues', () => {
    const deck = buildDeck();
    const tempSettings = {
      playerCount: 2 as const,
      boardPlayerCount: 2 as const,
      soloMode: false,
      advancedLocations: ['temp-agency'] as const,
      seed: 1,
    };
    let state = startGame(tempSettings, deck);
    state = withPlayer(state, 'p1', (player) => ({ ...player, mints: 10 }));
    const tempAgency = state.locations.find((loc) => loc.id === 'temp-agency')!;
    const basePayload = {
      locationId: 'temp-agency' as const,
      spaceIndex: openSpaceIndex(tempAgency),
      effect: {
        kind: 'temp-agency' as const,
        targetLocationId: 'producer' as LocationId,
        targetSpaceIndex: 0,
        effect: { kind: 'none' as const },
      },
    };

    const lockedTarget = applyPlaceAction({ ...state, lockedLocations: ['producer'] }, basePayload);
    expect(lockedTarget.lastError).toBeTruthy();

    const invalidTarget = applyPlaceAction(state, {
      ...basePayload,
      effect: { ...basePayload.effect, targetLocationId: 'mystery' as LocationId },
    });
    expect(invalidTarget.lastError).toBeTruthy();

    const unoccupiedTarget = applyPlaceAction(state, basePayload);
    expect(unoccupiedTarget.lastError).toBeTruthy();

    const occupiedState = updateLocation(state, 'producer', (location) =>
      occupySpace(location, 0, 'p2', 1),
    );
    const wrongSpace = applyPlaceAction(occupiedState, {
      ...basePayload,
      effect: { ...basePayload.effect, targetSpaceIndex: 1 },
    });
    expect(wrongSpace.lastError).toBeTruthy();

    const occupiedBuilder = updateLocation(state, 'builder', (location) =>
      occupySpace(location, 0, 'p2', 1),
    );
    const invalidEffect = applyPlaceAction(occupiedBuilder, {
      ...basePayload,
      effect: {
        ...basePayload.effect,
        targetLocationId: 'builder',
        targetSpaceIndex: 0,
        effect: { kind: 'builder', planId: 'gardens' },
      },
    });
    expect(invalidEffect.lastError).toBeTruthy();
  });

  it('rejects passing outside development and handles repeat passes', () => {
    const deck = buildDeck();
    const state = startGame(baseSettings(), deck);
    const wrongPhase = applyPassTurn({ ...state, phase: 'upkeep' });
    expect(wrongPhase.lastError).toBeTruthy();

    const currentId = state.players[state.currentPlayerIndex].id;
    const alreadyPassed = applyPassTurn({ ...state, passedPlayers: [currentId] });
    expect(alreadyPassed.passedPlayers).toHaveLength(1);
  });

  it('rejects invalid co-op choices', () => {
    const deck = buildDeck();
    const state = startGame(baseSettings(), deck);
    const noPending = resolveCoopChoice(state, 'p1', 'p2');
    expect(noPending.lastError).toBeTruthy();

    const pending: GameState = {
      ...state,
      pendingChoice: { type: 'COOP_TARGET', playerId: 'p1' },
    };
    const wrongPlayer = resolveCoopChoice(pending, 'p2', 'p1');
    expect(wrongPlayer.lastError).toBeTruthy();

    const sameTarget = resolveCoopChoice(pending, 'p1', 'p1');
    expect(sameTarget.lastError).toBeTruthy();
  });

  it('handles zero-amount mint gains in upkeep queue', () => {
    const deck = buildDeck();
    let state = startGame(baseSettings(), deck);
    state = {
      ...state,
      pendingChoice: { type: 'COOP_TARGET', playerId: 'p1' },
      upkeepQueue: [{ type: 'GAIN_MINTS', playerId: 'p1', amount: 0, sourcePlanId: 'mine' }],
    };
    const next = resolveCoopChoice(state, 'p1', 'p2');
    const p1 = next.players.find((player) => player.id === 'p1')!;
    expect(p1.mints).toBe(5);
  });

  it('runAiTurn ignores non-playing or human turns and passes when no action', () => {
    const deck = buildDeck();
    const humanState = startGame(baseSettings(), deck);
    expect(runAiTurn(humanState)).toBe(humanState);

    const idleState = { ...humanState, status: 'idle' as const };
    expect(runAiTurn(idleState)).toBe(idleState);

    let solo = startGame(soloSettings('justin'), deck);
    solo = { ...solo, lockedLocations: solo.locations.map((loc) => loc.id) };
    const passed = runAiTurn(solo);
    expect(passed.passedPlayers).toContain('ai');
  });

  it('clears the sonic bonus flag after a non-sonic action', () => {
    const deck = buildDeck();
    let state = startGame(baseSettings(), deck);
    state = { ...state, sonicBonusTurnUsed: true };
    const next = applyPassTurn(state);
    expect(next.sonicBonusTurnUsed).toBe(false);
  });

  it('ai skips unknown locations in the board list', () => {
    const deck = buildDeck();
    let state = startGame(soloSettings('justin'), deck);
    state = {
      ...state,
      locations: [
        ...state.locations,
        {
          id: 'mystery' as LocationId,
          name: 'Mystery',
          type: 'core',
          isOpen: true,
          ownerId: undefined,
          spaces: [
            {
              cost: { kind: 'fixed', amount: 1 },
              occupiedBy: undefined,
              mints: 0,
            },
          ],
        },
      ],
    };
    state = fillLocation(state, 'producer');
    state = {
      ...state,
      lockedLocations: ['builder', 'supplier', 'leadership-council', 'crowdfunder'],
    };
    const next = runAiTurn(state);
    expect(next.passedPlayers).toContain('ai');
  });

  it('ai chooses builder when forced', () => {
    const deck = buildDeck();
    let state = startGame(soloSettings('justin'), deck);
    state = withPlayer(state, 'ai', (player) => ({
      ...player,
      mints: 5,
      plans: ['gardens'],
    }));
    state = fillLocation(state, 'producer');
    state = { ...state, lockedLocations: ['supplier', 'leadership-council'] };
    const next = runAiTurn(state);
    const ai = next.players.find((player) => player.id === 'ai')!;
    expect(ai.buildings.some((building) => building.planId === 'gardens')).toBe(true);
  });

  it('ai skips actions it cannot afford', () => {
    const deck = buildDeck();
    let state = startGame(soloSettings('justin'), deck);
    state = withPlayer(state, 'ai', (player) => ({
      ...player,
      mints: 0,
      plans: ['gardens'],
    }));
    state = fillLocation(state, 'producer');
    state = { ...state, lockedLocations: ['supplier', 'leadership-council'] };
    const next = runAiTurn(state);
    expect(next.passedPlayers).toContain('ai');
  });

  it('ai supplier selection uses plan priorities', () => {
    const deck = buildDeck();
    let state = startGame(soloSettings('justin'), deck);
    state = withPlayer(state, 'ai', (player) => ({
      ...player,
      mints: 5,
      plans: [],
    }));
    state = {
      ...state,
      planSupply: ['wholesaler', 'coop', 'bridge'],
    };
    state = fillLocation(state, 'producer');
    state = { ...state, lockedLocations: ['builder', 'leadership-council'] };
    const next = runAiTurn(state);
    const ai = next.players.find((player) => player.id === 'ai')!;
    expect(ai.plans).toContain('wholesaler');
  });

  it('ai falls back to default priorities when aiId is missing', () => {
    const deck = buildDeck();
    let state = startGame(soloSettings('justin'), deck);
    state = withPlayer(state, 'ai', (player) => ({
      ...player,
      aiId: undefined,
      mints: 5,
      plans: [],
    }));
    state = { ...state, planSupply: ['truck'] };
    state = fillLocation(state, 'producer');
    state = { ...state, lockedLocations: ['builder', 'leadership-council'] };
    const next = runAiTurn(state);
    const ai = next.players.find((player) => player.id === 'ai')!;
    expect(ai.plans).toContain('truck');
  });

  it('ai chooses utility plans when they are the only option', () => {
    const deck = buildDeck();
    let state = startGame(soloSettings('justin'), deck);
    state = withPlayer(state, 'ai', (player) => ({
      ...player,
      mints: 5,
      plans: [],
    }));
    state = { ...state, planSupply: ['truck'] };
    state = fillLocation(state, 'producer');
    state = { ...state, lockedLocations: ['builder', 'leadership-council'] };
    const next = runAiTurn(state);
    const ai = next.players.find((player) => player.id === 'ai')!;
    expect(ai.plans).toContain('truck');
  });

  it('ai prefers higher cost plans when configured', () => {
    const deck = buildDeck();
    let state = startGame(soloSettings('rachael'), deck);
    state = withPlayer(state, 'ai', (player) => ({
      ...player,
      mints: 6,
      plans: [],
    }));
    state = setCurrentPlayer(state, 'ai');
    state = { ...state, planSupply: ['wholesaler', 'gallery', 'plant'] };
    state = fillLocation(state, 'producer');
    state = { ...state, lockedLocations: ['builder', 'leadership-council'] };
    const next = runAiTurn(state);
    const ai = next.players.find((player) => player.id === 'ai')!;
    expect(ai.plans).toContain('plant');
  });

  it('ai mort skips production plans and can be blocked', () => {
    const deck = buildDeck();
    let state = startGame(soloSettings('mort'), deck);
    state = withPlayer(state, 'ai', (player) => ({
      ...player,
      mints: 3,
      plans: [],
    }));
    state = setCurrentPlayer(state, 'ai');
    state = { ...state, planSupply: ['mine', 'truck'] };
    state = fillLocation(state, 'producer');
    state = { ...state, lockedLocations: ['builder', 'leadership-council'] };
    const next = runAiTurn(state);
    const ai = next.players.find((player) => player.id === 'ai')!;
    expect(ai.plans).toContain('truck');

    let blocked = startGame(soloSettings('mort'), deck);
    blocked = withPlayer(blocked, 'ai', (player) => ({
      ...player,
      mints: 3,
      plans: [],
    }));
    blocked = setCurrentPlayer(blocked, 'ai');
    blocked = { ...blocked, planSupply: ['mine'] };
    blocked = fillLocation(blocked, 'producer');
    blocked = {
      ...blocked,
      lockedLocations: ['builder', 'leadership-council', 'crowdfunder'],
    };
    const passed = runAiTurn(blocked);
    expect(passed.passedPlayers).toContain('ai');
  });

  it('ai passes when supplier is empty or unaffordable', () => {
    const deck = buildDeck();
    let emptyState = startGame(soloSettings('justin'), deck);
    emptyState = withPlayer(emptyState, 'ai', (player) => ({
      ...player,
      mints: 0,
      plans: [],
    }));
    emptyState = { ...emptyState, planSupply: [] };
    emptyState = fillLocation(emptyState, 'producer');
    emptyState = {
      ...emptyState,
      lockedLocations: ['builder', 'leadership-council', 'crowdfunder'],
    };
    const emptyPass = runAiTurn(emptyState);
    expect(emptyPass.passedPlayers).toContain('ai');

    let expensiveState = startGame(soloSettings('justin'), deck);
    expensiveState = withPlayer(expensiveState, 'ai', (player) => ({
      ...player,
      mints: 0,
      plans: [],
    }));
    expensiveState = { ...expensiveState, planSupply: ['plant'] };
    expensiveState = fillLocation(expensiveState, 'producer');
    expensiveState = {
      ...expensiveState,
      lockedLocations: ['builder', 'leadership-council', 'crowdfunder'],
    };
    const expensivePass = runAiTurn(expensiveState);
    expect(expensivePass.passedPlayers).toContain('ai');
  });

  it('ai sonic skips supplier when already holding plans', () => {
    const deck = buildDeck();
    let state = startGame(soloSettings('sonic'), deck);
    state = withPlayer(state, 'ai', (player) => ({
      ...player,
      mints: 5,
      plans: ['gardens'],
    }));
    state = setCurrentPlayer(state, 'ai');
    state = fillLocation(state, 'producer');
    state = {
      ...state,
      lockedLocations: ['builder', 'leadership-council', 'crowdfunder'],
    };
    const next = runAiTurn(state);
    expect(next.passedPlayers).toContain('ai');
  });

  it('ai uses recycler for plans and buildings', () => {
    const deck = buildDeck();
    let state = startGame(
      { ...soloSettings('justin'), advancedLocations: ['recycler'] as const },
      deck,
    );
    state = withPlayer(state, 'ai', (player) => ({
      ...player,
      mints: 3,
      plans: ['gardens'],
    }));
    state = fillLocation(state, 'producer');
    state = { ...state, lockedLocations: ['builder', 'supplier', 'leadership-council'] };
    const next = runAiTurn(state);
    const ai = next.players.find((player) => player.id === 'ai')!;
    expect(ai.plans).not.toContain('gardens');

    let buildingState = startGame(
      { ...soloSettings('justin'), advancedLocations: ['recycler'] as const },
      deck,
    );
    buildingState = withPlayer(buildingState, 'ai', (player) => ({
      ...player,
      mints: 3,
      plans: [],
      buildings: [{ planId: 'gallery', storedMints: 2 }],
    }));
    buildingState = fillLocation(buildingState, 'producer');
    buildingState = {
      ...buildingState,
      lockedLocations: ['builder', 'supplier', 'leadership-council'],
    };
    const recycled = runAiTurn(buildingState);
    const aiAfter = recycled.players.find((player) => player.id === 'ai')!;
    expect(aiAfter.buildings.some((building) => building.planId === 'gallery')).toBe(false);
  });

  it('ai passes when recycler has no targets', () => {
    const deck = buildDeck();
    let state = startGame(
      { ...soloSettings('justin'), advancedLocations: ['recycler'] as const },
      deck,
    );
    state = withPlayer(state, 'ai', (player) => ({
      ...player,
      mints: 3,
      plans: [],
      buildings: [],
    }));
    state = fillLocation(state, 'producer');
    state = { ...state, lockedLocations: ['builder', 'supplier', 'leadership-council'] };
    const next = runAiTurn(state);
    expect(next.passedPlayers).toContain('ai');
  });

  it('ai uses swap meet for plans and buildings', () => {
    const deck = buildDeck();
    let state = startGame(
      { ...soloSettings('justin'), advancedLocations: ['swap-meet'] as const },
      deck,
    );
    state = withPlayer(state, 'ai', (player) => ({
      ...player,
      mints: 3,
      plans: ['gardens'],
    }));
    state = { ...state, planSupply: ['truck'] };
    state = fillLocation(state, 'producer');
    state = { ...state, lockedLocations: ['builder', 'supplier', 'leadership-council'] };
    const next = runAiTurn(state);
    const ai = next.players.find((player) => player.id === 'ai')!;
    expect(ai.plans).toContain('truck');

    let buildingState = startGame(
      { ...soloSettings('justin'), advancedLocations: ['swap-meet'] as const },
      deck,
    );
    buildingState = withPlayer(buildingState, 'ai', (player) => ({
      ...player,
      mints: 3,
      plans: [],
      buildings: [{ planId: 'gallery', storedMints: 2 }],
    }));
    buildingState = { ...buildingState, planSupply: ['truck'] };
    buildingState = fillLocation(buildingState, 'producer');
    buildingState = {
      ...buildingState,
      lockedLocations: ['builder', 'supplier', 'leadership-council'],
    };
    const swapped = runAiTurn(buildingState);
    const aiAfter = swapped.players.find((player) => player.id === 'ai')!;
    expect(aiAfter.buildings.some((building) => building.planId === 'gallery')).toBe(false);
  });

  it('ai passes when swap meet has nothing to give', () => {
    const deck = buildDeck();
    let state = startGame(
      { ...soloSettings('justin'), advancedLocations: ['swap-meet'] as const },
      deck,
    );
    state = withPlayer(state, 'ai', (player) => ({
      ...player,
      mints: 3,
      plans: [],
      buildings: [],
    }));
    state = { ...state, planSupply: ['truck'] };
    state = fillLocation(state, 'producer');
    state = { ...state, lockedLocations: ['builder', 'supplier', 'leadership-council'] };
    const next = runAiTurn(state);
    expect(next.passedPlayers).toContain('ai');
  });

  it('ai uses temp agency when it is the only option', () => {
    const deck = buildDeck();
    let state = startGame(
      { ...soloSettings('justin'), advancedLocations: ['temp-agency'] as const },
      deck,
    );
    state = withPlayer(state, 'ai', (player) => ({
      ...player,
      mints: 5,
    }));
    state = updateLocation(state, 'producer', (location) => occupySpace(location, 0, 'p1', 1));
    state = fillLocation(state, 'producer');
    state = { ...state, lockedLocations: ['builder', 'supplier', 'leadership-council'] };
    const next = runAiTurn(state);
    const tempAgency = next.locations.find((loc) => loc.id === 'temp-agency')!;
    expect(tempAgency.spaces.some((space) => space.occupiedBy === 'ai')).toBe(true);
  });

  it('ai temp agency logs recycler target details', () => {
    const deck = buildDeck();
    let state = startGame(
      { ...baseSettings(), advancedLocations: ['temp-agency', 'recycler'] as const },
      deck,
    );
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      type: 'ai',
      aiId: 'justin',
      mints: 5,
      plans: ['gardens'],
    }));
    state = setCurrentPlayer(state, 'p1');
    state = fillLocation(state, 'recycler', 'p2');
    const unlocked = new Set<LocationId>(['temp-agency', 'recycler']);
    state = {
      ...state,
      lockedLocations: state.locations
        .filter((location) => !unlocked.has(location.id))
        .map((location) => location.id),
    };
    const next = runAiTurn(state);
    const logText = next.log.map((entry) => entry.text).join(' ');
    expect(logText).toContain('Temp Agency');
    expect(logText).toContain('will recycle');
  });

  it('ai temp agency logs swap meet target details', () => {
    const deck = buildDeck();
    let state = startGame(
      { ...baseSettings(), advancedLocations: ['temp-agency', 'swap-meet'] as const },
      deck,
    );
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      type: 'ai',
      aiId: 'justin',
      mints: 10,
      plans: ['gardens'],
    }));
    state = setCurrentPlayer(state, 'p1');
    state = { ...state, planSupply: ['truck'] };
    state = fillLocation(state, 'swap-meet', 'p2');
    const unlocked = new Set<LocationId>(['temp-agency', 'swap-meet']);
    state = {
      ...state,
      lockedLocations: state.locations
        .filter((location) => !unlocked.has(location.id))
        .map((location) => location.id),
    };
    const next = runAiTurn(state);
    const logText = next.log.map((entry) => entry.text).join(' ');
    expect(logText).toContain('Temp Agency');
    expect(logText).toContain('will swap');
  });

  it('reports invalid plan choices for builder, supplier, recycler, and swap meet', () => {
    const deck = buildDeck();
    let state = startGame(baseSettings(), deck);
    state = withPlayer(state, 'p1', (player) => ({ ...player, mints: 10 }));

    const builder = state.locations.find((loc) => loc.id === 'builder')!;
    const buildFail = applyPlaceAction(state, {
      locationId: 'builder',
      spaceIndex: openSpaceIndex(builder),
      effect: { kind: 'builder', planId: 'gardens' },
    });
    expect(buildFail.lastError).toBeTruthy();
    const buildMismatch = applyPlaceAction(state, {
      locationId: 'builder',
      spaceIndex: openSpaceIndex(builder),
      effect: { kind: 'none' },
    });
    expect(buildMismatch.lastError).toBeTruthy();

    const supplier = state.locations.find((loc) => loc.id === 'supplier')!;
    const supplierFail = applyPlaceAction(state, {
      locationId: 'supplier',
      spaceIndex: openSpaceIndex(supplier),
      effect: { kind: 'supplier', planId: 'plant' },
    });
    expect(supplierFail.lastError).toBeTruthy();

    const recycler = state.locations.find((loc) => loc.id === 'recycler')!;
    const recyclerFail = applyPlaceAction(state, {
      locationId: 'recycler',
      spaceIndex: openSpaceIndex(recycler),
      effect: { kind: 'recycler', targetPlanId: 'gardens', from: 'plan' },
    });
    expect(recyclerFail.lastError).toBeTruthy();
    const recyclerBuildingFail = applyPlaceAction(state, {
      locationId: 'recycler',
      spaceIndex: openSpaceIndex(recycler),
      effect: { kind: 'recycler', targetPlanId: 'gardens', from: 'building' },
    });
    expect(recyclerBuildingFail.lastError).toBeTruthy();
    const recyclerMismatch = applyPlaceAction(state, {
      locationId: 'recycler',
      spaceIndex: openSpaceIndex(recycler),
      effect: { kind: 'none' },
    });
    expect(recyclerMismatch.lastError).toBeTruthy();

    const swapMeet = state.locations.find((loc) => loc.id === 'swap-meet')!;
    const swapFailMissing = applyPlaceAction(state, {
      locationId: 'swap-meet',
      spaceIndex: openSpaceIndex(swapMeet),
      effect: { kind: 'swap-meet', givePlanId: 'gardens', takePlanId: 'plant' },
    });
    expect(swapFailMissing.lastError).toBeTruthy();
    const swapMismatch = applyPlaceAction(state, {
      locationId: 'swap-meet',
      spaceIndex: openSpaceIndex(swapMeet),
      effect: { kind: 'none' },
    });
    expect(swapMismatch.lastError).toBeTruthy();

    const swapFailSame = applyPlaceAction(
      { ...state, planSupply: ['gardens'] },
      {
        locationId: 'swap-meet',
        spaceIndex: openSpaceIndex(swapMeet),
        effect: { kind: 'swap-meet', givePlanId: 'gardens', takePlanId: 'gardens' },
      },
    );
    expect(swapFailSame.lastError).toBeTruthy();

    const swapFailNeighborhood = applyPlaceAction(
      { ...state, planSupply: ['truck'] },
      {
        locationId: 'swap-meet',
        spaceIndex: openSpaceIndex(swapMeet),
        effect: { kind: 'swap-meet', givePlanId: 'gardens', takePlanId: 'truck' },
      },
    );
    expect(swapFailNeighborhood.lastError).toBeTruthy();
  });

  it('recycler uses special star values for key plans', () => {
    const deck = buildDeck();
    const cases: Array<{
      planId: PlanId;
      plans: PlanId[];
      buildings: PlayerState['buildings'];
    }> = [
      { planId: 'vault', plans: ['vault', 'gardens'], buildings: [] },
      { planId: 'museum', plans: ['museum'], buildings: [{ planId: 'bridge', storedMints: 0 }] },
      {
        planId: 'obelisk',
        plans: ['obelisk'],
        buildings: [
          { planId: 'mine', storedMints: 0 },
          { planId: 'truck', storedMints: 0 },
        ],
      },
      { planId: 'gallery', plans: ['gallery'], buildings: [] },
    ];

    for (const testCase of cases) {
      let state = startGame(baseSettings(), deck);
      state = withPlayer(state, 'p1', (player) => ({
        ...player,
        mints: 10,
        plans: testCase.plans,
        buildings: testCase.buildings,
      }));
      const recycler = state.locations.find((loc) => loc.id === 'recycler')!;
      const next = applyPlaceAction(state, {
        locationId: 'recycler',
        spaceIndex: openSpaceIndex(recycler),
        effect: { kind: 'recycler', targetPlanId: testCase.planId, from: 'plan' },
      });
      const player = next.players.find((p) => p.id === 'p1')!;
      expect(player.plans).not.toContain(testCase.planId);
    }
  });

  it('does not refill plan supply when already full', () => {
    const deck = buildDeck();
    let state = startGame(baseSettings(), deck);
    state = passAllPlayers(state);
    expect(state.planSupply).toHaveLength(3);
  });

  it('lotto does nothing when the deck is empty', () => {
    const deck = buildDeck();
    let state = startGame(baseSettings(), deck);
    state = {
      ...state,
      planDeck: [],
    };
    state = updateLocation(state, 'lotto-location', (location) => ({
      ...location,
      isOpen: true,
    }));
    state = withPlayer(state, 'p1', (player) => ({ ...player, mints: 5 }));
    const lotto = state.locations.find((loc) => loc.id === 'lotto-location')!;
    const next = applyPlaceAction(state, {
      locationId: 'lotto-location',
      spaceIndex: openSpaceIndex(lotto),
      effect: { kind: 'none' },
    });
    expect(next.players[0].plans).toHaveLength(0);
  });

  it('solo supplier does not refill when the deck is empty', () => {
    const deck = buildDeck(['gardens', 'statue']);
    let state = startGame(soloSettings('justin'), deck);
    state = withPlayer(state, 'p1', (player) => ({ ...player, mints: 5 }));
    state = setCurrentPlayer(state, 'p1');
    const supplier = state.locations.find((loc) => loc.id === 'supplier')!;
    const planId = state.planSupply[0];
    const next = applyPlaceAction(state, {
      locationId: 'supplier',
      spaceIndex: openSpaceIndex(supplier),
      effect: { kind: 'supplier', planId },
    });
    expect(next.planSupply).toHaveLength(1);
  });

  it('handles upkeep payouts, gallery mints, and location clearing', () => {
    const deck = buildDeck();
    let state = startGame(baseSettings(), deck);
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      mints: 0,
      buildings: [
        { planId: 'stripmine', storedMints: 0 },
        { planId: 'corporate-hq', storedMints: 0 },
        { planId: 'mine', storedMints: 0 },
        { planId: 'plant', storedMints: 0 },
        { planId: 'workshop', storedMints: 0 },
        { planId: 'gallery', storedMints: 0 },
        { planId: 'bridge', storedMints: 0 },
      ],
    }));
    state = {
      ...state,
      planSupply: state.planSupply.slice(0, 1),
    };
    state = updateLocation(state, 'wholesaler-location', (location) => ({
      ...location,
      isOpen: true,
      ownerId: 'p1',
      spaces: [{ ...location.spaces[0], mints: 1, occupiedBy: 'p2' }],
    }));
    state = updateLocation(state, 'lotto-location', (location) => ({
      ...location,
      isOpen: true,
      ownerId: 'p1',
      spaces: [{ ...location.spaces[0], mints: 2, occupiedBy: 'p2' }],
    }));
    state = updateLocation(state, 'producer', (location) => occupySpace(location, 0, 'p1', 1));
    const next = passAllPlayers(state);
    const p1 = next.players.find((player) => player.id === 'p1')!;
    const gallery = p1.buildings.find((building) => building.planId === 'gallery')!;
    expect(next.phase).toBe('development');
    expect(next.planSupply).toHaveLength(3);
    expect(gallery.storedMints).toBe(1);
    expect(p1.mints).toBe(18);
    const producer = next.locations.find((loc) => loc.id === 'producer')!;
    expect(producer.spaces[0].occupiedBy).toBeUndefined();
  });

  it('handles limited mint supply during upkeep', () => {
    const deck = buildDeck();
    let state = startGame(soloSettings('rachael'), deck);
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      buildings: [{ planId: 'gallery', storedMints: 0 }],
    }));
    state = {
      ...state,
      mintSupply: 5,
    };
    state = updateLocation(state, 'producer', (location) => occupySpace(location, 0, 'p1', 2));
    state = updateLocation(state, 'supplier', (location) => occupySpace(location, 0, 'ai', 1));
    const next = passAllPlayers(state);
    expect(next.mintSupply).toBe(4);
  });

  it('factory grants one mint during upkeep', () => {
    const deck = buildDeck();
    let state = startGame(baseSettings(), deck);
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      mints: 0,
      buildings: [{ planId: 'factory', storedMints: 0 }],
    }));
    const next = passAllPlayers(state);
    const p1 = next.players.find((player) => player.id === 'p1')!;
    expect(p1.mints).toBe(2);
  });

  it('ends the game when a player reaches seven stars', () => {
    const deck = buildDeck();
    let state = startGame(baseSettings(), deck);
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      buildings: [
        { planId: 'gardens', storedMints: 0 },
        { planId: 'statue', storedMints: 0 },
        { planId: 'windmill', storedMints: 0 },
        { planId: 'mine', storedMints: 0 },
      ],
    }));
    state = passAllPlayers(state);
    expect(state.phase).toBe('scoring');
    expect(state.status).toBe('won');
  });

  it('defaults to the first player when the starting player is missing', () => {
    const deck = buildDeck();
    let state = startGame(baseSettings(), deck);
    state = { ...state, startingPlayerId: 'ghost' as PlayerId };
    state = passAllPlayers(state);
    expect(state.currentPlayerIndex).toBe(0);
  });

  it('handles tie-breaking when ages are missing', () => {
    const deck = buildDeck();
    let state = startGame(baseSettings(), deck);
    state = {
      ...state,
      planDeck: [],
      planSupply: [],
    };
    state = withPlayer(state, 'p1', (player) => ({
      ...player,
      buildings: [{ planId: 'gardens', storedMints: 0 }],
      mints: 2,
    }));
    state = withPlayer(state, 'p2', (player) => ({
      ...player,
      buildings: [{ planId: 'gardens', storedMints: 0 }],
      mints: 2,
      age: 40,
    }));
    state = passAllPlayers(state);
    expect(state.results?.tiebreaker).toBe('tie');
  });

  it('handles plan cost and temp agency location cost lookups', () => {
    const deck = buildDeck();
    let state = startGame(baseSettings(), deck);
    state = updateLocation(state, 'producer', (location) => ({
      ...location,
      spaces: location.spaces.map((space) => ({
        ...space,
        cost: { kind: 'planCost' },
      })),
    }));
    const player = state.players[0];
    expect(getLocationCost(state, player, 'producer', 'gardens')).toBe(
      getSupplierCostForPlayer(player, 'gardens'),
    );
    expect(getLocationCost(state, player, 'producer')).toBeNull();
    expect(getLocationCost(state, player, 'supplier')).toBeNull();
    expect(getLocationCost(state, player, 'unknown' as LocationId)).toBeNull();

    const noCostState = updateLocation(state, 'producer', (location) => ({
      ...location,
      spaces: location.spaces.map((space) => ({
        ...space,
        cost: undefined as unknown as typeof space.cost,
      })),
    }));
    expect(getLocationCost(noCostState, player, 'producer', 'gardens')).toBeNull();

    const weirdCostState = updateLocation(state, 'producer', (location) => ({
      ...location,
      spaces: location.spaces.map((space) => ({
        ...space,
        cost: { kind: 'mystery' } as unknown as typeof space.cost,
      })),
    }));
    expect(getLocationCost(weirdCostState, player, 'producer', 'gardens')).toBeNull();

    const tempState = startGame(
      {
        playerCount: 2 as const,
        boardPlayerCount: 2 as const,
        soloMode: false,
        advancedLocations: ['temp-agency'] as const,
        seed: 1,
      },
      deck,
    );
    const tempPlayer = tempState.players[0];
    expect(getLocationCost(tempState, tempPlayer, 'temp-agency')).toBeNull();
    expect(getTempAgencyCost(state, player, 'supplier')).toBeNull();
  });
});
