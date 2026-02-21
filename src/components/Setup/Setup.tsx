import { useMemo, useState } from 'react';
import type { Dispatch } from 'react';
import type { GameAction } from '../../state/actions';
import type { AdvancedLocationId, AiId, PlayerCount } from '../../types/game';
import { createSeededRng, shuffleWithRng } from '../../logic/random';
import { getAllPlanIds } from '../../logic/setup';
import { getAdvancedLocationConfigs } from '../../logic/locations';

interface SetupProps {
  dispatch: Dispatch<GameAction>;
}

const PLAYER_COUNTS: ReadonlyArray<PlayerCount> = [2, 3, 4];
const AI_OPTIONS: ReadonlyArray<{ id: AiId; label: string }> = [
  { id: 'justin', label: 'Justin' },
  { id: 'rachael', label: 'Rachael' },
  { id: 'sonic', label: 'Sonic' },
  { id: 'mort', label: 'Mort' },
];

export function Setup({ dispatch }: SetupProps) {
  const [soloMode, setSoloMode] = useState(false);
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);
  const [aiId, setAiId] = useState<AiId>('justin');
  const [advancedEnabled, setAdvancedEnabled] = useState(true);

  const advancedIds = useMemo(
    () => getAdvancedLocationConfigs().map((config) => config.id),
    [],
  ) as ReadonlyArray<AdvancedLocationId>;

  const handleStart = () => {
    const seed = Date.now();
    const rng = createSeededRng(seed);
    const deckOrder = shuffleWithRng(getAllPlanIds(), rng);

    const shuffledAdvanced = shuffleWithRng(advancedIds, rng);
    const advancedCount = advancedEnabled ? (soloMode ? 1 : 2) : 0;
    const advancedLocations = shuffledAdvanced.slice(0, advancedCount);

    const settings = {
      playerCount: soloMode ? (1 as PlayerCount) : playerCount,
      boardPlayerCount: soloMode ? (1 as PlayerCount) : playerCount,
      soloMode,
      aiOpponent: soloMode ? aiId : undefined,
      advancedLocations,
      seed,
    };

    dispatch({ type: 'START_GAME', payload: { settings, deckOrder } });
  };

  return (
    <section className="setup">
      <h2>Start a Game</h2>
      <label className="setup__row">
        <input
          type="checkbox"
          checked={soloMode}
          onChange={(event) => setSoloMode(event.target.checked)}
        />
        Solo mode vs AI
      </label>

      {!soloMode && (
        <label className="setup__row">
          Player count
          <select
            value={playerCount}
            onChange={(event) => setPlayerCount(Number(event.target.value) as PlayerCount)}
          >
            {PLAYER_COUNTS.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
      )}

      {soloMode && (
        <label className="setup__row">
          AI opponent
          <select value={aiId} onChange={(event) => setAiId(event.target.value as AiId)}>
            {AI_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="setup__row">
        <input
          type="checkbox"
          checked={advancedEnabled}
          onChange={(event) => setAdvancedEnabled(event.target.checked)}
        />
        Include advanced locations
      </label>

      <button className="setup__button" type="button" onClick={handleStart}>
        Begin Development
      </button>
    </section>
  );
}
