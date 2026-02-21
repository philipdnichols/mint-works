import type { GameState, LocationState } from '../../types/game';
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
            return (
              <div key={planId} className="card">
                <div className="card__title">{plan.name}</div>
                <div className="card__meta">
                  Cost: {plan.cost} | Stars: {plan.stars}
                </div>
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
    </div>
  );
}
