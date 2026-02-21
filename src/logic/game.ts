import type {
  AiId,
  GameResults,
  GameState,
  LocationId,
  LocationState,
  PlanId,
  PlayerId,
  PlayerState,
  UpkeepEffect,
} from '../types/game';
import type { NonTempPlaceEffect, PlacePayload } from '../state/actions';
import {
  countCultureBuildings,
  getBuildingStars,
  getNeighborhoodSize,
  getPlanCost,
  getPlanDefinition,
  getPlayerTotalStars,
  isCulturePlan,
  isDeedPlan,
  isProductionPlan,
} from './plans';

export function applyPlaceAction(state: GameState, payload: PlacePayload): GameState {
  if (state.status !== 'playing' || state.phase !== 'development') {
    return withError(state, 'You can only place during the Development phase.');
  }

  const player = state.players[state.currentPlayerIndex];
  const location = state.locations.find((loc) => loc.id === payload.locationId);
  if (!location) return withError(state, 'Unknown location.');

  if (state.lockedLocations.includes(location.id)) {
    return withError(state, 'That location is locked until the next Development phase.');
  }

  if (location.type === 'deed' && !location.isOpen) {
    return withError(state, 'That deed location is closed.');
  }

  if (payload.spaceIndex < 0 || payload.spaceIndex >= location.spaces.length) {
    return withError(state, 'Invalid location space.');
  }

  if (location.spaces[payload.spaceIndex].occupiedBy) {
    return withError(state, 'That space is already occupied.');
  }

  const effectTarget = payload.effect.kind === 'temp-agency' ? payload.effect : null;
  const effectLocationId = effectTarget ? effectTarget.targetLocationId : payload.locationId;
  const effect = effectTarget ? effectTarget.effect : payload.effect;

  if (effectTarget) {
    const targetLocation = state.locations.find((loc) => loc.id === effectTarget.targetLocationId);
    if (!targetLocation) return withError(state, 'Invalid Temp Agency target.');
    if (state.lockedLocations.includes(targetLocation.id)) {
      return withError(state, 'That target location is locked.');
    }
    if (!targetLocation.spaces.some((space) => space.occupiedBy)) {
      return withError(state, 'Temp Agency needs an occupied location.');
    }
    if (
      effectTarget.targetSpaceIndex < 0 ||
      effectTarget.targetSpaceIndex >= targetLocation.spaces.length ||
      !targetLocation.spaces[effectTarget.targetSpaceIndex].occupiedBy
    ) {
      return withError(state, 'Temp Agency must target an occupied space.');
    }

    const targetValidation = validateLocationEffect(
      state,
      player,
      effectTarget.targetLocationId,
      effectTarget.effect,
    );
    if (targetValidation) return withError(state, targetValidation);
  } else {
    const validation = validateLocationEffect(state, player, payload.locationId, effect);
    if (validation) return withError(state, validation);
  }

  const cost = getPlacementCost(
    state,
    player,
    payload.locationId,
    effect,
    effectTarget ? effectTarget.targetLocationId : null,
  );
  if (cost === null) {
    return withError(state, 'Invalid placement options for that location.');
  }

  if (player.mints < cost) {
    return withError(state, 'Not enough mints to pay that cost.');
  }

  const updatedLocation = occupyLocationSpace(location, payload.spaceIndex, player.id, cost);
  let nextState = updateLocation(state, updatedLocation);
  nextState = updatePlayer(nextState, player.id, (p) => ({ ...p, mints: p.mints - cost }));

  nextState = applyLocationEffect(
    nextState,
    player.id,
    effectLocationId as Exclude<LocationId, 'temp-agency'>,
    effect,
  );

  nextState = advanceTurnAfterAction(nextState, player, payload.locationId, true);
  return clearError(nextState);
}

export function applyPassTurn(state: GameState): GameState {
  if (state.status !== 'playing' || state.phase !== 'development') {
    return withError(state, 'You can only pass during the Development phase.');
  }

  const alreadyPassed = state.passedPlayers.includes(state.players[state.currentPlayerIndex].id);
  const passedPlayers = alreadyPassed
    ? state.passedPlayers
    : [...state.passedPlayers, state.players[state.currentPlayerIndex].id];
  let nextState = { ...state, passedPlayers };

  if (passedPlayers.length >= state.players.length) {
    nextState = beginUpkeep(nextState);
    return clearError(nextState);
  }

  nextState = advanceTurnAfterAction(
    nextState,
    state.players[state.currentPlayerIndex],
    null,
    false,
  );
  return clearError(nextState);
}

export function resolveCoopChoice(
  state: GameState,
  playerId: PlayerId,
  targetPlayerId: PlayerId,
): GameState {
  if (!state.pendingChoice || state.pendingChoice.type !== 'COOP_TARGET') {
    return withError(state, 'No co-op choice is pending.');
  }
  if (state.pendingChoice.playerId !== playerId) {
    return withError(state, 'Invalid co-op choice.');
  }
  if (playerId === targetPlayerId) {
    return withError(state, 'Co-Op must target another player.');
  }

  let nextState = state;
  nextState = applyMintGain(nextState, playerId, 1);
  nextState = applyMintGain(nextState, targetPlayerId, 1);
  nextState = { ...nextState, pendingChoice: null };
  nextState = resolveUpkeepQueue(nextState);
  return clearError(nextState);
}

export function runAiTurn(state: GameState): GameState {
  if (state.status !== 'playing' || state.phase !== 'development') return state;
  const player = state.players[state.currentPlayerIndex];
  if (player.type !== 'ai') return state;

  const action = chooseAiAction(state, player);
  if (!action) {
    return applyPassTurn(state);
  }
  return applyPlaceAction(state, action);
}
function chooseAiAction(state: GameState, player: PlayerState): PlacePayload | null {
  const locations = state.locations;

  for (const location of locations) {
    if (state.lockedLocations.includes(location.id)) continue;
    if (location.type === 'deed' && !location.isOpen) continue;

    const spaceIndex = location.spaces.findIndex((space) => !space.occupiedBy);
    if (spaceIndex === -1) continue;

    const action = buildAiActionForLocation(state, player, location, spaceIndex);
    if (!action) continue;
    const cost = getPlacementCost(
      state,
      player,
      action.locationId,
      action.effect.kind === 'temp-agency' ? action.effect.effect : action.effect,
      action.effect.kind === 'temp-agency' ? action.effect.targetLocationId : null,
    );
    if (cost !== null && cost <= player.mints) {
      return action;
    }
  }

  return null;
}

function buildAiActionForLocation(
  state: GameState,
  player: PlayerState,
  location: LocationState,
  spaceIndex: number,
): PlacePayload | null {
  switch (location.id) {
    case 'producer':
    case 'leadership-council':
    case 'wholesaler-location':
    case 'lotto-location':
    case 'crowdfunder':
      return { locationId: location.id, spaceIndex, effect: { kind: 'none' } };
    case 'builder': {
      const planId = player.plans[0];
      if (!planId) return null;
      return { locationId: location.id, spaceIndex, effect: { kind: 'builder', planId } };
    }
    case 'supplier': {
      if (player.aiId === 'sonic' && player.plans.length > 0) return null;
      const planId = chooseSupplierPlan(state, player);
      if (!planId) return null;
      return { locationId: location.id, spaceIndex, effect: { kind: 'supplier', planId } };
    }
    case 'recycler': {
      const target = chooseRecycleTarget(player);
      if (!target) return null;
      return {
        locationId: location.id,
        spaceIndex,
        effect: { kind: 'recycler', targetPlanId: target.planId, from: target.from },
      };
    }
    case 'swap-meet': {
      if (state.planSupply.length === 0) return null;
      const give = chooseSwapGive(player);
      if (!give) return null;
      const take = chooseSupplierPlan(state, player, give.planId);
      if (!take) return null;
      return {
        locationId: location.id,
        spaceIndex,
        effect: { kind: 'swap-meet', givePlanId: give.planId, takePlanId: take },
      };
    }
    case 'temp-agency': {
      const target = chooseTempAgencyTarget(state, player);
      if (!target) return null;
      return {
        locationId: location.id,
        spaceIndex,
        effect: {
          kind: 'temp-agency',
          targetLocationId: target.locationId,
          targetSpaceIndex: target.spaceIndex,
          effect: target.effect,
        },
      };
    }
    default:
      return null;
  }
}

function chooseTempAgencyTarget(
  state: GameState,
  player: PlayerState,
): { locationId: LocationId; spaceIndex: number; effect: NonTempPlaceEffect } | null {
  for (const location of state.locations) {
    if (state.lockedLocations.includes(location.id)) continue;
    if (!location.spaces.some((space) => space.occupiedBy)) continue;

    const spaceIndex = location.spaces.findIndex((space) => space.occupiedBy);
    if (spaceIndex === -1) continue;

    switch (location.id) {
      case 'producer':
      case 'leadership-council':
      case 'wholesaler-location':
      case 'lotto-location':
      case 'crowdfunder':
        return { locationId: location.id, spaceIndex, effect: { kind: 'none' } };
      case 'builder': {
        const planId = player.plans[0];
        if (!planId) continue;
        return { locationId: location.id, spaceIndex, effect: { kind: 'builder', planId } };
      }
      case 'supplier': {
        if (player.aiId === 'sonic' && player.plans.length > 0) continue;
        const planId = chooseSupplierPlan(state, player);
        if (!planId) continue;
        return { locationId: location.id, spaceIndex, effect: { kind: 'supplier', planId } };
      }
      case 'recycler': {
        const target = chooseRecycleTarget(player);
        if (!target) continue;
        return {
          locationId: location.id,
          spaceIndex,
          effect: { kind: 'recycler', targetPlanId: target.planId, from: target.from },
        };
      }
      case 'swap-meet': {
        if (state.planSupply.length === 0) continue;
        const give = chooseSwapGive(player);
        if (!give) continue;
        const take = chooseSupplierPlan(state, player, give.planId);
        if (!take) continue;
        return {
          locationId: location.id,
          spaceIndex,
          effect: { kind: 'swap-meet', givePlanId: give.planId, takePlanId: take },
        };
      }
      default:
        continue;
    }
  }

  return null;
}

function chooseSwapGive(player: PlayerState): { planId: PlanId; from: 'plan' | 'building' } | null {
  if (player.plans.length > 0) {
    return { planId: player.plans[0], from: 'plan' };
  }
  if (player.buildings.length > 0) {
    return { planId: player.buildings[0].planId, from: 'building' };
  }
  return null;
}

function chooseRecycleTarget(
  player: PlayerState,
): { planId: PlanId; from: 'plan' | 'building' } | null {
  if (player.plans.length > 0) {
    return { planId: player.plans[0], from: 'plan' };
  }
  if (player.buildings.length > 0) {
    return { planId: player.buildings[0].planId, from: 'building' };
  }
  return null;
}

function chooseSupplierPlan(
  state: GameState,
  player: PlayerState,
  excludedPlanId?: PlanId,
): PlanId | null {
  const supply = state.planSupply.filter((planId) => planId !== excludedPlanId);
  if (supply.length === 0) return null;

  const affordable = supply.filter((planId) => {
    if (player.aiId === 'mort' && isProductionPlan(planId)) return false;
    return player.mints >= getSupplierCost(player, planId);
  });
  if (affordable.length === 0) return null;

  const preferHighCost =
    player.aiId === 'rachael' || player.aiId === 'sonic' || player.aiId === 'mort';
  const costValues = affordable.map((planId) => getPlanCost(planId));
  const targetCost = preferHighCost ? Math.max(...costValues) : Math.min(...costValues);
  const costFiltered = affordable.filter((planId) => getPlanCost(planId) === targetCost);

  const typePriority = getAiTypePriority(player.aiId);
  const typeFiltered = costFiltered.filter((planId) => typePriority.includes(planTag(planId)));
  const bestTypeIndex = Math.min(
    ...typeFiltered.map((planId) => typePriority.indexOf(planTag(planId))),
  );
  const typeCandidates = typeFiltered.filter(
    (planId) => typePriority.indexOf(planTag(planId)) === bestTypeIndex,
  );

  const supplyOrder = state.planSupply;
  const sorted = [...typeCandidates].sort(
    (a, b) => supplyOrder.indexOf(b) - supplyOrder.indexOf(a),
  );
  return sorted[0]!;
}

function planTag(planId: PlanId): 'Utility' | 'Deed' | 'Production' | 'Culture' {
  if (isCulturePlan(planId)) return 'Culture';
  if (isDeedPlan(planId)) return 'Deed';
  if (isProductionPlan(planId)) return 'Production';
  return 'Utility';
}

function getAiTypePriority(
  aiId?: AiId,
): ReadonlyArray<'Utility' | 'Deed' | 'Production' | 'Culture'> {
  switch (aiId) {
    case 'justin':
      return ['Utility', 'Deed', 'Production', 'Culture'];
    case 'rachael':
      return ['Production', 'Culture', 'Utility', 'Deed'];
    case 'sonic':
      return ['Culture', 'Production', 'Utility', 'Deed'];
    case 'mort':
      return ['Utility', 'Deed', 'Culture', 'Production'];
    default:
      return ['Utility', 'Deed', 'Production', 'Culture'];
  }
}

function validateLocationEffect(
  state: GameState,
  player: PlayerState,
  locationId: LocationId,
  effect: NonTempPlaceEffect,
): string | null {
  switch (locationId) {
    case 'supplier':
      if (effect.kind !== 'supplier') return 'Supplier requires a plan choice.';
      if (!state.planSupply.includes(effect.planId)) return 'That plan is not in the supply.';
      return null;
    case 'builder':
      if (effect.kind !== 'builder') return 'Builder requires a plan choice.';
      if (!player.plans.includes(effect.planId)) return 'That plan is not in your neighborhood.';
      return null;
    case 'recycler':
      if (effect.kind !== 'recycler') return 'Recycler requires a card choice.';
      if (effect.from === 'plan') {
        if (!player.plans.includes(effect.targetPlanId)) {
          return 'That plan is not in your neighborhood.';
        }
        return null;
      }
      if (!player.buildings.some((b) => b.planId === effect.targetPlanId)) {
        return 'That building is not in your neighborhood.';
      }
      return null;
    case 'swap-meet':
      if (effect.kind !== 'swap-meet') return 'Swap Meet requires a swap choice.';
      if (!state.planSupply.includes(effect.takePlanId)) return 'That plan is not in the supply.';
      if (effect.givePlanId === effect.takePlanId) return 'You must take a different plan.';
      if (
        !player.plans.includes(effect.givePlanId) &&
        !player.buildings.some((b) => b.planId === effect.givePlanId)
      ) {
        return 'That card is not in your neighborhood.';
      }
      return null;
    case 'temp-agency':
      return 'Temp Agency must target another location.';
    default:
      return null;
  }
}

function getPlacementCost(
  state: GameState,
  player: PlayerState,
  locationId: LocationId,
  effect: NonTempPlaceEffect,
  tempTargetId: LocationId | null,
): number | null {
  if (locationId === 'temp-agency') {
    const planId = (effect as { planId?: PlanId }).planId;
    return getTempAgencyCost(state, player, tempTargetId!, planId);
  }

  if (locationId === 'builder') return getBuilderCost(player);

  if (locationId === 'supplier') {
    return getSupplierCost(player, (effect as { planId: PlanId }).planId);
  }

  const location = state.locations.find((loc) => loc.id === locationId)!;
  const cost = location.spaces[0].cost;
  if (cost.kind === 'fixed') return cost.amount;

  return null;
}

function applyLocationEffect(
  state: GameState,
  playerId: PlayerId,
  locationId: Exclude<LocationId, 'temp-agency'>,
  effect: NonTempPlaceEffect,
): GameState {
  switch (locationId) {
    case 'producer':
      return applyMintGain(state, playerId, 2);
    case 'supplier':
      return gainPlanFromSupplier(state, playerId, (effect as { planId: PlanId }).planId);
    case 'builder':
      return buildPlan(state, playerId, (effect as { planId: PlanId }).planId);
    case 'leadership-council':
      return applyLeadership(state, playerId);
    case 'wholesaler-location':
      return applyMintGain(state, playerId, 2);
    case 'lotto-location':
      return gainPlanFromDeck(state, playerId);
    case 'crowdfunder':
      return applyCrowdfunder(state, playerId);
    case 'recycler': {
      const recyclerEffect = effect as Extract<NonTempPlaceEffect, { kind: 'recycler' }>;
      return applyRecycler(state, playerId, recyclerEffect.targetPlanId, recyclerEffect.from);
    }
    case 'swap-meet': {
      const swapEffect = effect as Extract<NonTempPlaceEffect, { kind: 'swap-meet' }>;
      return applySwapMeet(state, playerId, swapEffect.givePlanId, swapEffect.takePlanId);
    }
  }
}

function applyLeadership(state: GameState, playerId: PlayerId): GameState {
  let nextState = { ...state, startingPlayerId: playerId };
  nextState = applyMintGain(nextState, playerId, 1);
  return nextState;
}

function applyCrowdfunder(state: GameState, playerId: PlayerId): GameState {
  let nextState = applyMintGain(state, playerId, 3);
  for (const player of nextState.players) {
    if (player.id === playerId) continue;
    nextState = applyMintGain(nextState, player.id, 1);
  }
  return nextState;
}

function gainPlanFromSupplier(state: GameState, playerId: PlayerId, planId: PlanId): GameState {
  let nextState = state;
  const hasAssembler = playerHasBuilding(state, playerId, 'assembler');

  nextState = removePlanFromSupply(nextState, planId);
  if (hasAssembler) {
    nextState = addBuilding(nextState, playerId, planId);
    nextState = openDeedLocationIfNeeded(nextState, playerId, planId);
  } else {
    nextState = addPlan(nextState, playerId, planId);
  }

  if (state.settings?.soloMode) {
    nextState = refillPlanSupplyImmediate(nextState, 1);
  }

  return nextState;
}

function gainPlanFromDeck(state: GameState, playerId: PlayerId): GameState {
  if (state.planDeck.length === 0) return state;
  const [top, ...rest] = state.planDeck;
  let nextState = { ...state, planDeck: rest };
  nextState = addPlan(nextState, playerId, top);
  return nextState;
}

function buildPlan(state: GameState, playerId: PlayerId, planId: PlanId): GameState {
  let nextState = removePlan(state, playerId, planId);
  nextState = addBuilding(nextState, playerId, planId);
  nextState = openDeedLocationIfNeeded(nextState, playerId, planId);
  return nextState;
}

function applyRecycler(
  state: GameState,
  playerId: PlayerId,
  planId: PlanId,
  from: 'plan' | 'building',
): GameState {
  let nextState = state;
  const player = getPlayer(state, playerId);

  if (from === 'plan') {
    const starValue = getPlanStarForRecycle(player, planId);
    const gain = getPlanCost(planId) + starValue;
    nextState = removePlan(state, playerId, planId);
    nextState = addPlanToBottomOfDeck(nextState, planId);
    nextState = applyMintGain(nextState, playerId, gain);
    return nextState;
  }

  const building = player.buildings.find((b) => b.planId === planId)!;
  const starValue = getBuildingStars(building, player);
  nextState = removeBuilding(state, playerId, planId);
  nextState = addPlanToBottomOfDeck(nextState, planId);
  nextState = applyMintGain(nextState, playerId, starValue);

  if (building.planId === 'gallery' && building.storedMints > 0) {
    nextState = returnMintsToSupply(nextState, building.storedMints);
  }

  return nextState;
}

function getPlanStarForRecycle(player: PlayerState, planId: PlanId): number {
  if (planId === 'vault') return player.plans.length * 2;
  if (planId === 'museum') return countCultureBuildings(player.buildings);
  if (planId === 'obelisk') return player.buildings.length;
  if (planId === 'gallery') return 0;
  const definition = getPlanDefinition(planId);
  return definition.stars as number;
}

function applySwapMeet(
  state: GameState,
  playerId: PlayerId,
  givePlanId: PlanId,
  takePlanId: PlanId,
): GameState {
  let nextState = state;
  const player = getPlayer(state, playerId);
  const fromPlans = player.plans.includes(givePlanId);

  if (fromPlans) {
    nextState = removePlan(nextState, playerId, givePlanId);
  } else {
    const building = player.buildings.find((b) => b.planId === givePlanId)!;
    nextState = removeBuilding(nextState, playerId, givePlanId);
    if (building.planId === 'gallery' && building.storedMints > 0) {
      nextState = returnMintsToSupply(nextState, building.storedMints);
    }
  }

  nextState = replacePlanInSupply(nextState, takePlanId, givePlanId);
  nextState = addPlan(nextState, playerId, takePlanId);
  return nextState;
}

function applyMintGain(state: GameState, playerId: PlayerId, amount: number): GameState {
  if (amount <= 0) return state;
  let nextState = updatePlayer(state, playerId, (p) => ({ ...p, mints: p.mints + amount }));
  if (nextState.mintSupply !== 'unlimited') {
    nextState = {
      ...nextState,
      mintSupply: Math.max(0, nextState.mintSupply - amount),
    };
    nextState = checkRachaelWin(nextState);
  }
  return nextState;
}

function returnMintsToSupply(state: GameState, amount: number): GameState {
  if (state.mintSupply === 'unlimited') return state;
  const next = { ...state, mintSupply: state.mintSupply + amount };
  return checkRachaelWin(next);
}

function checkRachaelWin(state: GameState): GameState {
  if (!state.settings?.soloMode || state.settings.aiOpponent !== 'rachael') return state;
  if (state.mintSupply !== 'unlimited' && state.mintSupply <= 0) {
    const results: GameResults = {
      scores: state.players.map((p) => ({ playerId: p.id, stars: getPlayerTotalStars(p) })),
      winnerIds: ['ai'],
      tiebreaker: 'tie',
    };
    return {
      ...state,
      status: 'lost',
      phase: 'scoring',
      results,
    };
  }
  return state;
}

function removePlanFromSupply(state: GameState, planId: PlanId): GameState {
  return { ...state, planSupply: state.planSupply.filter((id) => id !== planId) };
}

function replacePlanInSupply(state: GameState, removeId: PlanId, addId: PlanId): GameState {
  const planSupply = state.planSupply.map((id) => (id === removeId ? addId : id));
  return { ...state, planSupply };
}

function addPlan(state: GameState, playerId: PlayerId, planId: PlanId): GameState {
  return updatePlayer(state, playerId, (player) => ({
    ...player,
    plans: [...player.plans, planId],
  }));
}

function removePlan(state: GameState, playerId: PlayerId, planId: PlanId): GameState {
  return updatePlayer(state, playerId, (player) => ({
    ...player,
    plans: player.plans.filter((id) => id !== planId),
  }));
}

function addBuilding(state: GameState, playerId: PlayerId, planId: PlanId): GameState {
  return updatePlayer(state, playerId, (player) => ({
    ...player,
    buildings: [...player.buildings, { planId, storedMints: 0 }],
  }));
}

function removeBuilding(state: GameState, playerId: PlayerId, planId: PlanId): GameState {
  return updatePlayer(state, playerId, (player) => ({
    ...player,
    buildings: player.buildings.filter((b) => b.planId !== planId),
  }));
}

function addPlanToBottomOfDeck(state: GameState, planId: PlanId): GameState {
  return { ...state, planDeck: [...state.planDeck, planId] };
}

function refillPlanSupplyImmediate(state: GameState, count: number): GameState {
  if (state.planDeck.length === 0) return state;
  const toDraw = Math.min(Math.max(0, count), state.planDeck.length);
  const draw = state.planDeck.slice(0, toDraw);
  return {
    ...state,
    planDeck: state.planDeck.slice(toDraw),
    planSupply: [...state.planSupply, ...draw],
  };
}

function openDeedLocationIfNeeded(state: GameState, playerId: PlayerId, planId: PlanId): GameState {
  if (planId === 'wholesaler') {
    return updateDeedLocation(state, 'wholesaler-location', playerId);
  }
  if (planId === 'lotto') {
    return updateDeedLocation(state, 'lotto-location', playerId);
  }
  return state;
}

function updateDeedLocation(
  state: GameState,
  locationId: LocationId,
  ownerId: PlayerId,
): GameState {
  const location = state.locations.find((loc) => loc.id === locationId)!;
  const updated = { ...location, isOpen: true, ownerId };
  return updateLocation(state, updated);
}

function getSupplierCost(player: PlayerState, planId: PlanId): number {
  const hasTruck = player.buildings.some((b) => b.planId === 'truck');
  const cost = getPlanCost(planId) - (hasTruck ? 1 : 0);
  return Math.max(1, cost);
}

function advanceTurnAfterAction(
  state: GameState,
  player: PlayerState,
  locationId: LocationId | null,
  resetPasses: boolean,
): GameState {
  let nextState = resetPasses ? { ...state, passedPlayers: [] } : { ...state };

  if (player.type === 'ai' && player.aiId === 'justin' && locationId) {
    nextState = {
      ...nextState,
      lockedLocations: [...new Set([...nextState.lockedLocations, locationId])],
    };
  }

  const isSonic = player.type === 'ai' && player.aiId === 'sonic';
  if (isSonic) {
    const usedBonus = state.sonicBonusTurnUsed;
    if (!usedBonus) {
      return { ...nextState, sonicBonusTurnUsed: true };
    }
    nextState = { ...nextState, sonicBonusTurnUsed: false };
  } else if (state.sonicBonusTurnUsed) {
    nextState = { ...nextState, sonicBonusTurnUsed: false };
  }

  const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  return { ...nextState, currentPlayerIndex: nextIndex };
}

function beginUpkeep(state: GameState): GameState {
  let nextState = { ...state, phase: 'upkeep', passedPlayers: [], lockedLocations: [] };

  const endGame = checkEndGame(nextState);
  if (endGame) return endGame;

  nextState = refillPlanSupplyToSize(nextState);
  nextState = buildUpkeepQueue(nextState);
  nextState = resolveUpkeepQueue(nextState);
  return nextState;
}

function refillPlanSupplyToSize(state: GameState): GameState {
  const target = state.settings?.soloMode ? 2 : 3;
  if (state.planSupply.length >= target) return state;
  const needed = target - state.planSupply.length;
  const draw = state.planDeck.slice(0, needed);
  return {
    ...state,
    planDeck: state.planDeck.slice(draw.length),
    planSupply: [...state.planSupply, ...draw],
  };
}

function buildUpkeepQueue(state: GameState): GameState {
  const queue: UpkeepEffect[] = [];
  for (const player of state.players) {
    for (const building of player.buildings) {
      switch (building.planId) {
        case 'stripmine':
          queue.push({ type: 'GAIN_MINTS', playerId: player.id, amount: 3 });
          break;
        case 'coop':
          queue.push({ type: 'COOP', playerId: player.id });
          break;
        case 'corporate-hq':
          queue.push({ type: 'GAIN_MINTS_PER_BUILDING', playerId: player.id });
          break;
        case 'mine':
          queue.push({ type: 'GAIN_MINTS', playerId: player.id, amount: 1 });
          break;
        case 'factory':
          queue.push({ type: 'GAIN_MINTS', playerId: player.id, amount: 1 });
          break;
        case 'plant':
          queue.push({ type: 'GAIN_MINTS', playerId: player.id, amount: 2 });
          break;
        case 'workshop':
          queue.push({ type: 'GAIN_MINTS', playerId: player.id, amount: 1 });
          break;
        case 'gallery':
          queue.push({ type: 'GALLERY', playerId: player.id, planId: building.planId });
          break;
        default:
          break;
      }
    }
  }
  return { ...state, upkeepQueue: queue };
}

function resolveUpkeepQueue(state: GameState): GameState {
  let nextState = { ...state };
  while (nextState.upkeepQueue.length > 0) {
    const [effect, ...rest] = nextState.upkeepQueue;
    nextState = { ...nextState, upkeepQueue: rest };

    if (effect.type === 'COOP') {
      nextState = {
        ...nextState,
        pendingChoice: { type: 'COOP_TARGET', playerId: effect.playerId },
      };
      return nextState;
    }

    if (effect.type === 'GAIN_MINTS') {
      nextState = applyMintGain(nextState, effect.playerId, effect.amount);
      continue;
    }

    if (effect.type === 'GAIN_MINTS_PER_BUILDING') {
      const player = getPlayer(nextState, effect.playerId);
      nextState = applyMintGain(nextState, effect.playerId, player.buildings.length);
      continue;
    }

    if (effect.type === 'GALLERY') {
      nextState = addGalleryMint(nextState, effect.playerId, effect.planId);
      continue;
    }
  }

  nextState = resolveDeedPayouts(nextState);
  nextState = clearLocations(nextState);
  nextState = applyIncome(nextState);
  nextState = startNextRound(nextState);
  return nextState;
}

function addGalleryMint(state: GameState, playerId: PlayerId, planId: PlanId): GameState {
  let nextState = updatePlayer(state, playerId, (player) => ({
    ...player,
    buildings: player.buildings.map((b) =>
      b.planId === planId ? { ...b, storedMints: b.storedMints + 1 } : b,
    ),
  }));

  if (nextState.mintSupply !== 'unlimited') {
    nextState = {
      ...nextState,
      mintSupply: Math.max(0, nextState.mintSupply - 1),
    };
    nextState = checkRachaelWin(nextState);
  }

  return nextState;
}

function resolveDeedPayouts(state: GameState): GameState {
  let nextState = state;
  for (const location of state.locations) {
    if (location.id === 'wholesaler-location' || location.id === 'lotto-location') {
      if (location.ownerId && location.spaces.some((space) => space.mints > 0)) {
        const payout = location.id === 'wholesaler-location' ? 1 : 2;
        nextState = applyMintGain(nextState, location.ownerId, payout);
      }
    }
  }
  return nextState;
}

function clearLocations(state: GameState): GameState {
  let nextState = state;
  nextState = {
    ...nextState,
    locations: nextState.locations.map((location) => {
      const clearedSpaces = location.spaces.map((space) => ({
        ...space,
        occupiedBy: undefined,
        mints: 0,
      }));

      return {
        ...location,
        spaces: clearedSpaces,
      };
    }),
  };

  if (state.mintSupply !== 'unlimited') {
    const returned = countReturnedMints(state);
    nextState = { ...nextState, mintSupply: state.mintSupply + returned };
    nextState = checkRachaelWin(nextState);
  }
  return nextState;
}

function countReturnedMints(state: GameState): number {
  let total = 0;
  for (const location of state.locations) {
    for (const space of location.spaces) {
      if (space.mints === 0) continue;
      if (
        state.settings?.soloMode &&
        state.settings.aiOpponent === 'rachael' &&
        location.id === 'supplier' &&
        space.occupiedBy === 'ai'
      ) {
        continue;
      }
      total += space.mints;
    }
  }
  return total;
}

function applyIncome(state: GameState): GameState {
  let nextState = state;
  for (const player of nextState.players) {
    if (player.type === 'ai' && player.aiId === 'mort') continue;
    nextState = applyMintGain(nextState, player.id, 1);
  }
  return nextState;
}

function startNextRound(state: GameState): GameState {
  const startingIndex = state.players.findIndex((p) => p.id === state.startingPlayerId);
  return {
    ...state,
    phase: 'development',
    currentPlayerIndex: startingIndex >= 0 ? startingIndex : 0,
    passedPlayers: [],
    round: state.round + 1,
    lockedLocations: [],
    pendingChoice: null,
  };
}

function checkEndGame(state: GameState): GameState | null {
  const targetSupply = state.settings?.soloMode ? 2 : 3;
  const cannotRefill = state.planSupply.length + state.planDeck.length < targetSupply;
  const hasSevenStars = state.players.some((player) => getPlayerTotalStars(player) >= 7);

  if (!cannotRefill && !hasSevenStars) return null;

  const results = scoreGame(state);
  const status = determineStatus(state, results);

  return {
    ...state,
    status,
    phase: 'scoring',
    results,
  };
}

function scoreGame(state: GameState): GameResults {
  const scores = state.players.map((player) => ({
    playerId: player.id,
    stars: getPlayerTotalStars(player),
  }));

  const maxStars = Math.max(...scores.map((s) => s.stars));
  const top = scores.filter((s) => s.stars === maxStars);
  if (top.length === 1) {
    return { scores, winnerIds: [top[0].playerId], tiebreaker: 'stars' };
  }

  const neighborhoods = top.map((entry) => ({
    playerId: entry.playerId,
    size: getNeighborhoodSize(getPlayer(state, entry.playerId)),
  }));
  const minSize = Math.min(...neighborhoods.map((n) => n.size));
  const sizeWinners = neighborhoods.filter((n) => n.size === minSize);
  if (sizeWinners.length === 1) {
    return { scores, winnerIds: [sizeWinners[0].playerId], tiebreaker: 'neighborhood' };
  }

  const mintCounts = sizeWinners.map((entry) => ({
    playerId: entry.playerId,
    mints: getPlayer(state, entry.playerId).mints,
  }));
  const maxMints = Math.max(...mintCounts.map((m) => m.mints));
  const mintWinners = mintCounts.filter((m) => m.mints === maxMints);
  if (mintWinners.length === 1) {
    return { scores, winnerIds: [mintWinners[0].playerId], tiebreaker: 'mints' };
  }

  const ages = mintWinners
    .map((entry) => {
      const player = getPlayer(state, entry.playerId);
      return player.age === undefined
        ? null
        : { playerId: entry.playerId, distance: Math.abs(player.age - 42) };
    })
    .filter((entry): entry is { playerId: PlayerId; distance: number } => Boolean(entry));

  if (ages.length === mintWinners.length) {
    const minDistance = Math.min(...ages.map((a) => a.distance));
    const ageWinners = ages.filter((a) => a.distance === minDistance);
    if (ageWinners.length === 1) {
      return { scores, winnerIds: [ageWinners[0].playerId], tiebreaker: 'age' };
    }
  }

  return {
    scores,
    winnerIds: mintWinners.map((m) => m.playerId),
    tiebreaker: 'tie',
  };
}

function determineStatus(state: GameState, results: GameResults): GameState['status'] {
  if (!state.settings?.soloMode) return 'won';
  const humanId = 'p1';
  if (results.winnerIds.includes(humanId)) return 'won';
  return 'lost';
}

function updatePlayer(
  state: GameState,
  playerId: PlayerId,
  updater: (player: PlayerState) => PlayerState,
): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? updater(player) : player)),
  };
}

function updateLocation(state: GameState, location: LocationState): GameState {
  return {
    ...state,
    locations: state.locations.map((loc) => (loc.id === location.id ? location : loc)),
  };
}

function occupyLocationSpace(
  location: LocationState,
  spaceIndex: number,
  playerId: PlayerId,
  cost: number,
): LocationState {
  const spaces = location.spaces.map((space, index) => {
    if (index !== spaceIndex) return space;
    return { ...space, occupiedBy: playerId, mints: space.mints + cost };
  });
  return { ...location, spaces };
}

function getPlayer(state: GameState, playerId: PlayerId): PlayerState {
  const player = state.players.find((p) => p.id === playerId);
  return player!;
}

function playerHasBuilding(state: GameState, playerId: PlayerId, planId: PlanId): boolean {
  const player = getPlayer(state, playerId);
  return player.buildings.some((b) => b.planId === planId);
}

function withError(state: GameState, message: string): GameState {
  return { ...state, lastError: message };
}

function clearError(state: GameState): GameState {
  return { ...state, lastError: undefined };
}

export function getBuilderCost(player: PlayerState): number {
  const hasCrane = player.buildings.some((b) => b.planId === 'crane');
  return hasCrane ? 1 : 2;
}

export function getSupplierCostForPlayer(player: PlayerState, planId: PlanId): number {
  return getSupplierCost(player, planId);
}

export function getLocationCost(
  state: GameState,
  player: PlayerState,
  locationId: LocationId,
  planId?: PlanId,
): number | null {
  if (locationId === 'builder') return getBuilderCost(player);
  if (locationId === 'supplier') {
    if (!planId) return null;
    return getSupplierCost(player, planId);
  }

  const location = state.locations.find((loc) => loc.id === locationId);
  if (!location) return null;
  const cost = location.spaces[0]?.cost;
  if (!cost) return null;

  if (cost.kind === 'fixed') return cost.amount;
  if (cost.kind === 'planCost') {
    if (!planId) return null;
    return getSupplierCost(player, planId);
  }
  if (cost.kind === 'tempAgency') return null;
  return null;
}

export function getTempAgencyCost(
  state: GameState,
  player: PlayerState,
  targetLocationId: LocationId,
  planId?: PlanId,
): number | null {
  const targetCost = getLocationCost(state, player, targetLocationId, planId);
  if (targetCost === null) return null;
  return 1 + targetCost;
}
