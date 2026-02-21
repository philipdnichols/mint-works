import { describe, expect, it } from 'vitest';
import type { BuildingState, PlanId, PlayerState } from '../types/game';
import {
  applyCulturePenalty,
  countBuildings,
  countCultureBuildings,
  countLandfills,
  getBuildingStarBreakdown,
  getBuildingStars,
  getGalleryStoredMints,
  getNeighborhoodSize,
  getPlanCost,
  getPlanEffect,
  getPlanDefinition,
  getPlanStarInfo,
  getPlayerTotalStars,
  isCulturePlan,
  isDeedPlan,
  isPlanTag,
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
    const buildings: ReadonlyArray<BuildingState> = [
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

  it('exposes plan metadata helpers', () => {
    expect(isPlanTag('mine', 'Production')).toBe(true);
    expect(isCulturePlan('museum')).toBe(true);
    expect(getPlanCost('factory')).toBe(4);
    expect(getPlanEffect('truck')).toContain('Supplier');
  });

  it('returns star info hints for variable plans', () => {
    expect(getPlanStarInfo('vault')).toEqual({
      label: 'variable',
      hint: '2 stars per plan in hand.',
    });
    expect(getPlanStarInfo('museum').hint).toContain('Bridge counts twice');
    expect(getPlanStarInfo('obelisk')).toEqual({ label: 'variable', hint: '1 star per building.' });
    expect(getPlanStarInfo('gallery')).toEqual({
      label: 'variable',
      hint: 'Stars equal to mints stored on the Gallery.',
    });
    expect(getPlanStarInfo('mine')).toEqual({ label: '1' });
  });

  it('counts landfills and buildings, and applies culture penalty floor', () => {
    const buildings: ReadonlyArray<BuildingState> = [
      { planId: 'landfill', storedMints: 0 },
      { planId: 'landfill', storedMints: 0 },
      { planId: 'museum', storedMints: 0 },
    ];
    expect(countLandfills(buildings)).toBe(2);
    expect(countBuildings(buildings)).toBe(3);
    expect(applyCulturePenalty(1, 3)).toBe(0);
  });

  it('builds star breakdown for variable and fixed buildings', () => {
    const player = makePlayer({
      plans: ['mine', 'factory'],
      buildings: [
        { planId: 'landfill', storedMints: 0 },
        { planId: 'museum', storedMints: 0 },
        { planId: 'bridge', storedMints: 0 },
        { planId: 'vault', storedMints: 0 },
        { planId: 'obelisk', storedMints: 0 },
        { planId: 'gallery', storedMints: 3 },
        { planId: 'mine', storedMints: 0 },
      ],
    });
    const museum = player.buildings.find((b) => b.planId === 'museum')!;
    const vault = player.buildings.find((b) => b.planId === 'vault')!;
    const obelisk = player.buildings.find((b) => b.planId === 'obelisk')!;
    const gallery = player.buildings.find((b) => b.planId === 'gallery')!;
    const mine = player.buildings.find((b) => b.planId === 'mine')!;

    expect(getBuildingStarBreakdown(museum, player)).toEqual({
      total: 3,
      base: 4,
      baseLabel: '4 culture building(s)',
      landfillPenalty: 1,
      landfillCount: 1,
      isCulture: true,
    });
    expect(getBuildingStarBreakdown(vault, player)).toEqual({
      total: 4,
      base: 4,
      baseLabel: '2 plan(s) x2',
      landfillPenalty: 0,
      landfillCount: 1,
      isCulture: false,
    });
    expect(getBuildingStarBreakdown(obelisk, player).baseLabel).toBe('7 building(s)');
    expect(getBuildingStarBreakdown(gallery, player).baseLabel).toBe('3 stored mint(s)');
    expect(getBuildingStarBreakdown(mine, player).baseLabel).toBe('Printed stars');
  });

  it('sums total player stars across buildings', () => {
    const player = makePlayer({
      plans: ['gardens'],
      buildings: [
        { planId: 'landfill', storedMints: 0 },
        { planId: 'gardens', storedMints: 0 },
        { planId: 'vault', storedMints: 0 },
      ],
    });
    expect(getPlayerTotalStars(player)).toBe(7);
  });
});
