import { test, expect } from '@playwright/test';
import type { GameSettings, GameState } from '../src/types/game';
import type { GameAction } from '../src/state/actions';
import { getAllPlanIds } from '../src/logic/setup';

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

const BASE_SETTINGS: GameSettings = {
  playerCount: 2,
  boardPlayerCount: 2,
  soloMode: false,
  advancedLocations: ['swap-meet', 'temp-agency'],
  seed: 1,
};

async function startTestGame(page: import('@playwright/test').Page) {
  await dispatch(page, {
    type: '__TEST_START_GAME',
    payload: { settings: BASE_SETTINGS, deckOrder: getAllPlanIds() },
  });
  await page.waitForFunction(() => {
    const win = window as unknown as TestWindow;
    return win.__gameState?.status === 'playing';
  });
}

async function loadState(
  page: import('@playwright/test').Page,
  updater: (state: GameState) => GameState,
) {
  const current = await gameState(page);
  await dispatch(page, { type: '__TEST_LOAD_STATE', state: updater(current) });
}

function playerCard(page: import('@playwright/test').Page, name: string) {
  return page.locator('.player').filter({ has: page.getByRole('heading', { name }) });
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

  test('shows temp agency warning when no occupied locations exist', async ({ page }) => {
    await startTestGame(page);
    await page.getByLabel('Location').selectOption('Temp Agency');
    await expect(page.getByText('No occupied locations to target.')).toBeVisible();
  });

  test('swap meet excludes the given plan from the take list', async ({ page }) => {
    await startTestGame(page);
    await loadState(page, (state) => ({
      ...state,
      status: 'playing',
      phase: 'development',
      currentPlayerIndex: 0,
      lockedLocations: [],
      players: state.players.map((player) =>
        player.id === 'p1'
          ? { ...player, mints: 5, plans: ['truck'], buildings: [] }
          : { ...player },
      ),
      planSupply: ['truck', 'crane', 'corporate-hq'],
      planDeck: [],
      passedPlayers: [],
      results: null,
    }));

    await page.getByLabel('Location').selectOption('Swap Meet');
    await page.getByLabel('Give').selectOption('Plan: Truck ($2)');

    const take = page.getByLabel('Take');
    await expect(take.getByRole('option', { name: 'Truck ($2)' })).toHaveCount(0);
  });

  test('ends the game when a player reaches 7 stars', async ({ page }) => {
    await startTestGame(page);
    await loadState(page, (state) => ({
      ...state,
      status: 'playing',
      phase: 'development',
      currentPlayerIndex: 1,
      passedPlayers: ['p1'],
      players: state.players.map((player) =>
        player.id === 'p1'
          ? {
              ...player,
              mints: 2,
              plans: [],
              buildings: [
                { planId: 'gardens', storedMints: 0 },
                { planId: 'factory', storedMints: 0 },
                { planId: 'crane', storedMints: 0 },
              ],
            }
          : { ...player, mints: 2, plans: [], buildings: [] },
      ),
      planSupply: ['truck', 'coop', 'plant'],
      planDeck: ['obelisk'],
      results: null,
    }));

    await page.getByRole('button', { name: 'Pass' }).click();
    await expect(page.getByText('Results')).toBeVisible();
    await expect(page.getByText('Winner(s): Player 1')).toBeVisible();
    await expect(page.getByText('Tiebreaker: Most stars')).toBeVisible();
  });

  test('ends the game when the supply cannot refill', async ({ page }) => {
    await startTestGame(page);
    await loadState(page, (state) => ({
      ...state,
      status: 'playing',
      phase: 'development',
      currentPlayerIndex: 1,
      passedPlayers: ['p1'],
      players: state.players.map((player) => ({
        ...player,
        mints: 1,
        plans: [],
        buildings: [],
      })),
      planSupply: ['truck'],
      planDeck: [],
      results: null,
    }));

    await page.getByRole('button', { name: 'Pass' }).click();
    await expect(page.getByText('Results')).toBeVisible();
    await expect(page.getByText('Tiebreaker: Still tied')).toBeVisible();
  });

  test('awards deed payouts during upkeep', async ({ page }) => {
    await startTestGame(page);
    await loadState(page, (state) => ({
      ...state,
      status: 'playing',
      phase: 'development',
      currentPlayerIndex: 1,
      passedPlayers: ['p1'],
      players: state.players.map((player) => ({
        ...player,
        mints: 2,
        plans: [],
        buildings: [],
      })),
      planSupply: ['truck', 'crane', 'corporate-hq'],
      planDeck: ['plant'],
      locations: state.locations.map((loc) => {
        if (loc.id === 'wholesaler-location') {
          return {
            ...loc,
            isOpen: true,
            ownerId: 'p1',
            spaces: loc.spaces.map((space, index) => ({
              ...space,
              mints: index === 0 ? 2 : 0,
            })),
          };
        }
        if (loc.id === 'lotto-location') {
          return {
            ...loc,
            isOpen: true,
            ownerId: 'p2',
            spaces: loc.spaces.map((space, index) => ({
              ...space,
              mints: index === 0 ? 1 : 0,
            })),
          };
        }
        return loc;
      }),
      results: null,
    }));

    await page.getByRole('button', { name: 'Pass' }).click();

    const p1Card = playerCard(page, 'Player 1');
    const p2Card = playerCard(page, 'Player 2');
    await expect(p1Card.getByText('Mints: 4')).toBeVisible();
    await expect(p2Card.getByText('Mints: 5')).toBeVisible();
  });
});
