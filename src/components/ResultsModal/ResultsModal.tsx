import { useEffect } from 'react';
import type { GameResults, GameState, PlayerId } from '../../types/game';

interface ResultsModalProps {
  open: boolean;
  results: GameResults | null;
  players: GameState['players'];
  soloMode: boolean;
  status: GameState['status'];
  onClose: () => void;
  onNewGame: () => void;
}

export function ResultsModal({
  open,
  results,
  players,
  soloMode,
  status,
  onClose,
  onNewGame,
}: ResultsModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, open]);

  if (!open || !results) return null;

  const winnerNames = results.winnerIds.map((id) => playerName(players, id)).join(', ');
  const sortedScores = [...results.scores].sort((a, b) => b.stars - a.stars);
  const subtitle = buildSubtitle({ soloMode, status });

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal results-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Game results"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            <h3 className="modal__title">Game Over</h3>
            <p className="modal__subtitle">{subtitle}</p>
          </div>
          <button type="button" className="modal__close" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="modal__body">
          <div className="results-modal__summary">
            <div className="results-modal__card">
              <div className="results-modal__label">
                Winner{results.winnerIds.length === 1 ? '' : 's'}
              </div>
              <div className="results-modal__value">{winnerNames}</div>
            </div>
            <div className="results-modal__card">
              <div className="results-modal__label">Tiebreaker</div>
              <div className="results-modal__value">{formatTiebreaker(results.tiebreaker)}</div>
            </div>
          </div>
          <div className="results-modal__scores">
            <div className="results-modal__label">Final stars</div>
            <ul className="results-modal__list">
              {sortedScores.map((score) => {
                const isWinner = results.winnerIds.includes(score.playerId);
                return (
                  <li
                    key={score.playerId}
                    className={`results-modal__row${isWinner ? ' results-modal__row--winner' : ''}`}
                  >
                    <span className="results-modal__name">
                      {playerName(players, score.playerId)}
                    </span>
                    <span className="results-modal__stars">{score.stars} stars</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <footer className="modal__footer">
          <button
            type="button"
            className="modal__button modal__button--secondary"
            onClick={onNewGame}
          >
            New game
          </button>
          <button type="button" className="modal__button" onClick={onClose}>
            Continue
          </button>
        </footer>
      </section>
    </div>
  );
}

function playerName(players: GameState['players'], playerId: PlayerId): string {
  return players.find((player) => player.id === playerId)?.name ?? playerId;
}

function formatTiebreaker(tiebreaker: GameResults['tiebreaker']): string {
  switch (tiebreaker) {
    case 'stars':
      return 'Most stars';
    case 'neighborhood':
      return 'Smallest neighborhood';
    case 'mints':
      return 'Most mints';
    case 'age':
      return 'Age closest to 42';
    case 'tie':
      return 'Still tied';
    default:
      return 'Unknown';
  }
}

function buildSubtitle({ soloMode, status }: { soloMode: boolean; status: GameState['status'] }) {
  if (!soloMode) return 'Final scores are in.';
  if (status === 'won') return 'You won the solo challenge.';
  return 'The AI won the solo challenge.';
}
