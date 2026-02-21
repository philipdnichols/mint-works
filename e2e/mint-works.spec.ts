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

async function startTestGame(
  page: import('@playwright/test').Page,
  overrides: Partial<GameSettings> = {},
) {
  const settings: GameSettings = { ...BASE_SETTINGS, ...overrides };
  await dispatch(page, {
    type: '__TEST_START_GAME',
    payload: { settings, deckOrder: getAllPlanIds() },
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

async function selectLocationSpace(
  page: import('@playwright/test').Page,
  locationName: string,
  spaceIndex = 1,
) {
  const matcher = new RegExp(`${locationName} space ${spaceIndex}`, 'i');
  await page.getByRole('button', { name: matcher }).click();
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
      log: [],
      logSequence: 0,
    };
    await dispatch(page, { type: '__TEST_LOAD_STATE', state: preset as GameState });
    await expect(page.getByText(/results/i)).toBeVisible();
  });

  test('shows temp agency warning when no occupied locations exist', async ({ page }) => {
    await startTestGame(page);
    await selectLocationSpace(page, 'Temp Agency');
    await expect(page.getByText('No occupied locations to target.')).toBeVisible();
  });

  test('temp agency can copy a producer action', async ({ page }) => {
    await startTestGame(page);
    await loadState(page, (state) => ({
      ...state,
      status: 'playing',
      phase: 'development',
      currentPlayerIndex: 0,
      lockedLocations: [],
      passedPlayers: [],
      players: state.players.map((player) =>
        player.id === 'p1' ? { ...player, mints: 3 } : { ...player },
      ),
      locations: state.locations.map((loc) => {
        if (loc.id !== 'producer') return loc;
        return {
          ...loc,
          spaces: loc.spaces.map((space, index) =>
            index === 0 ? { ...space, occupiedBy: 'p2', mints: 1 } : space,
          ),
        };
      }),
      results: null,
    }));

    await selectLocationSpace(page, 'Temp Agency');
    await page.getByLabel('Target occupied location').selectOption('Producer');
    await expect(page.getByText('Cost: 2 mint(s)')).toBeVisible();
    await page.getByRole('button', { name: 'Place Mint' }).click();

    const p1Card = playerCard(page, 'Player 1');
    await expect(p1Card.getByText('Mints: 3')).toBeVisible();
  });

  test('temp agency can copy a supplier action with a plan choice', async ({ page }) => {
    await startTestGame(page);
    await loadState(page, (state) => ({
      ...state,
      status: 'playing',
      phase: 'development',
      currentPlayerIndex: 0,
      lockedLocations: [],
      passedPlayers: [],
      planSupply: ['truck', 'crane', 'plant'],
      players: state.players.map((player) =>
        player.id === 'p1' ? { ...player, mints: 5, plans: [], buildings: [] } : { ...player },
      ),
      locations: state.locations.map((loc) => {
        if (loc.id !== 'supplier') return loc;
        return {
          ...loc,
          spaces: loc.spaces.map((space, index) =>
            index === 0 ? { ...space, occupiedBy: 'p2', mints: 2 } : space,
          ),
        };
      }),
      results: null,
    }));

    await selectLocationSpace(page, 'Temp Agency');
    await page.getByLabel('Target occupied location').selectOption('Supplier');
    await page.getByLabel('Plan to gain').selectOption('Truck ($2)');
    await expect(page.getByText('Cost: 3 mint(s)')).toBeVisible();
    await page.getByRole('button', { name: 'Place Mint' }).click();

    const p1Card = playerCard(page, 'Player 1');
    await expect(p1Card.getByText('Mints: 2')).toBeVisible();
    await expect(p1Card.getByText('Plans (face-down): 1')).toBeVisible();
  });

  test('temp agency can copy a builder action with a plan choice', async ({ page }) => {
    await startTestGame(page);
    await loadState(page, (state) => ({
      ...state,
      status: 'playing',
      phase: 'development',
      currentPlayerIndex: 0,
      lockedLocations: [],
      passedPlayers: [],
      players: state.players.map((player) =>
        player.id === 'p1'
          ? { ...player, mints: 5, plans: ['workshop'], buildings: [] }
          : { ...player },
      ),
      locations: state.locations.map((loc) => {
        if (loc.id !== 'builder') return loc;
        return {
          ...loc,
          spaces: loc.spaces.map((space, index) =>
            index === 0 ? { ...space, occupiedBy: 'p2', mints: 2 } : space,
          ),
        };
      }),
      results: null,
    }));

    await selectLocationSpace(page, 'Temp Agency');
    await page.getByLabel('Target occupied location').selectOption('Builder');
    await page.getByLabel('Plan to build').selectOption('Workshop ($3)');
    await expect(page.getByText('Cost: 3 mint(s)')).toBeVisible();
    await page.getByRole('button', { name: 'Place Mint' }).click();

    const p1Card = playerCard(page, 'Player 1');
    await expect(p1Card.getByText('Plans (face-down): 0')).toBeVisible();
    await expect(p1Card.getByRole('button', { name: /Workshop.*Stars: 2/i })).toBeVisible();
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

    await selectLocationSpace(page, 'Swap Meet');
    await page.getByLabel('Give').selectOption('Plan: Truck ($2)');

    const take = page.getByLabel('Take');
    await expect(take.getByRole('option', { name: 'Truck ($2)' })).toHaveCount(0);
  });

  test('swap meet swaps the player plan with the supply card', async ({ page }) => {
    await startTestGame(page);
    await loadState(page, (state) => ({
      ...state,
      status: 'playing',
      phase: 'development',
      currentPlayerIndex: 0,
      lockedLocations: [],
      passedPlayers: [],
      planSupply: ['crane', 'plant', 'lotto'],
      players: state.players.map((player) =>
        player.id === 'p1'
          ? { ...player, mints: 4, plans: ['truck'], buildings: [] }
          : { ...player },
      ),
      results: null,
    }));

    await selectLocationSpace(page, 'Swap Meet');
    await page.getByLabel('Give').selectOption('Plan: Truck ($2)');
    await page.getByLabel('Take').selectOption('Crane ($2)');
    await expect(page.getByText('Cost: 2 mint(s)')).toBeVisible();
    await page.getByRole('button', { name: 'Place Mint' }).click();

    const p1Card = playerCard(page, 'Player 1');
    await expect(p1Card.getByText('Plans (face-down): 1')).toBeVisible();

    const supply = page.locator('.plan-supply');
    await expect(supply.getByText('Truck')).toBeVisible();
    await expect(supply.getByText('Crane')).toHaveCount(0);
  });

  test('recycler pays out cost and stars for a recycled plan', async ({ page }) => {
    await startTestGame(page, { advancedLocations: ['recycler'] });
    await loadState(page, (state) => ({
      ...state,
      status: 'playing',
      phase: 'development',
      currentPlayerIndex: 0,
      lockedLocations: [],
      passedPlayers: [],
      players: state.players.map((player) =>
        player.id === 'p1'
          ? { ...player, mints: 3, plans: ['truck'], buildings: [] }
          : { ...player, mints: 3, plans: [], buildings: [] },
      ),
      results: null,
    }));

    await selectLocationSpace(page, 'Recycler');
    await page.getByLabel('Recycle card').selectOption('Plan: Truck ($2)');
    await expect(page.getByText('Cost: 1 mint(s)')).toBeVisible();
    await page.getByRole('button', { name: 'Place Mint' }).click();

    const p1Card = playerCard(page, 'Player 1');
    await expect(p1Card.getByText('Mints: 5')).toBeVisible();
  });

  test('recycler pays out stars for a recycled building', async ({ page }) => {
    await startTestGame(page, { advancedLocations: ['recycler'] });
    await loadState(page, (state) => ({
      ...state,
      status: 'playing',
      phase: 'development',
      currentPlayerIndex: 0,
      lockedLocations: [],
      passedPlayers: [],
      players: state.players.map((player) =>
        player.id === 'p1'
          ? {
              ...player,
              mints: 3,
              plans: [],
              buildings: [{ planId: 'workshop', storedMints: 0 }],
            }
          : { ...player, mints: 3, plans: [], buildings: [] },
      ),
      results: null,
    }));

    await selectLocationSpace(page, 'Recycler');
    await page.getByLabel('Recycle card').selectOption('Building: Workshop ($3)');
    await expect(page.getByText('Cost: 1 mint(s)')).toBeVisible();
    await page.getByRole('button', { name: 'Place Mint' }).click();

    const p1Card = playerCard(page, 'Player 1');
    await expect(p1Card.getByText('Mints: 4')).toBeVisible();
    await expect(p1Card.getByRole('button', { name: /Workshop.*Stars: 2/i })).toHaveCount(0);
  });

  test('crowdfunder grants bonus mints to every player', async ({ page }) => {
    await startTestGame(page, { advancedLocations: ['crowdfunder'] });
    await loadState(page, (state) => ({
      ...state,
      status: 'playing',
      phase: 'development',
      currentPlayerIndex: 0,
      lockedLocations: [],
      passedPlayers: [],
      players: state.players.map((player) => ({ ...player, mints: 3, plans: [], buildings: [] })),
      results: null,
    }));

    await selectLocationSpace(page, 'Crowdfunder');
    await page.getByRole('button', { name: 'Place Mint' }).click();

    const p1Card = playerCard(page, 'Player 1');
    const p2Card = playerCard(page, 'Player 2');
    await expect(p1Card.getByText('Mints: 5')).toBeVisible();
    await expect(p2Card.getByText('Mints: 4')).toBeVisible();
  });

  test('upkeep resolves co-op choice and corporate HQ payout', async ({ page }) => {
    await startTestGame(page);
    await loadState(page, (state) => ({
      ...state,
      status: 'playing',
      phase: 'development',
      currentPlayerIndex: 1,
      passedPlayers: ['p1'],
      players: state.players.map((player) => {
        if (player.id === 'p1') {
          return {
            ...player,
            mints: 1,
            plans: [],
            buildings: [
              { planId: 'corporate-hq', storedMints: 0 },
              { planId: 'mine', storedMints: 0 },
            ],
          };
        }
        if (player.id === 'p2') {
          return {
            ...player,
            mints: 1,
            plans: [],
            buildings: [{ planId: 'coop', storedMints: 0 }],
          };
        }
        return player;
      }),
      results: null,
    }));

    await page.getByRole('button', { name: 'Pass' }).click();
    await expect(page.getByRole('heading', { name: 'Co-Op: Choose a player' })).toBeVisible();
    await page.getByRole('button', { name: 'Give 1 mint to Player 1' }).click();

    const p1Card = playerCard(page, 'Player 1');
    const p2Card = playerCard(page, 'Player 2');
    await expect(p1Card.getByText('Mints: 6')).toBeVisible();
    await expect(p2Card.getByText('Mints: 3')).toBeVisible();
  });

  test('can run the AI turn in solo mode', async ({ page }) => {
    await startTestGame(page, {
      playerCount: 1,
      boardPlayerCount: 1,
      soloMode: true,
      aiOpponent: 'justin',
      advancedLocations: [],
    });

    await expect(page.getByRole('heading', { name: 'Justin (AI)' })).toBeVisible();
    await page.getByRole('button', { name: 'Run AI Turn' }).click();
    await expect(page.getByRole('heading', { name: "Player's Turn" })).toBeVisible();
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
