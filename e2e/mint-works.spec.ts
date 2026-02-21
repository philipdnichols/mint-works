import { test, expect } from '@playwright/test';
import type { GameState } from '../src/types/game';
import type { GameAction } from '../src/state/actions';

const APP_URL = 'http://localhost:5173/mint-works/';

type TestWindow = Window & {
  __gameState?: GameState;
  __dispatch?: (action: GameAction) => void;
};

function gameState(page: import('@playwright/test').Page): Promise<GameState> {
  return page.evaluate(() => {
    const win = window as unknown as TestWindow;
    return win.__gameState as GameState;
  });
}

function dispatch(page: import('@playwright/test').Page, action: GameAction): Promise<void> {
  return page.evaluate((a) => {
    const win = window as unknown as TestWindow;
    win.__dispatch?.(a);
  }, action);
}

test.describe('Mint Works!', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
  });

  test('loads in idle state', async ({ page }) => {
    const state = await gameState(page);
    expect(state.status).toBe('idle');
    await expect(page.getByText(/start a game/i)).toBeVisible();
  });

  test('can load a preset state via __TEST_LOAD_STATE', async ({ page }) => {
    const preset = {
      status: 'won',
      phase: 'scoring',
      elapsedSeconds: 42,
      settings: null,
      players: [],
      currentPlayerIndex: 0,
      startingPlayerId: null,
      planDeck: [],
      planSupply: [],
      locations: [],
      passedPlayers: [],
      round: 0,
      mintSupply: 'unlimited',
      lockedLocations: [],
      sonicBonusTurnUsed: false,
      upkeepQueue: [],
      pendingChoice: null,
      results: {
        scores: [{ playerId: 'p1', stars: 7 }],
        winnerIds: ['p1'],
        tiebreaker: 'stars',
      },
    };
    await dispatch(page, { type: '__TEST_LOAD_STATE', state: preset as GameState });
    await expect(page.getByText(/results/i)).toBeVisible();
  });
});
