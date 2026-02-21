import type { AiId, PlanTag } from '../types/game';

export interface AiProfile {
  readonly id: AiId;
  readonly name: string;
  readonly title: string;
  readonly startingMints: number | 'unlimited';
  readonly traits: ReadonlyArray<string>;
  readonly costPriority: 'low' | 'high';
  readonly typePriority: ReadonlyArray<PlanTag>;
}

const AI_PROFILES: Record<AiId, AiProfile> = {
  justin: {
    id: 'justin',
    name: 'Justin',
    title: 'The Game Designer',
    startingMints: 3,
    traits: ['Locks the last used location until the next Development phase.'],
    costPriority: 'low',
    typePriority: ['Utility', 'Deed', 'Production', 'Culture'],
  },
  rachael: {
    id: 'rachael',
    name: 'Rachael',
    title: 'The Keeper',
    startingMints: 5,
    traits: [
      'Mint supply is limited to 30.',
      'Supplier mints used by Rachael leave the game during Upkeep.',
      'Rachael wins if the Mint Supply is ever empty.',
    ],
    costPriority: 'high',
    typePriority: ['Production', 'Culture', 'Utility', 'Deed'],
  },
  sonic: {
    id: 'sonic',
    name: 'Sonic',
    title: 'The Cuteness',
    startingMints: 5,
    traits: [
      'Takes two turns in a row.',
      'Only uses Supplier if it has zero face-down Plans at the start of its turn.',
    ],
    costPriority: 'high',
    typePriority: ['Culture', 'Production', 'Utility', 'Deed'],
  },
  mort: {
    id: 'mort',
    name: 'Mort',
    title: 'The Mint Tycoon',
    startingMints: 'unlimited',
    traits: [
      'Unlimited Mint tokens (use the Supply when placing for Mort).',
      'Ignores income during Upkeep.',
      'Will not buy Production Plans from the Supplier.',
    ],
    costPriority: 'high',
    typePriority: ['Utility', 'Deed', 'Culture', 'Production'],
  },
};

export function getAiProfile(aiId?: AiId): AiProfile | null {
  if (!aiId) return null;
  return AI_PROFILES[aiId] ?? null;
}

export function getAiTypePriority(aiId?: AiId): ReadonlyArray<PlanTag> {
  return getAiProfile(aiId)?.typePriority ?? ['Utility', 'Deed', 'Production', 'Culture'];
}

export function getAiCostPriority(aiId?: AiId): 'low' | 'high' {
  return getAiProfile(aiId)?.costPriority ?? 'low';
}

export function aiSkipsSupplierWithPlans(aiId?: AiId): boolean {
  return aiId === 'sonic';
}

export function aiAvoidsProduction(aiId?: AiId): boolean {
  return aiId === 'mort';
}
