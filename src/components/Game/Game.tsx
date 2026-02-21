import { memo, useEffect, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { GameAction } from '../../state/actions';
import type { GameLogEntry, GameResults, GameState, LocationId, PlayerId } from '../../types/game';
import type { ThemeMode } from '../../types/theme';
import { getPlayerTotalStars } from '../../logic/plans';
import { Header } from '../Header/Header';
import { Setup } from '../Setup/Setup';
import { Board } from '../Board/Board';
import { PlayerList } from '../PlayerList/PlayerList';
import { ActionPanel } from '../ActionPanel/ActionPanel';
import { GameLog } from '../GameLog/GameLog';
import { NeighborhoodSummary } from '../NeighborhoodSummary/NeighborhoodSummary';
import { initialSelection } from '../ActionPanel/selection';
import { AiTurnModal } from '../AiTurnModal/AiTurnModal';
import { UpkeepModal } from '../UpkeepModal/UpkeepModal';

interface GameProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export const Game = memo(function Game({ state, dispatch, theme, onToggleTheme }: GameProps) {
  const [selection, setSelection] = useState(initialSelection);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalEntries, setAiModalEntries] = useState<ReadonlyArray<GameLogEntry>>([]);
  const [aiModalTitle, setAiModalTitle] = useState('AI Turn');
  const [upkeepModalOpen, setUpkeepModalOpen] = useState(false);
  const [upkeepModalEntries, setUpkeepModalEntries] = useState<ReadonlyArray<GameLogEntry>>([]);
  const [upkeepModalTitle, setUpkeepModalTitle] = useState('Upkeep Summary');
  const lastLogLengthRef = useRef(state.log.length);
  const queuedUpkeepEntriesRef = useRef<ReadonlyArray<GameLogEntry>>([]);
  const lastPlayerIdRef = useRef<PlayerId | null>(
    state.players[state.currentPlayerIndex]?.id ?? null,
  );

  useEffect(() => {
    if (state.status === 'idle') {
      setSelection(initialSelection);
      setAiModalOpen(false);
      setUpkeepModalOpen(false);
    }
  }, [state.status]);

  useEffect(() => {
    const previousLogLength = lastLogLengthRef.current;
    if (state.log.length < previousLogLength) {
      lastLogLengthRef.current = state.log.length;
      lastPlayerIdRef.current = state.players[state.currentPlayerIndex]?.id ?? null;
      setAiModalOpen(false);
      setUpkeepModalOpen(false);
      return;
    }

    if (state.log.length > previousLogLength) {
      const newEntries = state.log.slice(previousLogLength);
      const upkeepEntries = newEntries.filter((entry) => entry.phase === 'upkeep');
      const aiEntries = newEntries.filter((entry) => entry.kind === 'ai');
      if (upkeepEntries.length > 0) {
        if (state.pendingChoice) {
          queuedUpkeepEntriesRef.current = [...queuedUpkeepEntriesRef.current, ...upkeepEntries];
        } else {
          const combinedEntries = [...queuedUpkeepEntriesRef.current, ...upkeepEntries];
          queuedUpkeepEntriesRef.current = [];
          const upkeepRound = combinedEntries[0]?.round ?? state.round;
          setUpkeepModalEntries(combinedEntries);
          setUpkeepModalTitle(`Upkeep Summary (Round ${upkeepRound})`);
          setUpkeepModalOpen(true);
          setAiModalOpen(false);
        }
      } else if (aiEntries.length > 0) {
        const previousPlayerId = lastPlayerIdRef.current;
        const previousPlayerName = previousPlayerId
          ? state.players.find((player) => player.id === previousPlayerId)?.name
          : null;
        setAiModalEntries(aiEntries);
        setAiModalTitle(previousPlayerName ? `${previousPlayerName}'s Turn` : 'AI Turn');
        setAiModalOpen(true);
      }
    }

    lastLogLengthRef.current = state.log.length;
    lastPlayerIdRef.current = state.players[state.currentPlayerIndex]?.id ?? null;
  }, [state.currentPlayerIndex, state.log, state.players, state.round, state.pendingChoice]);

  const selectionEnabled =
    state.status === 'playing' &&
    state.phase === 'development' &&
    state.pendingChoice === null &&
    state.players[state.currentPlayerIndex]?.type === 'human' &&
    !aiModalOpen &&
    !upkeepModalOpen;

  const endgameWarning = getEndgameWarning(state);

  const handleSelectSpace = (locationId: LocationId, spaceIndex: number) => {
    setSelection({ ...initialSelection, locationId, spaceIndex });
  };

  return (
    <div className="app">
      <Header state={state} dispatch={dispatch} theme={theme} onToggleTheme={onToggleTheme} />
      <main className="game">
        {state.status === 'idle' && <Setup dispatch={dispatch} />}

        {state.status !== 'idle' && (
          <>
            {endgameWarning && <div className="alert alert--warning">{endgameWarning}</div>}
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
                  interactionDisabled={aiModalOpen || upkeepModalOpen}
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
      <UpkeepModal
        entries={upkeepModalEntries}
        open={upkeepModalOpen}
        title={upkeepModalTitle}
        onClose={() => setUpkeepModalOpen(false)}
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

function getEndgameWarning(state: GameState): string | null {
  if (state.status !== 'playing' || state.phase !== 'development') return null;

  const starLeaders = state.players
    .filter((player) => getPlayerTotalStars(player) >= 7)
    .map((player) => player.name);

  if (starLeaders.length > 0) {
    const names = starLeaders.join(', ');
    return `Endgame triggered: ${names} reached 7+ stars. The game will end at the start of the next upkeep.`;
  }

  const targetSupply = state.settings?.soloMode ? 2 : 3;
  const cannotRefill = state.planSupply.length + state.planDeck.length < targetSupply;
  if (cannotRefill) {
    return 'Endgame warning: the Plan Supply cannot be refilled on the next upkeep. The game will end at the start of upkeep.';
  }

  return null;
}
