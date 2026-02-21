import { describe, expect, it } from 'vitest';
import type { AiId } from '../types/game';
import { getAllPlanIds, startGame } from './setup';

describe('setup', () => {
  it('defaults solo AI to Justin when missing', () => {
    const settings = {
      playerCount: 1 as const,
      boardPlayerCount: 1 as const,
      soloMode: true,
      advancedLocations: [] as const,
      seed: 1,
    };
    const state = startGame(settings, getAllPlanIds());
    const ai = state.players.find((player) => player.id === 'ai')!;
    expect(ai.aiId).toBe('justin');
    expect(ai.name).toBe('Justin');
  });

  it('falls back to a generic name for unknown AI ids', () => {
    const settings = {
      playerCount: 1 as const,
      boardPlayerCount: 1 as const,
      soloMode: true,
      aiOpponent: 'mystery' as AiId,
      advancedLocations: [] as const,
      seed: 1,
    };
    const state = startGame(settings, getAllPlanIds());
    const ai = state.players.find((player) => player.id === 'ai')!;
    expect(ai.name).toBe('AI');
  });
});
