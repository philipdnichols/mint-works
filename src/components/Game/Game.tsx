import { memo } from 'react';
import type { Dispatch } from 'react';
import type { GameAction } from '../../state/actions';
import type { GameState } from '../../types/game';
import { Header } from '../Header/Header';
import { Setup } from '../Setup/Setup';
import { Board } from '../Board/Board';
import { PlayerList } from '../PlayerList/PlayerList';
import { ActionPanel } from '../ActionPanel/ActionPanel';

interface GameProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

export const Game = memo(function Game({ state, dispatch }: GameProps) {
  return (
    <div className="app">
      <Header state={state} dispatch={dispatch} />
      <main className="game">
        {state.status === 'idle' && <Setup dispatch={dispatch} />}

        {state.status !== 'idle' && (
          <>
            {state.lastError && <div className="alert">{state.lastError}</div>}
            <div className="layout">
              <Board state={state} />
              <ActionPanel state={state} dispatch={dispatch} />
            </div>
            <PlayerList state={state} />
          </>
        )}

        {state.status !== 'idle' && state.results && (
          <section className="results">
            <h3>Results</h3>
            <ul>
              {state.results.scores.map((score) => (
                <li key={score.playerId}>
                  {playerName(state, score.playerId)}: {score.stars} stars
                </li>
              ))}
            </ul>
            <p>
              Winner(s): {state.results.winnerIds.map((id) => playerName(state, id)).join(', ')}
            </p>
          </section>
        )}
      </main>
    </div>
  );
});

function playerName(state: GameState, playerId: string): string {
  return state.players.find((player) => player.id === playerId)?.name ?? playerId;
}
