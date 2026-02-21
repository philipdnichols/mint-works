import { memo } from 'react';
import type { Dispatch } from 'react';
import type { GameAction } from '../../state/actions';
import type { GameState } from '../../types/game';

interface HeaderProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

export const Header = memo(function Header({ state, dispatch }: HeaderProps) {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const phaseLabel = state.status === 'idle' ? 'Setup' : formatPhase(state.phase);
  return (
    <header className="header">
      <div className="header__title">Mint Works!</div>
      <div className="header__meta">Round: {state.round}</div>
      <div className="header__meta">Phase: {phaseLabel}</div>
      <div className="header__meta">Time: {state.elapsedSeconds}s</div>
      {currentPlayer && <div className="header__meta">Turn: {currentPlayer.name}</div>}
      {state.mintSupply !== 'unlimited' && (
        <div className="header__meta">Mint Supply: {state.mintSupply}</div>
      )}
      <button
        type="button"
        className="header__button"
        onClick={() => dispatch({ type: 'NEW_GAME' })}
      >
        New Game
      </button>
    </header>
  );
});

function formatPhase(phase: GameState['phase']): string {
  switch (phase) {
    case 'development':
      return 'Development';
    case 'upkeep':
      return 'Upkeep';
    case 'scoring':
      return 'Scoring';
    default:
      return phase;
  }
}
