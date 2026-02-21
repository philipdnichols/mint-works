import type { GameState } from '../../types/game';
import { getPlayerTotalStars } from '../../logic/plans';

interface NeighborhoodSummaryProps {
  state: GameState;
}

export function NeighborhoodSummary({ state }: NeighborhoodSummaryProps) {
  const currentPlayerId = state.players[state.currentPlayerIndex]?.id ?? '';

  return (
    <section className="panel neighborhoods">
      <div className="panel__row panel__row--between">
        <h3>Neighborhoods</h3>
        <a className="link-button" href="#neighborhoods">
          Details
        </a>
      </div>
      <div className="neighborhoods__list">
        {state.players.map((player) => {
          const isCurrent = player.id === currentPlayerId;
          const isStarting = player.id === state.startingPlayerId;
          return (
            <div
              key={player.id}
              className={`neighborhoods__row${isCurrent ? ' neighborhoods__row--current' : ''}`}
            >
              <div className="neighborhoods__name">
                <span>{player.name}</span>
                {player.type === 'ai' && <span className="neighborhoods__badge">AI</span>}
                {isStarting && <span className="neighborhoods__badge">Start</span>}
              </div>
              <div className="neighborhoods__stats">
                Stars: {getPlayerTotalStars(player)} · Mints: {player.mints} · Buildings:{' '}
                {player.buildings.length} · Plans: {player.plans.length}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
