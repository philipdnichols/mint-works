import { useEffect, useReducer } from 'react';
import type { Dispatch } from 'react';
import { gameReducer, makeInitialState } from './state/reducer';
import type { GameAction } from './state/actions';
import type { GameState } from './types/game';
import { useTimer } from './hooks/useTimer';
import { useTheme } from './hooks/useTheme';
import { Game } from './components/Game/Game';

type DevWindow = Window & { __gameState?: GameState; __dispatch?: Dispatch<GameAction> };

function App() {
  const [state, dispatch] = useReducer(gameReducer, makeInitialState());
  useTimer(state.status, dispatch);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as DevWindow).__gameState = state;
      (window as DevWindow).__dispatch = dispatch;
    }
  });

  return <Game state={state} dispatch={dispatch} theme={theme} onToggleTheme={toggleTheme} />;
}

export default App;
