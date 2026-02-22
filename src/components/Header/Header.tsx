import { memo, useEffect, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { GameAction } from '../../state/actions';
import type { GameState } from '../../types/game';
import type { ThemeMode } from '../../types/theme';
import { RACHAEL_MINT_SUPPLY } from '../../logic/setup';

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
  const isRachaelSupply =
    state.settings?.soloMode &&
    state.settings.aiOpponent === 'rachael' &&
    state.mintSupply !== 'unlimited';
  const mintSupplyValue = typeof state.mintSupply === 'number' ? state.mintSupply : 0;
  const mintSupplyPercent = isRachaelSupply
    ? Math.max(0, Math.min(100, (mintSupplyValue / RACHAEL_MINT_SUPPLY) * 100))
    : 0;
  const [mintSupplyRefill, setMintSupplyRefill] = useState(false);
  const mintSupplyRef = useRef(state.mintSupply);
  const refillTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRachaelSupply) {
      mintSupplyRef.current = state.mintSupply;
      setMintSupplyRefill(false);
      return;
    }

    const previous = mintSupplyRef.current;
    if (typeof previous === 'number' && mintSupplyValue > previous) {
      setMintSupplyRefill(true);
      if (refillTimerRef.current !== null) {
        window.clearTimeout(refillTimerRef.current);
      }
      refillTimerRef.current = window.setTimeout(() => {
        setMintSupplyRefill(false);
      }, 1200);
    }

    mintSupplyRef.current = state.mintSupply;
  }, [isRachaelSupply, mintSupplyValue, state.mintSupply]);

  useEffect(() => {
    return () => {
      if (refillTimerRef.current !== null) {
        window.clearTimeout(refillTimerRef.current);
      }
    };
  }, []);

  return (
    <header className="header">
      <div className="header__title">Mint Works!</div>
      <div className="header__meta">Round: {state.round}</div>
      <div className="header__meta">Phase: {phaseLabel}</div>
      <div className="header__meta">Time: {state.elapsedSeconds}s</div>
      {currentPlayer && <div className="header__meta">Turn: {currentPlayer.name}</div>}
      {isRachaelSupply && (
        <div
          className={`header__mint-supply${mintSupplyRefill ? ' header__mint-supply--refill' : ''}`}
        >
          <div className="header__mint-label">Mint Supply</div>
          <div className="header__mint-meter" aria-hidden="true">
            <div className="header__mint-fill" style={{ width: `${mintSupplyPercent}%` }} />
          </div>
          <div className="header__mint-count" role="status" aria-live="polite">
            {state.mintSupply} / {RACHAEL_MINT_SUPPLY}
          </div>
        </div>
      )}
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
