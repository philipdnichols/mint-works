import type { BuildingState, PlanDefinition, PlanId, PlanTag, PlayerState } from '../types/game';

export const PLAN_DEFINITIONS: ReadonlyArray<PlanDefinition> = [
  { id: 'assembler', name: 'Assembler', cost: 5, tag: 'Utility', stars: 1 },
  { id: 'gardens', name: 'Gardens', cost: 3, tag: 'Culture', stars: 3 },
  { id: 'statue', name: 'Statue', cost: 2, tag: 'Culture', stars: 2 },
  { id: 'bridge', name: 'Bridge', cost: 1, tag: 'Culture', stars: 0 },
  { id: 'landfill', name: 'Landfill', cost: 3, tag: 'Utility', stars: 3 },
  { id: 'stripmine', name: 'Stripmine', cost: 4, tag: 'Production', stars: 0 },
  { id: 'coop', name: 'Co-Op', cost: 1, tag: 'Production', stars: 1 },
  { id: 'truck', name: 'Truck', cost: 2, tag: 'Utility', stars: 1 },
  { id: 'corporate-hq', name: 'Corporate HQ', cost: 3, tag: 'Production', stars: 0 },
  { id: 'mine', name: 'Mine', cost: 2, tag: 'Production', stars: 1 },
  { id: 'vault', name: 'Vault', cost: 5, tag: 'Utility', stars: 'var' },
  { id: 'crane', name: 'Crane', cost: 2, tag: 'Utility', stars: 1 },
  { id: 'museum', name: 'Museum', cost: 2, tag: 'Culture', stars: 'var' },
  { id: 'factory', name: 'Factory', cost: 4, tag: 'Production', stars: 3 },
  { id: 'obelisk', name: 'Obelisk', cost: 4, tag: 'Utility', stars: 'var' },
  { id: 'windmill', name: 'Windmill', cost: 1, tag: 'Culture', stars: 1 },
  { id: 'gallery', name: 'Gallery', cost: 4, tag: 'Culture', stars: 'var' },
  { id: 'wholesaler', name: 'Wholesaler', cost: 1, tag: 'Deed', stars: 1 },
  { id: 'plant', name: 'Plant', cost: 5, tag: 'Production', stars: 2 },
  { id: 'workshop', name: 'Workshop', cost: 3, tag: 'Production', stars: 2 },
  { id: 'lotto', name: 'Lotto', cost: 4, tag: 'Deed', stars: 2 },
];

const PLAN_EFFECTS: Record<PlanId, string> = {
  assembler:
    'Automatically build Plans you gain from the Supplier without using the Builder (including Deed openings).',
  gardens: 'No special effect.',
  statue: 'No special effect.',
  bridge: 'Counts as two Culture buildings in all scenarios.',
  landfill: 'You gain one fewer star from each Culture building (minimum 0).',
  stripmine: 'Upkeep: Gain 3 mints.',
  coop: 'Upkeep: Gain 1 mint and choose another player to gain 1 mint.',
  truck: 'You pay 1 mint less at the Supplier (minimum 1).',
  'corporate-hq': 'Upkeep: Gain 1 mint per building in your neighborhood (includes itself).',
  mine: 'Upkeep: Gain 1 mint.',
  vault: 'Stars: 2 per face-down plan in your neighborhood.',
  crane: 'Pay 1 mint less at the Builder (Builder costs 1 for you).',
  museum: 'Stars equal to your culture buildings (Bridge counts twice).',
  factory: 'Upkeep: Gain 1 mint.',
  obelisk: 'Stars equal to your face-up buildings (includes itself).',
  windmill: 'No special effect.',
  gallery: 'Upkeep: Store 1 mint on Gallery. Stars equal stored mints.',
  wholesaler: 'You become the owner of the Wholesaler location.',
  plant: 'Upkeep: Gain 2 mints.',
  workshop: 'Upkeep: Gain 1 mint.',
  lotto: 'You become the owner of the Lotto location.',
};

const PLAN_MAP: ReadonlyMap<PlanId, PlanDefinition> = new Map(
  PLAN_DEFINITIONS.map((plan) => [plan.id, plan]),
);

export function getPlanDefinition(planId: PlanId): PlanDefinition {
  const plan = PLAN_MAP.get(planId);
  if (!plan) {
    throw new Error(`Unknown plan id: ${planId}`);
  }
  return plan;
}

export function isPlanTag(planId: PlanId, tag: PlanTag): boolean {
  return getPlanDefinition(planId).tag === tag;
}

export function isCulturePlan(planId: PlanId): boolean {
  return isPlanTag(planId, 'Culture');
}

export function isDeedPlan(planId: PlanId): boolean {
  return isPlanTag(planId, 'Deed');
}

export function isProductionPlan(planId: PlanId): boolean {
  return isPlanTag(planId, 'Production');
}

export interface PlanStarInfo {
  readonly label: string;
  readonly hint?: string;
}

export function getPlanStarInfo(planId: PlanId): PlanStarInfo {
  const plan = getPlanDefinition(planId);
  if (plan.stars !== 'var') {
    return { label: String(plan.stars) };
  }

  switch (planId) {
    case 'vault':
      return { label: 'variable', hint: '2 stars per plan in hand.' };
    case 'museum':
      return {
        label: 'variable',
        hint: 'Stars equal to your culture buildings (Bridge counts twice), minus Landfills.',
      };
    case 'obelisk':
      return { label: 'variable', hint: '1 star per building.' };
    case 'gallery':
      return { label: 'variable', hint: 'Stars equal to mints stored on the Gallery.' };
    default:
      return { label: 'variable' };
  }
}

export function getPlanEffect(planId: PlanId): string {
  return PLAN_EFFECTS[planId];
}

export function countLandfills(buildings: ReadonlyArray<BuildingState>): number {
  return buildings.filter((b) => b.planId === 'landfill').length;
}

export function countCultureBuildings(buildings: ReadonlyArray<BuildingState>): number {
  return buildings.reduce((count, building) => {
    if (!isCulturePlan(building.planId)) return count;
    if (building.planId === 'bridge') return count + 2;
    return count + 1;
  }, 0);
}

export function countBuildings(buildings: ReadonlyArray<BuildingState>): number {
  return buildings.length;
}

export function applyCulturePenalty(stars: number, landfillCount: number): number {
  return Math.max(0, stars - landfillCount);
}

export function getGalleryStoredMints(buildings: ReadonlyArray<BuildingState>): number {
  return buildings.find((b) => b.planId === 'gallery')?.storedMints ?? 0;
}

export function getBuildingStars(building: BuildingState, player: PlayerState): number {
  const definition = getPlanDefinition(building.planId);
  const landfillCount = countLandfills(player.buildings);

  let baseStars: number;
  switch (building.planId) {
    case 'vault':
      baseStars = player.plans.length * 2;
      break;
    case 'museum':
      baseStars = countCultureBuildings(player.buildings);
      break;
    case 'obelisk':
      baseStars = countBuildings(player.buildings);
      break;
    case 'gallery':
      baseStars = building.storedMints;
      break;
    default:
      baseStars = definition.stars as number;
      break;
  }

  if (isCulturePlan(building.planId)) {
    return applyCulturePenalty(baseStars, landfillCount);
  }

  return baseStars;
}

export interface BuildingStarBreakdown {
  readonly total: number;
  readonly base: number;
  readonly baseLabel: string;
  readonly landfillPenalty: number;
  readonly landfillCount: number;
  readonly isCulture: boolean;
}

export function getBuildingStarBreakdown(
  building: BuildingState,
  player: PlayerState,
): BuildingStarBreakdown {
  const definition = getPlanDefinition(building.planId);
  const landfillCount = countLandfills(player.buildings);
  let baseStars = 0;
  let baseLabel = '';

  switch (building.planId) {
    case 'vault':
      baseStars = player.plans.length * 2;
      baseLabel = `${player.plans.length} plan(s) x2`;
      break;
    case 'museum': {
      const cultureCount = countCultureBuildings(player.buildings);
      baseStars = cultureCount;
      baseLabel = `${cultureCount} culture building(s)`;
      break;
    }
    case 'obelisk': {
      const buildingCount = countBuildings(player.buildings);
      baseStars = buildingCount;
      baseLabel = `${buildingCount} building(s)`;
      break;
    }
    case 'gallery':
      baseStars = building.storedMints;
      baseLabel = `${building.storedMints} stored mint(s)`;
      break;
    default:
      baseStars = definition.stars as number;
      baseLabel = 'Printed stars';
      break;
  }

  if (isCulturePlan(building.planId)) {
    const total = applyCulturePenalty(baseStars, landfillCount);
    const penalty = Math.min(baseStars, landfillCount);
    return {
      total,
      base: baseStars,
      baseLabel,
      landfillPenalty: penalty,
      landfillCount,
      isCulture: true,
    };
  }

  return {
    total: baseStars,
    base: baseStars,
    baseLabel,
    landfillPenalty: 0,
    landfillCount,
    isCulture: false,
  };
}

export function getPlayerTotalStars(player: PlayerState): number {
  return player.buildings.reduce((sum, building) => sum + getBuildingStars(building, player), 0);
}

export function getNeighborhoodSize(player: PlayerState): number {
  const buildingCount = player.buildings.reduce((count, building) => {
    if (building.planId === 'bridge') return count + 2;
    return count + 1;
  }, 0);
  return buildingCount + player.plans.length;
}

export function getPlanCost(planId: PlanId): number {
  return getPlanDefinition(planId).cost;
}
