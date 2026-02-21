import type { GameState, PlayerState } from '../../types/game';
import { getBuildingStars, getPlanDefinition } from '../../logic/plans';

interface PlayerListProps {
  state: GameState;
}

export function PlayerList({ state }: PlayerListProps) {
  return (
    <section className="players">
      <h3>Neighborhoods</h3>
      <div className="players__grid">
        {state.players.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            isCurrent={player.id === currentPlayerId(state)}
            isStarting={player.id === state.startingPlayerId}
          />
        ))}
      </div>
    </section>
  );
}

function PlayerCard({
  player,
  isCurrent,
  isStarting,
}: {
  player: PlayerState;
  isCurrent: boolean;
  isStarting: boolean;
}) {
  return (
    <div className={`player ${isCurrent ? 'player--current' : ''}`}>
      <div className="player__header">
        <h4>{player.name}</h4>
        <span>{player.type === 'ai' ? 'AI' : 'Human'}</span>
      </div>
      {isStarting && <div className="badge">Starting Player</div>}
      <div className="player__meta">Mints: {player.mints}</div>
      <div className="player__meta">Plans (face-down): {player.plans.length}</div>
      <div className="player__section">
        <strong>Buildings</strong>
        {player.buildings.length === 0 && <p className="muted">None yet.</p>}
        {player.buildings.map((building) => {
          const plan = getPlanDefinition(building.planId);
          return (
            <div key={building.planId} className="player__building">
              {plan.name} - Stars: {getBuildingStars(building, player)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function currentPlayerId(state: GameState): string {
  return state.players[state.currentPlayerIndex]?.id ?? '';
}
