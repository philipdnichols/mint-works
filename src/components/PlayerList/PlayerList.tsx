import { useState } from 'react';
import type { GameState, PlanId, PlayerState } from '../../types/game';
import {
  getBuildingStarBreakdown,
  getBuildingStars,
  getPlanDefinition,
  getPlanEffect,
  getPlanStarInfo,
  getPlayerTotalStars,
} from '../../logic/plans';
import { getAiProfile } from '../../logic/ai';

interface PlayerListProps {
  state: GameState;
}

export function PlayerList({ state }: PlayerListProps) {
  return (
    <section className="players" id="neighborhoods">
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
  const [showPlans, setShowPlans] = useState(false);
  const [expandedBuildings, setExpandedBuildings] = useState<PlanId[]>([]);
  const aiProfile = player.type === 'ai' ? getAiProfile(player.aiId) : null;

  const toggleBuilding = (planId: PlanId) => {
    setExpandedBuildings((current) =>
      current.includes(planId) ? current.filter((id) => id !== planId) : [...current, planId],
    );
  };

  return (
    <div className={`player ${isCurrent ? 'player--current' : ''}`}>
      <div className="player__header">
        <h4>{player.name}</h4>
        <span>{player.type === 'ai' ? 'AI' : 'Human'}</span>
      </div>
      {isStarting && <div className="badge">Starting Player</div>}
      {aiProfile && (
        <div className="player__ai">
          <div className="player__ai-title">{aiProfile.title}</div>
          <div className="player__ai-meta">
            Supplier priority: {aiProfile.costPriority === 'high' ? 'Highest' : 'Lowest'} cost, then{' '}
            {aiProfile.typePriority.join(' > ')}.
          </div>
          <div className="player__ai-meta">Behavior:</div>
          <ul className="player__ai-list">
            {aiProfile.traits.map((trait) => (
              <li key={trait}>{trait}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="player__meta">Mints: {player.mints}</div>
      <div className="player__meta">Stars: {getPlayerTotalStars(player)}</div>
      <div className="player__meta player__meta--row">
        <span>Plans (face-down): {player.plans.length}</span>
        {player.plans.length > 0 && (
          <button
            type="button"
            className="link-button"
            onClick={() => setShowPlans((current) => !current)}
          >
            {showPlans ? 'Hide plans' : 'Show plans'}
          </button>
        )}
      </div>
      {showPlans && (
        <div className="player__plans">
          {player.plans.map((planId) => (
            <PlanDetailCard key={planId} planId={planId} />
          ))}
        </div>
      )}
      <div className="player__section">
        <strong>Buildings</strong>
        {player.buildings.length === 0 && <p className="muted">None yet.</p>}
        {player.buildings.map((building) => {
          const plan = getPlanDefinition(building.planId);
          const isExpanded = expandedBuildings.includes(building.planId);
          const breakdown = getBuildingStarBreakdown(building, player);
          return (
            <div key={building.planId} className="player__building-wrapper">
              <button
                type="button"
                className="player__building"
                onClick={() => toggleBuilding(building.planId)}
              >
                <span>{plan.name}</span>
                <span>Stars: {getBuildingStars(building, player)}</span>
                <span className="player__toggle">{isExpanded ? 'Hide' : 'Details'}</span>
              </button>
              {isExpanded && (
                <div className="player__building-detail">
                  <div className="player__detail-row">
                    Cost: {plan.cost} | Tag: {plan.tag}
                  </div>
                  {building.storedMints > 0 && (
                    <div className="player__detail-row">Stored mints: {building.storedMints}</div>
                  )}
                  <div className="player__detail-row">Effect: {getPlanEffect(building.planId)}</div>
                  <div className="player__detail-row">Stars now: {breakdown.total}</div>
                  <div className="player__detail-row">
                    Base: {breakdown.base} ({breakdown.baseLabel})
                  </div>
                  {breakdown.isCulture && breakdown.landfillCount > 0 && (
                    <div className="player__detail-row">
                      Landfill penalty: -{breakdown.landfillPenalty} ({breakdown.landfillCount}{' '}
                      landfill{breakdown.landfillCount === 1 ? '' : 's'})
                    </div>
                  )}
                  {breakdown.isCulture && breakdown.landfillCount === 0 && (
                    <div className="player__detail-row">Landfill penalty: none</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlanDetailCard({ planId }: { planId: PlanId }) {
  const plan = getPlanDefinition(planId);
  const starInfo = getPlanStarInfo(planId);
  return (
    <div className="card card--compact">
      <div className="card__title">{plan.name}</div>
      <div className="card__meta" title={starInfo.hint ?? undefined}>
        Cost: {plan.cost} | Stars: {starInfo.label}
      </div>
      {starInfo.hint && <div className="card__hint">{starInfo.hint}</div>}
      <div className="card__tag">{plan.tag}</div>
      <div className="card__hint">Effect: {getPlanEffect(planId)}</div>
    </div>
  );
}

function currentPlayerId(state: GameState): string {
  return state.players[state.currentPlayerIndex]?.id ?? '';
}
