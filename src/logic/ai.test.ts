import { describe, expect, it } from 'vitest';
import {
  aiAvoidsProduction,
  aiSkipsSupplierWithPlans,
  getAiCostPriority,
  getAiProfile,
  getAiTypePriority,
} from './ai';

describe('ai profiles', () => {
  it('returns null for missing or unknown profile ids', () => {
    expect(getAiProfile()).toBeNull();
    expect(getAiProfile('invalid' as never)).toBeNull();
  });

  it('returns profile metadata for known AI ids', () => {
    const mort = getAiProfile('mort');
    expect(mort?.title).toBe('The Mint Tycoon');
    expect(mort?.startingMints).toBe('unlimited');
  });

  it('provides sensible defaults when AI id is missing', () => {
    expect(getAiTypePriority()).toEqual(['Utility', 'Deed', 'Production', 'Culture']);
    expect(getAiCostPriority()).toBe('low');
  });

  it('reads cost and type priorities for known AI ids', () => {
    expect(getAiTypePriority('rachael')).toEqual(['Production', 'Culture', 'Utility', 'Deed']);
    expect(getAiCostPriority('rachael')).toBe('high');
  });

  it('exposes special AI behavior helpers', () => {
    expect(aiSkipsSupplierWithPlans('sonic')).toBe(true);
    expect(aiSkipsSupplierWithPlans('mort')).toBe(false);
    expect(aiAvoidsProduction('mort')).toBe(true);
    expect(aiAvoidsProduction('justin')).toBe(false);
  });
});
