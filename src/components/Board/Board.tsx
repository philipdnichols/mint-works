import type { GameState, LocationState, LocationId, PlanId } from '../../types/game';
import { getPlanDefinition } from '../../logic/plans';

interface BoardProps {
  state: GameState;
}

export function Board({ state }: BoardProps) {
  return (
    <section className="board">
      <div className="board__section">
        <h3>Plan Supply</h3>
        <div className="plan-supply">
          {state.planSupply.length === 0 && <p>No plans available.</p>}
          {state.planSupply.map((planId) => {
            const plan = getPlanDefinition(planId);
            const starInfo = getPlanStarInfo(planId);
            return (
              <div key={planId} className="card">
                <div className="card__title">{plan.name}</div>
                <div className="card__meta" title={starInfo.hint ?? undefined}>
                  Cost: {plan.cost} | Stars: {starInfo.label}
                </div>
                {starInfo.hint && <div className="card__hint">{starInfo.hint}</div>}
                <div className="card__tag">{plan.tag}</div>
              </div>
            );
          })}
        </div>
        <p className="deck-count">Plan Deck: {state.planDeck.length} cards</p>
      </div>

      <div className="board__section">
        <h3>Locations</h3>
        <div className="locations">
          {state.locations.map((location) => (
            <LocationCard key={location.id} location={location} />
          ))}
        </div>
      </div>
    </section>
  );
}

function LocationCard({ location }: { location: LocationState }) {
  const occupied = location.spaces.filter((space) => space.occupiedBy).length;
  const totalMints = location.spaces.reduce((sum, space) => sum + space.mints, 0);
  const effectText = getLocationEffectText(location);
  const deedHint = getDeedHint(location);

  return (
    <div className={`location location--${location.type}`}>
      <div className="location__header">
        <h4>{location.name}</h4>
        {location.type === 'deed' && !location.isOpen && <span className="badge">Closed</span>}
        {location.type === 'deed' && location.isOpen && (
          <span className="badge">Owner: {location.ownerId ?? 'None'}</span>
        )}
      </div>
      <div className="location__meta">
        Spaces: {occupied}/{location.spaces.length}
      </div>
      <div className="location__meta">Mints on location: {totalMints}</div>
      <div className="location__effect">{effectText}</div>
      {deedHint && <div className="location__hint">{deedHint}</div>}
    </div>
  );
}

function getPlanStarInfo(planId: PlanId): { label: string; hint?: string } {
  const plan = getPlanDefinition(planId);
  if (plan.stars !== 'var') {
    return { label: String(plan.stars) };
  }

  switch (planId) {
    case 'vault':
      return { label: 'variable', hint: '2 stars per plan in hand.' };
    case 'museum':
      return {
        label: 'variable',
        hint: 'Stars equal to your culture buildings (Bridge counts twice), minus Landfills.',
      };
    case 'obelisk':
      return { label: 'variable', hint: '1 star per building.' };
    case 'gallery':
      return { label: 'variable', hint: 'Stars equal to mints stored on the Gallery.' };
    default:
      return { label: 'variable' };
  }
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
