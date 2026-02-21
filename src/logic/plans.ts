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
