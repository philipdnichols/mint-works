import { memo, useEffect, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { GameAction } from '../../state/actions';
import type { GameLogEntry, GameState, LocationId, PlayerId } from '../../types/game';
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
import { ResultsModal } from '../ResultsModal/ResultsModal';

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
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const lastLogLengthRef = useRef(state.log.length);
  const queuedUpkeepEntriesRef = useRef<ReadonlyArray<GameLogEntry>>([]);
  const resultsModalShownRef = useRef(false);
  const lastPlayerIdRef = useRef<PlayerId | null>(
    state.players[state.currentPlayerIndex]?.id ?? null,
  );

  useEffect(() => {
    if (state.status === 'idle') {
      setSelection(initialSelection);
      setAiModalOpen(false);
      setUpkeepModalOpen(false);
      setResultsModalOpen(false);
      resultsModalShownRef.current = false;
    }
  }, [state.status]);

  useEffect(() => {
    if (!state.results) {
      resultsModalShownRef.current = false;
      setResultsModalOpen(false);
      return;
    }

    if (!resultsModalShownRef.current) {
      setResultsModalOpen(true);
      setAiModalOpen(false);
      setUpkeepModalOpen(false);
      resultsModalShownRef.current = true;
    }
  }, [state.results]);

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
    !upkeepModalOpen &&
    !resultsModalOpen;

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
            {state.results && (
              <div className="alert alert--results">
                <div className="alert__content">
                  <strong>Game over.</strong>
                  <span>{getResultsMessage(state)}</span>
                </div>
                <div className="alert__actions">
                  <button
                    type="button"
                    className="alert__button"
                    onClick={() => setResultsModalOpen(true)}
                  >
                    View results
                  </button>
                </div>
              </div>
            )}
            {state.lastError && <div className="alert">{state.lastError}</div>}
            <div className="layout">
              <Board
                state={state}
                selection={selection}
                selectionEnabled={selectionEnabled}
                onSelectSpace={handleSelectSpace}
                suspendRefillAnimation={aiModalOpen || upkeepModalOpen || resultsModalOpen}
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
      <ResultsModal
        open={resultsModalOpen}
        results={state.results}
        players={state.players}
        soloMode={state.settings?.soloMode ?? false}
        status={state.status}
        onClose={() => setResultsModalOpen(false)}
        onNewGame={() => dispatch({ type: 'NEW_GAME' })}
      />
    </div>
  );
});

function getResultsMessage(state: GameState): string {
  if (!state.results) return '';
  if (!state.settings?.soloMode) {
    return 'Final results are ready.';
  }
  if (state.status === 'won') return 'You won the solo challenge.';
  return 'The AI took the win this time.';
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
