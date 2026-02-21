import { describe, expect, it } from 'vitest';
import { getAllPlanIds, startGame } from './setup';
import { appendLog, appendLogs } from './log';

describe('log helpers', () => {
  it('uses defaults from game state when optional fields are omitted', () => {
    const state = startGame(
      {
        playerCount: 2,
        boardPlayerCount: 2,
        soloMode: false,
        advancedLocations: [],
        seed: 1,
      },
      getAllPlanIds(),
    );
    const next = appendLog(state, { text: 'Defaulted entry' });
    const last = next.log.at(-1)!;

    expect(last.round).toBe(state.round);
    expect(last.phase).toBe(state.phase);
    expect(last.kind).toBe('info');
    expect(last.text).toBe('Defaulted entry');
  });

  it('accepts explicit values and appends multiple entries in order', () => {
    const state = startGame(
      {
        playerCount: 2,
        boardPlayerCount: 2,
        soloMode: false,
        advancedLocations: [],
        seed: 2,
      },
      getAllPlanIds(),
    );
    const next = appendLogs(state, [
      { text: 'System entry', kind: 'system', phase: 'upkeep', round: 3 },
      { text: 'Action entry', kind: 'action', phase: 'development', round: 4 },
    ]);

    expect(next.log.at(-2)).toMatchObject({
      kind: 'system',
      phase: 'upkeep',
      round: 3,
      text: 'System entry',
    });
    expect(next.log.at(-1)).toMatchObject({
      kind: 'action',
      phase: 'development',
      round: 4,
      text: 'Action entry',
    });
  });
});
