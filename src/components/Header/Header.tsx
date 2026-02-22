import { memo } from 'react';
import type { Dispatch } from 'react';
import type { GameAction } from '../../state/actions';
import type { GameState } from '../../types/game';
import type { ThemeMode } from '../../types/theme';

interface HeaderProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export const Header = memo(function Header({ state, dispatch, theme, onToggleTheme }: HeaderProps) {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const phaseLabel = state.status === 'idle' ? 'Setup' : formatPhase(state.phase);
  const themeLabel = theme === 'dark' ? 'Light Mode' : 'Dark Mode';

  return (
    <header className="header">
      <div className="header__title">Mint Works!</div>
      <div className="header__meta">Round: {state.round}</div>
      <div className="header__meta">Phase: {phaseLabel}</div>
      <div className="header__meta">Time: {state.elapsedSeconds}s</div>
      {currentPlayer && <div className="header__meta">Turn: {currentPlayer.name}</div>}
      <div className="header__actions">
        <button
          type="button"
          className="header__button header__button--ghost"
          aria-pressed={theme === 'dark'}
          onClick={onToggleTheme}
        >
          {themeLabel}
        </button>
        <button
          type="button"
          className="header__button"
          onClick={() => dispatch({ type: 'NEW_GAME' })}
        >
          New Game
        </button>
      </div>
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
