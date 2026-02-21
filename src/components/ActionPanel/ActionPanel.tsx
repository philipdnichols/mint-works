import { useEffect, useMemo, useState } from 'react';
import type { Dispatch } from 'react';
import type { GameAction, NonTempPlaceEffect, PlaceEffect } from '../../state/actions';
import type { GameState, LocationId, PlanId, PlayerState } from '../../types/game';
import { getPlanDefinition } from '../../logic/plans';
import { getLocationCost, getTempAgencyCost } from '../../logic/game';

interface ActionPanelProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

interface SelectionState {
  locationId: LocationId | '';
  supplierPlanId: PlanId | '';
  builderPlanId: PlanId | '';
  recyclePlanId: PlanId | '';
  recycleFrom: 'plan' | 'building';
  swapGiveId: PlanId | '';
  swapTakeId: PlanId | '';
  tempTargetLocationId: LocationId | '';
  tempSupplierPlanId: PlanId | '';
  tempBuilderPlanId: PlanId | '';
  tempRecyclePlanId: PlanId | '';
  tempRecycleFrom: 'plan' | 'building';
  tempSwapGiveId: PlanId | '';
  tempSwapTakeId: PlanId | '';
}

const initialSelection: SelectionState = {
  locationId: '',
  supplierPlanId: '',
  builderPlanId: '',
  recyclePlanId: '',
  recycleFrom: 'plan',
  swapGiveId: '',
  swapTakeId: '',
  tempTargetLocationId: '',
  tempSupplierPlanId: '',
  tempBuilderPlanId: '',
  tempRecyclePlanId: '',
  tempRecycleFrom: 'plan',
  tempSwapGiveId: '',
  tempSwapTakeId: '',
};

export function ActionPanel({ state, dispatch }: ActionPanelProps) {
  const player = state.players[state.currentPlayerIndex];
  const [selection, setSelection] = useState<SelectionState>(initialSelection);

  const availableLocations = useMemo(
    () =>
      state.locations.filter(
        (location) =>
          !state.lockedLocations.includes(location.id) &&
          (location.type !== 'deed' || location.isOpen) &&
          location.spaces.some((space) => !space.occupiedBy),
      ),
    [state.locations, state.lockedLocations],
  );

  useEffect(() => {
    if (
      selection.locationId &&
      !availableLocations.some((loc) => loc.id === selection.locationId)
    ) {
      setSelection(initialSelection);
    }
  }, [availableLocations, selection.locationId]);

  useEffect(() => {
    setSelection(initialSelection);
  }, [state.currentPlayerIndex, state.phase]);

  if (state.status !== 'playing') {
    return (
      <section className="panel">
        <h3>Game Over</h3>
        <p>Start a new game to play again.</p>
      </section>
    );
  }

  if (state.pendingChoice?.type === 'COOP_TARGET') {
    const options = state.players.filter((p) => p.id !== state.pendingChoice?.playerId);
    return (
      <section className="panel">
        <h3>Co-Op: Choose a player</h3>
        <div className="panel__row">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() =>
                dispatch({
                  type: 'RESOLVE_COOP_TARGET',
                  payload: {
                    playerId: state.pendingChoice!.playerId,
                    targetPlayerId: option.id,
                  },
                })
              }
            >
              Give 1 mint to {option.name}
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (state.phase !== 'development') {
    return (
      <section className="panel">
        <h3>Upkeep in progress</h3>
        <p>Resolve any pending effects to continue.</p>
      </section>
    );
  }

  if (player.type === 'ai') {
    return (
      <section className="panel">
        <h3>{player.name} (AI)</h3>
        <button type="button" onClick={() => dispatch({ type: 'RUN_AI_TURN' })}>
          Run AI Turn
        </button>
      </section>
    );
  }

  const selectedLocation = availableLocations.find((loc) => loc.id === selection.locationId);
  const openSpaceIndex = selectedLocation
    ? selectedLocation.spaces.findIndex((space) => !space.occupiedBy)
    : -1;

  const rawEffect = buildEffect(selection, selectedLocation?.id ?? null);
  const effect = hydrateTempEffect(rawEffect, state);

  const cost = selectedLocation
    ? getCostForSelection(state, player, selectedLocation.id, selection, effect)
    : null;
  const canPlace = Boolean(
    selectedLocation && openSpaceIndex >= 0 && effect && cost !== null && cost <= player.mints,
  );

  const handlePlace = () => {
    if (!selectedLocation || openSpaceIndex < 0 || !effect) return;
    dispatch({
      type: 'PLACE_ON_LOCATION',
      payload: {
        locationId: selectedLocation.id,
        spaceIndex: openSpaceIndex,
        effect,
      },
    });
  };

  return (
    <section className="panel">
      <h3>{player.name}'s Turn</h3>
      <div className="panel__row">
        <label>
          Location
          <select
            value={selection.locationId}
            onChange={(event) =>
              setSelection((current) => ({
                ...current,
                locationId: event.target.value as LocationId,
              }))
            }
          >
            <option value="">Select...</option>
            {availableLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        {cost !== null && <span className="panel__cost">Cost: {cost} mint(s)</span>}
      </div>

      {selectedLocation?.id === 'supplier' && (
        <label className="panel__row">
          Plan to gain
          <select
            value={selection.supplierPlanId}
            onChange={(event) =>
              setSelection((current) => ({
                ...current,
                supplierPlanId: event.target.value as PlanId,
              }))
            }
          >
            <option value="">Select plan...</option>
            {state.planSupply.map((planId) => (
              <option key={planId} value={planId}>
                {planLabel(planId)}
              </option>
            ))}
          </select>
        </label>
      )}

      {selectedLocation?.id === 'builder' && (
        <label className="panel__row">
          Plan to build
          <select
            value={selection.builderPlanId}
            onChange={(event) =>
              setSelection((current) => ({
                ...current,
                builderPlanId: event.target.value as PlanId,
              }))
            }
          >
            <option value="">Select plan...</option>
            {player.plans.map((planId) => (
              <option key={planId} value={planId}>
                {planLabel(planId)}
              </option>
            ))}
          </select>
        </label>
      )}

      {selectedLocation?.id === 'recycler' && (
        <div className="panel__row">
          <label>
            Recycle card
            <select
              value={selection.recyclePlanId}
              onChange={(event) =>
                setSelection((current) => {
                  const value = event.target.value as PlanId;
                  const from = player.plans.includes(value) ? 'plan' : 'building';
                  return {
                    ...current,
                    recyclePlanId: value,
                    recycleFrom: from,
                  };
                })
              }
            >
              <option value="">Select card...</option>
              {player.plans.map((planId) => (
                <option key={`plan-${planId}`} value={planId}>
                  Plan: {planLabel(planId)}
                </option>
              ))}
              {player.buildings.map((building) => (
                <option key={`building-${building.planId}`} value={building.planId}>
                  Building: {planLabel(building.planId)}
                </option>
              ))}
            </select>
          </label>
          <label>
            From
            <select
              value={selection.recycleFrom}
              onChange={(event) =>
                setSelection((current) => ({
                  ...current,
                  recycleFrom: event.target.value as 'plan' | 'building',
                }))
              }
            >
              <option value="plan">Plan</option>
              <option value="building">Building</option>
            </select>
          </label>
        </div>
      )}

      {selectedLocation?.id === 'swap-meet' && (
        <div className="panel__row">
          <label>
            Give
            <select
              value={selection.swapGiveId}
              onChange={(event) =>
                setSelection((current) => ({
                  ...current,
                  swapGiveId: event.target.value as PlanId,
                }))
              }
            >
              <option value="">Select card...</option>
              {player.plans.map((planId) => (
                <option key={`plan-${planId}`} value={planId}>
                  Plan: {planLabel(planId)}
                </option>
              ))}
              {player.buildings.map((building) => (
                <option key={`building-${building.planId}`} value={building.planId}>
                  Building: {planLabel(building.planId)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Take
            <select
              value={selection.swapTakeId}
              onChange={(event) =>
                setSelection((current) => ({
                  ...current,
                  swapTakeId: event.target.value as PlanId,
                }))
              }
            >
              <option value="">Select plan...</option>
              {state.planSupply
                .filter((planId) => planId !== selection.swapGiveId)
                .map((planId) => (
                  <option key={planId} value={planId}>
                    {planLabel(planId)}
                  </option>
                ))}
            </select>
          </label>
        </div>
      )}

      {selectedLocation?.id === 'temp-agency' && (
        <div className="panel__row panel__row--stack">
          <label>
            Target occupied location
            <select
              value={selection.tempTargetLocationId}
              onChange={(event) =>
                setSelection((current) => ({
                  ...current,
                  tempTargetLocationId: event.target.value as LocationId,
                }))
              }
            >
              <option value="">Select target...</option>
              {state.locations
                .filter(
                  (loc) => loc.id !== 'temp-agency' && loc.spaces.some((space) => space.occupiedBy),
                )
                .map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
            </select>
          </label>

          {selection.tempTargetLocationId === 'supplier' && (
            <label>
              Plan to gain
              <select
                value={selection.tempSupplierPlanId}
                onChange={(event) =>
                  setSelection((current) => ({
                    ...current,
                    tempSupplierPlanId: event.target.value as PlanId,
                  }))
                }
              >
                <option value="">Select plan...</option>
                {state.planSupply.map((planId) => (
                  <option key={planId} value={planId}>
                    {planLabel(planId)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {selection.tempTargetLocationId === 'builder' && (
            <label>
              Plan to build
              <select
                value={selection.tempBuilderPlanId}
                onChange={(event) =>
                  setSelection((current) => ({
                    ...current,
                    tempBuilderPlanId: event.target.value as PlanId,
                  }))
                }
              >
                <option value="">Select plan...</option>
                {player.plans.map((planId) => (
                  <option key={planId} value={planId}>
                    {planLabel(planId)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {selection.tempTargetLocationId === 'recycler' && (
            <div className="panel__row">
              <label>
                Recycle card
                <select
                  value={selection.tempRecyclePlanId}
                  onChange={(event) =>
                    setSelection((current) => {
                      const value = event.target.value as PlanId;
                      const from = player.plans.includes(value) ? 'plan' : 'building';
                      return {
                        ...current,
                        tempRecyclePlanId: value,
                        tempRecycleFrom: from,
                      };
                    })
                  }
                >
                  <option value="">Select card...</option>
                  {player.plans.map((planId) => (
                    <option key={`plan-${planId}`} value={planId}>
                      Plan: {planLabel(planId)}
                    </option>
                  ))}
                  {player.buildings.map((building) => (
                    <option key={`building-${building.planId}`} value={building.planId}>
                      Building: {planLabel(building.planId)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                From
                <select
                  value={selection.tempRecycleFrom}
                  onChange={(event) =>
                    setSelection((current) => ({
                      ...current,
                      tempRecycleFrom: event.target.value as 'plan' | 'building',
                    }))
                  }
                >
                  <option value="plan">Plan</option>
                  <option value="building">Building</option>
                </select>
              </label>
            </div>
          )}

          {selection.tempTargetLocationId === 'swap-meet' && (
            <div className="panel__row">
              <label>
                Give
                <select
                  value={selection.tempSwapGiveId}
                  onChange={(event) =>
                    setSelection((current) => ({
                      ...current,
                      tempSwapGiveId: event.target.value as PlanId,
                    }))
                  }
                >
                  <option value="">Select card...</option>
                  {player.plans.map((planId) => (
                    <option key={`plan-${planId}`} value={planId}>
                      Plan: {planLabel(planId)}
                    </option>
                  ))}
                  {player.buildings.map((building) => (
                    <option key={`building-${building.planId}`} value={building.planId}>
                      Building: {planLabel(building.planId)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Take
                <select
                  value={selection.tempSwapTakeId}
                  onChange={(event) =>
                    setSelection((current) => ({
                      ...current,
                      tempSwapTakeId: event.target.value as PlanId,
                    }))
                  }
                >
                  <option value="">Select plan...</option>
                  {state.planSupply
                    .filter((planId) => planId !== selection.tempSwapGiveId)
                    .map((planId) => (
                      <option key={planId} value={planId}>
                        {planLabel(planId)}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          )}
        </div>
      )}

      <div className="panel__row">
        <button type="button" onClick={handlePlace} disabled={!canPlace}>
          Place Mint
        </button>
        <button type="button" onClick={() => dispatch({ type: 'PASS_TURN' })}>
          Pass
        </button>
      </div>
    </section>
  );
}

function buildEffect(selection: SelectionState, locationId: LocationId | null): PlaceEffect | null {
  if (!locationId) return null;

  switch (locationId) {
    case 'supplier':
      if (!selection.supplierPlanId) return null;
      return { kind: 'supplier', planId: selection.supplierPlanId };
    case 'builder':
      if (!selection.builderPlanId) return null;
      return { kind: 'builder', planId: selection.builderPlanId };
    case 'recycler':
      if (!selection.recyclePlanId) return null;
      return {
        kind: 'recycler',
        targetPlanId: selection.recyclePlanId,
        from: selection.recycleFrom,
      };
    case 'swap-meet':
      if (!selection.swapGiveId || !selection.swapTakeId) return null;
      return {
        kind: 'swap-meet',
        givePlanId: selection.swapGiveId,
        takePlanId: selection.swapTakeId,
      };
    case 'temp-agency': {
      if (!selection.tempTargetLocationId) return null;
      const tempEffect = buildTempEffect(selection, selection.tempTargetLocationId);
      if (!tempEffect) return null;
      return {
        kind: 'temp-agency',
        targetLocationId: selection.tempTargetLocationId,
        targetSpaceIndex: 0,
        effect: tempEffect,
      };
    }
    default:
      return { kind: 'none' };
  }
}

function buildTempEffect(
  selection: SelectionState,
  targetLocationId: LocationId,
): NonTempPlaceEffect | null {
  switch (targetLocationId) {
    case 'supplier':
      return selection.tempSupplierPlanId
        ? { kind: 'supplier', planId: selection.tempSupplierPlanId }
        : null;
    case 'builder':
      return selection.tempBuilderPlanId
        ? { kind: 'builder', planId: selection.tempBuilderPlanId }
        : null;
    case 'recycler':
      return selection.tempRecyclePlanId
        ? {
            kind: 'recycler',
            targetPlanId: selection.tempRecyclePlanId,
            from: selection.tempRecycleFrom,
          }
        : null;
    case 'swap-meet':
      return selection.tempSwapGiveId && selection.tempSwapTakeId
        ? {
            kind: 'swap-meet',
            givePlanId: selection.tempSwapGiveId,
            takePlanId: selection.tempSwapTakeId,
          }
        : null;
    default:
      return { kind: 'none' };
  }
}

function hydrateTempEffect(effect: PlaceEffect | null, state: GameState): PlaceEffect | null {
  if (!effect || effect.kind !== 'temp-agency') return effect;
  const target = state.locations.find((loc) => loc.id === effect.targetLocationId);
  const targetSpaceIndex = target?.spaces.findIndex((space) => space.occupiedBy) ?? -1;
  if (targetSpaceIndex < 0) return null;
  return { ...effect, targetSpaceIndex };
}

function getCostForSelection(
  state: GameState,
  player: PlayerState,
  locationId: LocationId,
  selection: SelectionState,
  effect: PlaceEffect | null,
): number | null {
  if (!effect) return null;
  if (effect.kind === 'temp-agency') {
    const planId = effect.effect.kind === 'supplier' ? effect.effect.planId : undefined;
    return getTempAgencyCost(state, player, effect.targetLocationId, planId);
  }
  const planId = effect.kind === 'supplier' ? effect.planId : undefined;
  return getLocationCost(state, player, locationId, planId);
}

function planLabel(planId: PlanId): string {
  const plan = getPlanDefinition(planId);
  return `${plan.name} ($${plan.cost})`;
}
