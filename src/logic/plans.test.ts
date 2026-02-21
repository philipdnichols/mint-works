import { describe, expect, it } from 'vitest';
import type { PlayerState } from '../types/game';
import type { PlanId } from '../types/game';
import {
  countCultureBuildings,
  getBuildingStars,
  getGalleryStoredMints,
  getNeighborhoodSize,
  getPlanDefinition,
  isDeedPlan,
  isProductionPlan,
} from './plans';

function makePlayer(overrides: Partial<PlayerState>): PlayerState {
  return {
    id: 'p1',
    name: 'Player',
    type: 'human',
    mints: 0,
    plans: [],
    buildings: [],
    ...overrides,
  };
}

describe('plan scoring', () => {
  it('applies landfill penalty to culture buildings', () => {
    const player = makePlayer({
      buildings: [
        { planId: 'landfill', storedMints: 0 },
        { planId: 'gardens', storedMints: 0 },
      ],
    });
    const gardens = player.buildings.find((b) => b.planId === 'gardens')!;
    expect(getBuildingStars(gardens, player)).toBe(2);
  });

  it('counts bridge as two culture buildings for museum', () => {
    const player = makePlayer({
      buildings: [
        { planId: 'museum', storedMints: 0 },
        { planId: 'bridge', storedMints: 0 },
      ],
    });
    const museum = player.buildings.find((b) => b.planId === 'museum')!;
    expect(getBuildingStars(museum, player)).toBe(3);
  });

  it('vault counts face-down plans for stars', () => {
    const player = makePlayer({
      plans: ['gardens', 'statue'],
      buildings: [{ planId: 'vault', storedMints: 0 }],
    });
    const vault = player.buildings.find((b) => b.planId === 'vault')!;
    expect(getBuildingStars(vault, player)).toBe(4);
  });

  it('obelisk counts total buildings', () => {
    const player = makePlayer({
      buildings: [
        { planId: 'obelisk', storedMints: 0 },
        { planId: 'mine', storedMints: 0 },
      ],
    });
    const obelisk = player.buildings.find((b) => b.planId === 'obelisk')!;
    expect(getBuildingStars(obelisk, player)).toBe(2);
  });

  it('identifies plan tags and throws on unknown ids', () => {
    expect(isDeedPlan('wholesaler')).toBe(true);
    expect(isDeedPlan('gardens')).toBe(false);
    expect(isProductionPlan('mine')).toBe(true);
    expect(isProductionPlan('truck')).toBe(false);
    expect(() => getPlanDefinition('mystery' as PlanId)).toThrowError('Unknown plan id: mystery');
  });

  it('handles gallery stored mints and culture counts', () => {
    const buildings = [
      { planId: 'bridge', storedMints: 0 },
      { planId: 'truck', storedMints: 0 },
      { planId: 'gallery', storedMints: 2 },
    ];
    expect(countCultureBuildings(buildings)).toBe(3);
    expect(getGalleryStoredMints(buildings)).toBe(2);
    expect(getGalleryStoredMints([])).toBe(0);
  });

  it('uses gallery stored mints for stars and neighborhood size', () => {
    const player = makePlayer({
      buildings: [
        { planId: 'gallery', storedMints: 3 },
        { planId: 'bridge', storedMints: 0 },
      ],
    });
    const gallery = player.buildings.find((b) => b.planId === 'gallery')!;
    expect(getBuildingStars(gallery, player)).toBe(3);
    expect(getNeighborhoodSize(player)).toBe(3);
  });
});
