import { memo, useEffect, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { GameAction } from '../../state/actions';
import type { GameLogEntry, GameResults, GameState, LocationId, PlayerId } from '../../types/game';
import { Header } from '../Header/Header';
import { Setup } from '../Setup/Setup';
import { Board } from '../Board/Board';
import { PlayerList } from '../PlayerList/PlayerList';
import { ActionPanel } from '../ActionPanel/ActionPanel';
import { GameLog } from '../GameLog/GameLog';
import { NeighborhoodSummary } from '../NeighborhoodSummary/NeighborhoodSummary';
import { initialSelection } from '../ActionPanel/selection';
import { AiTurnModal } from '../AiTurnModal/AiTurnModal';

interface GameProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

export const Game = memo(function Game({ state, dispatch }: GameProps) {
  const [selection, setSelection] = useState(initialSelection);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalEntries, setAiModalEntries] = useState<ReadonlyArray<GameLogEntry>>([]);
  const [aiModalTitle, setAiModalTitle] = useState('AI Turn');
  const lastLogLengthRef = useRef(state.log.length);
  const lastPlayerIdRef = useRef<PlayerId | null>(
    state.players[state.currentPlayerIndex]?.id ?? null,
  );

  useEffect(() => {
    if (state.status === 'idle') {
      setSelection(initialSelection);
      setAiModalOpen(false);
    }
  }, [state.status]);

  useEffect(() => {
    const previousLogLength = lastLogLengthRef.current;
    if (state.log.length < previousLogLength) {
      lastLogLengthRef.current = state.log.length;
      lastPlayerIdRef.current = state.players[state.currentPlayerIndex]?.id ?? null;
      setAiModalOpen(false);
      return;
    }

    if (state.log.length > previousLogLength) {
      const newEntries = state.log.slice(previousLogLength);
      if (newEntries.some((entry) => entry.kind === 'ai')) {
        const previousPlayerId = lastPlayerIdRef.current;
        const previousPlayerName = previousPlayerId
          ? state.players.find((player) => player.id === previousPlayerId)?.name
          : null;
        setAiModalEntries(newEntries);
        setAiModalTitle(previousPlayerName ? `${previousPlayerName}'s Turn` : 'AI Turn');
        setAiModalOpen(true);
      }
    }

    lastLogLengthRef.current = state.log.length;
    lastPlayerIdRef.current = state.players[state.currentPlayerIndex]?.id ?? null;
  }, [state.currentPlayerIndex, state.log, state.players]);

  const selectionEnabled =
    state.status === 'playing' &&
    state.phase === 'development' &&
    state.pendingChoice === null &&
    state.players[state.currentPlayerIndex]?.type === 'human' &&
    !aiModalOpen;

  const handleSelectSpace = (locationId: LocationId, spaceIndex: number) => {
    setSelection({ ...initialSelection, locationId, spaceIndex });
  };

  return (
    <div className="app">
      <Header state={state} dispatch={dispatch} />
      <main className="game">
        {state.status === 'idle' && <Setup dispatch={dispatch} />}

        {state.status !== 'idle' && (
          <>
            {state.lastError && <div className="alert">{state.lastError}</div>}
            <div className="layout">
              <Board
                state={state}
                selection={selection}
                selectionEnabled={selectionEnabled}
                onSelectSpace={handleSelectSpace}
              />
              <div className="sidebar">
                <ActionPanel
                  state={state}
                  dispatch={dispatch}
                  selection={selection}
                  setSelection={setSelection}
                  interactionDisabled={aiModalOpen}
                />
                <NeighborhoodSummary state={state} />
                <GameLog log={state.log} />
              </div>
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
            <p>Tiebreaker: {formatTiebreaker(state.results.tiebreaker)}</p>
          </section>
        )}
      </main>
      <AiTurnModal
        entries={aiModalEntries}
        open={aiModalOpen}
        title={aiModalTitle}
        onClose={() => setAiModalOpen(false)}
      />
    </div>
  );
});

function playerName(state: GameState, playerId: string): string {
  return state.players.find((player) => player.id === playerId)?.name ?? playerId;
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
