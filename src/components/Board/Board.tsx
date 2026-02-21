import type { GameState, LocationCost, LocationId, LocationState } from '../../types/game';
import { getPlanDefinition, getPlanEffect, getPlanStarInfo } from '../../logic/plans';
import type { SelectionState } from '../ActionPanel/selection';

interface BoardProps {
  state: GameState;
  selection: SelectionState;
  selectionEnabled: boolean;
  onSelectSpace: (locationId: LocationId, spaceIndex: number) => void;
}

export function Board({ state, selection, selectionEnabled, onSelectSpace }: BoardProps) {
  const nameMap = new Map<string, string>(state.players.map((player) => [player.id, player.name]));

  return (
    <section className="board">
      <div className="board__section">
        <h3>Plan Supply</h3>
        <div className="plan-supply">
          {state.planSupply.length === 0 && <p>No plans available.</p>}
          {state.planSupply.map((planId) => {
            const plan = getPlanDefinition(planId);
            const starInfo = getPlanStarInfo(planId);
            const starRule = starInfo.hint ?? 'Printed stars.';
            const effect = getPlanEffect(planId);
            return (
              <div key={planId} className="card">
                <div className="card__title">{plan.name}</div>
                <div className="card__meta" title={starInfo.hint ?? undefined}>
                  Cost: {plan.cost} | Stars: {starInfo.label}
                </div>
                <div className="card__hint">Star rule: {starRule}</div>
                <div className="card__hint">Effect: {effect}</div>
                <div className="card__tag">{plan.tag}</div>
              </div>
            );
          })}
        </div>
        <p className="deck-count">Plan Deck: {state.planDeck.length} cards</p>
      </div>

      <div className="board__section">
        <h3>Locations</h3>
        {state.settings?.soloMode && (
          <p className="board__hint">AI evaluates locations in board order (1 is highest).</p>
        )}
        <div className="locations">
          {state.locations.map((location, index) => {
            const ownerName = location.ownerId
              ? (nameMap.get(location.ownerId) ?? location.ownerId)
              : null;
            const isLocked = state.lockedLocations.includes(location.id);
            return (
              <LocationCard
                key={location.id}
                orderIndex={index}
                location={location}
                ownerName={ownerName}
                isLocked={isLocked}
                selection={selection}
                selectionEnabled={selectionEnabled}
                onSelectSpace={onSelectSpace}
                nameMap={nameMap}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function LocationCard({
  orderIndex,
  location,
  ownerName,
  isLocked,
  selection,
  selectionEnabled,
  onSelectSpace,
  nameMap,
}: {
  orderIndex: number;
  location: LocationState;
  ownerName: string | null;
  isLocked: boolean;
  selection: SelectionState;
  selectionEnabled: boolean;
  onSelectSpace: (locationId: LocationId, spaceIndex: number) => void;
  nameMap: Map<string, string>;
}) {
  const effectText = getLocationEffectText(location);
  const deedHint = getDeedHint(location);
  const deedOwnerEffect = getDeedOwnerEffectText(location);
  const isClosed = location.type === 'deed' && !location.isOpen;
  const canSelectLocation = selectionEnabled && !isLocked && !isClosed;

  return (
    <div className={`location location--${location.type} ${isLocked ? 'location--locked' : ''}`}>
      <div className="location__header">
        <h4>{location.name}</h4>
        <div className="location__header-meta">
          <span className="location__order">#{orderIndex + 1}</span>
          {isLocked && <span className="badge">Locked</span>}
          {location.type === 'deed' && !location.isOpen && !isLocked && (
            <span className="badge">Closed</span>
          )}
          {location.type === 'deed' && location.isOpen && (
            <span className="badge">Owner: {ownerName ?? 'None'}</span>
          )}
        </div>
      </div>
      <div className="location__effect">{effectText}</div>
      {deedHint && <div className="location__hint">{deedHint}</div>}
      {deedOwnerEffect && <div className="location__owner">{deedOwnerEffect}</div>}
      <div className="location__spaces">
        {location.spaces.map((space, index) => {
          const occupantName = space.occupiedBy
            ? (nameMap.get(space.occupiedBy) ?? space.occupiedBy)
            : '';
          const costLabel = formatCost(space.cost);
          const isSelected = selection.locationId === location.id && selection.spaceIndex === index;
          const isAvailable = canSelectLocation && !space.occupiedBy;
          const label = `${location.name} space ${index + 1} (${costLabel})${
            space.occupiedBy ? ` occupied by ${occupantName}` : ' available'
          }`;
          const statusLabel = space.occupiedBy ? `Taken by ${occupantName}` : 'Open';

          return (
            <button
              key={`${location.id}-space-${index}`}
              type="button"
              className={`location__space${isSelected ? ' location__space--selected' : ''}${
                space.occupiedBy ? ' location__space--occupied' : ''
              }`}
              onClick={() => onSelectSpace(location.id, index)}
              disabled={!isAvailable}
              aria-label={label}
            >
              <div className="space__row">
                <span className="space__index">Space {index + 1}</span>
                <span className="space__cost-badge">Cost: {costLabel}</span>
              </div>
              <div className="space__row space__row--meta">
                <span className={`space__chip${space.occupiedBy ? ' space__chip--taken' : ''}`}>
                  {statusLabel}
                </span>
                <span className="space__chip">Mints: {space.mints}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatCost(cost: LocationCost): string {
  if (cost.kind === 'fixed') return `${cost.amount} mint(s)`;
  if (cost.kind === 'planCost') return 'Plan cost';
  if (cost.kind === 'tempAgency') return 'Target +1';
  return 'Varies';
}

function getLocationEffectText(location: LocationState): string {
  switch (location.id) {
    case 'producer':
      return 'Gain 2 mints.';
    case 'supplier':
      return 'Gain a plan from the supply (pay its cost).';
    case 'builder':
      return 'Build a plan from your hand.';
    case 'leadership-council':
      return 'Gain 1 mint and become starting player.';
    case 'wholesaler-location':
      return 'Gain 2 mints (deed).';
    case 'lotto-location':
      return 'Draw the top plan from the deck.';
    case 'crowdfunder':
      return 'Gain 3 mints; each other player gains 1.';
    case 'recycler':
      return 'Recycle a plan/building for mints; return it to the bottom of the deck.';
    case 'swap-meet':
      return 'Swap a plan/building with one from the supply.';
    case 'temp-agency':
      return 'Copy an occupied location effect and pay +1 mint.';
    default:
      return 'Resolve the location effect.';
  }
}

function getDeedHint(location: LocationState): string | null {
  if (location.type !== 'deed' || location.isOpen) return null;
  const deedPlan = deedPlanName(location.id);
  return deedPlan ? `Opens when someone builds ${deedPlan}.` : 'Opens when its deed is built.';
}

function getDeedOwnerEffectText(location: LocationState): string | null {
  if (location.type !== 'deed') return null;
  switch (location.id) {
    case 'wholesaler-location':
      return 'Owner upkeep: Gain 1 mint if any mints were placed here this round.';
    case 'lotto-location':
      return 'Owner upkeep: Gain 2 mints if any mints were placed here this round.';
    default:
      return 'Owner upkeep: Gain mints if any mints were placed here this round.';
  }
}

function deedPlanName(locationId: LocationId): string | null {
  switch (locationId) {
    case 'wholesaler-location':
      return 'Wholesaler';
    case 'lotto-location':
      return 'Lotto';
    default:
      return null;
  }
}
