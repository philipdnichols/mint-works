import type { GameLogEntry, GameLogKind, GameState, Phase } from '../types/game';

type LogInput = {
  readonly text: string;
  readonly kind?: GameLogKind;
  readonly phase?: Phase;
  readonly round?: number;
};

export function appendLog(state: GameState, entry: LogInput): GameState {
  const logEntry: GameLogEntry = {
    id: state.logSequence + 1,
    round: entry.round ?? state.round,
    phase: entry.phase ?? state.phase,
    kind: entry.kind ?? 'info',
    text: entry.text,
  };

  return {
    ...state,
    logSequence: logEntry.id,
    log: [...state.log, logEntry],
  };
}

export function appendLogs(state: GameState, entries: ReadonlyArray<LogInput>): GameState {
  let nextState = state;
  for (const entry of entries) {
    nextState = appendLog(nextState, entry);
  }
  return nextState;
}
