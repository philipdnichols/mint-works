import type { GameLogEntry, GameLogKind, GameState, Phase } from '../types/game';

type LogInput = {
  readonly text: string;
  readonly kind?: GameLogKind;
  readonly phase?: Phase;
  readonly round?: number;
};

export function appendLog(state: GameState, entry: LogInput): GameState {
  const nextId = state.log.length + 1;
  const logEntry: GameLogEntry = {
    id: nextId,
    round: entry.round ?? state.round,
    phase: entry.phase ?? state.phase,
    kind: entry.kind ?? 'info',
    text: entry.text,
  };

  return {
    ...state,
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
