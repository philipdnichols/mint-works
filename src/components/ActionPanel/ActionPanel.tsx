import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameAction, NonTempPlaceEffect, PlaceEffect } from '../../state/actions';
import type { GameState, LocationId, LocationState, PlanId, PlayerState } from '../../types/game';
import { getAiProfile } from '../../logic/ai';
import { getPlanDefinition } from '../../logic/plans';
import { getLocationCost, getTempAgencyCost, getTempAgencyTargets } from '../../logic/game';
import { RACHAEL_MINT_SUPPLY } from '../../logic/setup';
import type { SelectionState } from './selection';
import { initialSelection } from './selection';

interface ActionPanelProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  selection: SelectionState;
  setSelection: Dispatch<SetStateAction<SelectionState>>;
  interactionDisabled: boolean;
  suspendMintSupplyAnimation: boolean;
}

export function ActionPanel({
  state,
  dispatch,
  selection,
  setSelection,
  interactionDisabled,
  suspendMintSupplyAnimation,
}: ActionPanelProps) {
  const player = state.players[state.currentPlayerIndex];
  const isRachaelSupply =
    state.settings?.soloMode &&
    state.settings.aiOpponent === 'rachael' &&
    state.mintSupply !== 'unlimited';
  const mintSupplyValue = typeof state.mintSupply === 'number' ? state.mintSupply : 0;
  const mintSupplyPercent = isRachaelSupply
    ? Math.max(0, Math.min(100, (mintSupplyValue / RACHAEL_MINT_SUPPLY) * 100))
    : 0;
  const [mintSupplyRefill, setMintSupplyRefill] = useState(false);
  const [mintSupplyDelta, setMintSupplyDelta] = useState<number | null>(null);
  const mintSupplyRef = useRef(state.mintSupply);
  const pendingDeltaRef = useRef(0);
  const refillTimerRef = useRef<number | null>(null);
  const deltaTimerRef = useRef<number | null>(null);

  const triggerMintSupplyAnimation = useCallback((delta: number) => {
    if (delta === 0) return;
    setMintSupplyDelta(delta);
    if (deltaTimerRef.current !== null) {
      window.clearTimeout(deltaTimerRef.current);
    }
    deltaTimerRef.current = window.setTimeout(() => {
      setMintSupplyDelta(null);
    }, 1200);

    if (delta > 0) {
      setMintSupplyRefill(true);
      if (refillTimerRef.current !== null) {
        window.clearTimeout(refillTimerRef.current);
      }
      refillTimerRef.current = window.setTimeout(() => {
        setMintSupplyRefill(false);
      }, 1200);
    }
  }, []);

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

  const tempAgencyTargets = useMemo(() => getTempAgencyTargets(state), [state]);

  useEffect(() => {
    if (!isRachaelSupply) {
      mintSupplyRef.current = state.mintSupply;
      pendingDeltaRef.current = 0;
      setMintSupplyRefill(false);
      setMintSupplyDelta(null);
      return;
    }

    if (!suspendMintSupplyAnimation && pendingDeltaRef.current !== 0) {
      const queuedDelta = pendingDeltaRef.current;
      pendingDeltaRef.current = 0;
      triggerMintSupplyAnimation(queuedDelta);
    }

    const previous = mintSupplyRef.current;
    if (typeof previous !== 'number') {
      mintSupplyRef.current = state.mintSupply;
      return;
    }

    const delta = mintSupplyValue - previous;
    if (delta === 0) {
      mintSupplyRef.current = state.mintSupply;
      return;
    }

    if (suspendMintSupplyAnimation) {
      pendingDeltaRef.current += delta;
    } else {
      triggerMintSupplyAnimation(delta);
    }

    mintSupplyRef.current = state.mintSupply;
  }, [
    isRachaelSupply,
    mintSupplyValue,
    state.mintSupply,
    suspendMintSupplyAnimation,
    triggerMintSupplyAnimation,
  ]);

  useEffect(() => {
    return () => {
      if (refillTimerRef.current !== null) {
        window.clearTimeout(refillTimerRef.current);
      }
      if (deltaTimerRef.current !== null) {
        window.clearTimeout(deltaTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!selection.locationId) return;
    const location = state.locations.find((loc) => loc.id === selection.locationId);
    if (!location) {
      setSelection(initialSelection);
      return;
    }
    if (!availableLocations.some((loc) => loc.id === selection.locationId)) {
      setSelection(initialSelection);
      return;
    }
    if (selection.spaceIndex === null) return;
    const selectedSpace = location.spaces[selection.spaceIndex];
    if (!selectedSpace || selectedSpace.occupiedBy) {
      setSelection(initialSelection);
    }
  }, [
    availableLocations,
    selection.locationId,
    selection.spaceIndex,
    setSelection,
    state.locations,
  ]);

  useEffect(() => {
    if (!selection.tempTargetLocationId) return;
    if (tempAgencyTargets.some((loc) => loc.id === selection.tempTargetLocationId)) return;
    setSelection((current) => ({
      ...current,
      tempTargetLocationId: '',
      tempSupplierPlanId: '',
      tempBuilderPlanId: '',
      tempRecyclePlanId: '',
      tempRecycleFrom: 'plan',
      tempSwapGiveId: '',
      tempSwapTakeId: '',
    }));
  }, [selection.tempTargetLocationId, setSelection, tempAgencyTargets]);

  useEffect(() => {
    setSelection(initialSelection);
  }, [setSelection, state.currentPlayerIndex, state.phase]);

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
              disabled={interactionDisabled}
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
    const profile = getAiProfile(player.aiId);
    const supplierPriority = profile
      ? `${profile.costPriority === 'high' ? 'Highest' : 'Lowest'} cost, then ${profile.typePriority.join(
          ' > ',
        )}, then closest to deck.`
      : null;
    return (
      <section className="panel">
        <div className="panel__header">
          <h3>{player.name} (AI)</h3>
          {isRachaelSupply && (
            <div
              className={`mint-supply${mintSupplyRefill ? ' mint-supply--refill' : ''}`}
              aria-live="polite"
            >
              <div className="mint-supply__label">Mint Supply</div>
              <div className="mint-supply__meter" aria-hidden="true">
                <div className="mint-supply__fill" style={{ width: `${mintSupplyPercent}%` }} />
              </div>
              {mintSupplyDelta !== null && (
                <div
                  className={`mint-supply__delta ${
                    mintSupplyDelta > 0
                      ? 'mint-supply__delta--positive'
                      : 'mint-supply__delta--negative'
                  }`}
                >
                  {mintSupplyDelta > 0 ? `+${mintSupplyDelta}` : mintSupplyDelta}
                </div>
              )}
              <div className="mint-supply__count">
                {state.mintSupply} / {RACHAEL_MINT_SUPPLY}
              </div>
            </div>
          )}
        </div>
        {profile && (
          <div className="panel__ai">
            <div className="panel__ai-title">{profile.title}</div>
            <div className="panel__ai-meta">Starting mints: {profile.startingMints}</div>
            <div className="panel__ai-meta">Supplier priority: {supplierPriority}</div>
            <div className="panel__ai-meta">Behavior:</div>
            <ul className="panel__ai-list">
              {profile.traits.map((trait) => (
                <li key={trait}>{trait}</li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          onClick={() => dispatch({ type: 'RUN_AI_TURN' })}
          disabled={interactionDisabled}
        >
          Run AI Turn
        </button>
      </section>
    );
  }

  const selectedLocation = state.locations.find((loc) => loc.id === selection.locationId);
  const selectedSpaceIndex = selection.spaceIndex ?? -1;
  const selectedSpace =
    selectedLocation && selectedSpaceIndex >= 0
      ? selectedLocation.spaces[selectedSpaceIndex]
      : null;
  const selectedSpaceOpen = Boolean(selectedSpace && !selectedSpace.occupiedBy);

  const rawEffect = buildEffect(selection, selectedLocation?.id ?? null);
  const effect = hydrateTempEffect(rawEffect, state);

  const cost = selectedLocation
    ? getCostForSelection(state, player, selectedLocation.id, effect)
    : null;
  const canPlace = Boolean(
    selectedLocation &&
    selectedSpaceOpen &&
    effect &&
    cost !== null &&
    selectedSpaceIndex >= 0 &&
    cost <= player.mints,
  );
  const placeHint = getPlaceHint(
    state,
    player,
    selection,
    selectedLocation,
    selectedSpaceIndex,
    selectedSpaceOpen,
    effect,
    cost,
  );

  const handlePlace = () => {
    if (!selectedLocation || selectedSpaceIndex < 0 || !effect || !selectedSpaceOpen) return;
    dispatch({
      type: 'PLACE_ON_LOCATION',
      payload: {
        locationId: selectedLocation.id,
        spaceIndex: selectedSpaceIndex,
        effect,
      },
    });
  };

  return (
    <section className="panel">
      <div className="panel__header">
        <h3>{player.name}'s Turn</h3>
        {isRachaelSupply && (
          <div
            className={`mint-supply${mintSupplyRefill ? ' mint-supply--refill' : ''}`}
            aria-live="polite"
          >
            <div className="mint-supply__label">Mint Supply</div>
            <div className="mint-supply__meter" aria-hidden="true">
              <div className="mint-supply__fill" style={{ width: `${mintSupplyPercent}%` }} />
            </div>
            {mintSupplyDelta !== null && (
              <div
                className={`mint-supply__delta ${
                  mintSupplyDelta > 0
                    ? 'mint-supply__delta--positive'
                    : 'mint-supply__delta--negative'
                }`}
              >
                {mintSupplyDelta > 0 ? `+${mintSupplyDelta}` : mintSupplyDelta}
              </div>
            )}
            <div className="mint-supply__count">
              {state.mintSupply} / {RACHAEL_MINT_SUPPLY}
            </div>
          </div>
        )}
      </div>
      {interactionDisabled && (
        <div className="panel__hint panel__hint--warning">
          Recap open. Close it to continue your turn.
        </div>
      )}
      <div className="panel__row panel__row--between">
        <div className="panel__selection">
          <span className="panel__label">Selected spot</span>
          <span className="panel__value">
            {selectedLocation && selectedSpaceIndex >= 0
              ? `${selectedLocation.name} (space ${selectedSpaceIndex + 1})`
              : 'None'}
          </span>
        </div>
        {selectedLocation && (
          <button
            type="button"
            className="panel__ghost"
            disabled={interactionDisabled}
            onClick={() => setSelection(initialSelection)}
          >
            Clear
          </button>
        )}
      </div>
      {selectedLocation && selectedSpaceIndex >= 0 && cost !== null && (
        <div className="panel__row">
          <span className="panel__cost">Cost: {cost} mint(s)</span>
        </div>
      )}
      {!selectedLocation && (
        <p className="panel__note">Click a location space on the board to choose a spot.</p>
      )}

      {selectedLocation?.id === 'supplier' && (
        <label className="panel__row">
          Plan to gain
          <select
            value={selection.supplierPlanId}
            disabled={interactionDisabled}
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
            disabled={interactionDisabled}
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
              disabled={interactionDisabled}
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
              disabled={interactionDisabled}
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
              disabled={interactionDisabled}
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
              disabled={interactionDisabled}
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
              disabled={interactionDisabled}
              onChange={(event) =>
                setSelection((current) => ({
                  ...current,
                  tempTargetLocationId: event.target.value as LocationId,
                }))
              }
            >
              <option value="">Select target...</option>
              {tempAgencyTargets.map((loc) => (
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
                disabled={interactionDisabled}
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
                disabled={interactionDisabled}
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
                  disabled={interactionDisabled}
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
                  disabled={interactionDisabled}
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
                  disabled={interactionDisabled}
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
                  disabled={interactionDisabled}
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

      {placeHint && (
        <div
          className={`panel__hint${placeHint.tone === 'warning' ? ' panel__hint--warning' : ''}`}
        >
          {placeHint.text}
        </div>
      )}

      <div className="panel__row">
        <button type="button" onClick={handlePlace} disabled={interactionDisabled || !canPlace}>
          Place Mint
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'PASS_TURN' })}
          disabled={interactionDisabled}
        >
          Pass
        </button>
      </div>
      <p className="panel__note">
        Passing does not end the phase. You can still act later if the turn comes back to you.
      </p>
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
  if (state.lockedLocations.includes(effect.targetLocationId)) return null;
  const target = state.locations.find((loc) => loc.id === effect.targetLocationId);
  const targetSpaceIndex = target?.spaces.findIndex((space) => space.occupiedBy) ?? -1;
  if (targetSpaceIndex < 0) return null;
  return { ...effect, targetSpaceIndex };
}

function getCostForSelection(
  state: GameState,
  player: PlayerState,
  locationId: LocationId,
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

type PlaceHint = { text: string; tone?: 'warning' };

function getPlaceHint(
  state: GameState,
  player: PlayerState,
  selection: SelectionState,
  selectedLocation: LocationState | undefined,
  selectedSpaceIndex: number,
  selectedSpaceOpen: boolean,
  effect: PlaceEffect | null,
  cost: number | null,
): PlaceHint | null {
  if (!selectedLocation) {
    return { text: 'Choose a location space to place a mint.' };
  }
  if (selectedSpaceIndex < 0) {
    return { text: 'Choose a specific space on this location.' };
  }
  if (!selectedSpaceOpen) {
    return { text: 'That space is already occupied.', tone: 'warning' };
  }

  if (!effect) {
    switch (selectedLocation.id) {
      case 'supplier':
        return state.planSupply.length === 0
          ? { text: 'The plan supply is empty.' }
          : { text: 'Choose a plan to gain.' };
      case 'builder':
        return player.plans.length === 0
          ? { text: 'You have no plans in hand to build.' }
          : { text: 'Choose a plan to build.' };
      case 'recycler':
        return player.plans.length === 0 && player.buildings.length === 0
          ? { text: 'You have no cards to recycle.' }
          : { text: 'Choose a card to recycle.' };
      case 'swap-meet':
        if (player.plans.length === 0 && player.buildings.length === 0) {
          return { text: 'You have no cards to give.' };
        }
        return state.planSupply.length === 0
          ? { text: 'The plan supply is empty.' }
          : { text: 'Choose a card to give and a plan to take.' };
      case 'temp-agency': {
        const occupiedTargets = getTempAgencyTargets(state);
        if (occupiedTargets.length === 0) {
          return { text: 'No occupied locations to target.' };
        }
        if (!selection.tempTargetLocationId) {
          return { text: 'Choose a target occupied location.' };
        }
        if (state.lockedLocations.includes(selection.tempTargetLocationId)) {
          return { text: 'That target location is locked.', tone: 'warning' };
        }
        return { text: 'Choose a plan/card for the copied effect.' };
      }
      default:
        return { text: 'Select any required options to place a mint.' };
    }
  }

  if (cost === null) {
    return { text: 'Cost unavailable for this action.', tone: 'warning' };
  }
  if (cost > player.mints) {
    return {
      text: `Not enough mints. Need ${cost}, you have ${player.mints}.`,
      tone: 'warning',
    };
  }

  return null;
}
