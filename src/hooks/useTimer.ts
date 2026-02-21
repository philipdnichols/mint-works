import { useEffect } from 'react';
import type { Dispatch } from 'react';
import type { GameAction } from '../state/actions';
import type { GameStatus } from '../types/game';

export function useTimer(status: GameStatus, dispatch: Dispatch<GameAction>): void {
  useEffect(() => {
    if (status !== 'playing') return;
    const id = setInterval(() => {
      dispatch({ type: 'TICK' });
    }, 1000);
    return () => clearInterval(id);
  }, [status, dispatch]);
}
