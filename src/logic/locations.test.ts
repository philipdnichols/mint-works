import { describe, expect, it } from 'vitest';
import { buildLocations, getAdvancedLocationConfigs } from './locations';

describe('locations', () => {
  it('returns advanced location configs', () => {
    const configs = getAdvancedLocationConfigs();
    expect(configs.some((config) => config.id === 'recycler')).toBe(true);
  });

  it('marks deed locations closed and core locations open', () => {
    const locations = buildLocations(2, ['recycler'], false);
    const producer = locations.find((loc) => loc.id === 'producer')!;
    const wholesaler = locations.find((loc) => loc.id === 'wholesaler-location')!;
    expect(producer.isOpen).toBe(true);
    expect(wholesaler.isOpen).toBe(false);
  });
});
