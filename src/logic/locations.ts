import type {
  AdvancedLocationId,
  LocationCost,
  LocationId,
  LocationState,
  LocationType,
  PlayerCount,
} from '../types/game';

interface LocationConfig {
  readonly id: LocationId;
  readonly name: string;
  readonly type: LocationType;
  readonly costsByPlayerCount: Readonly<Record<PlayerCount, ReadonlyArray<LocationCost>>>;
  readonly startsOpen?: boolean;
}

const fixed = (amount: number): LocationCost => ({ kind: 'fixed', amount });
const planCost: LocationCost = { kind: 'planCost' };
const tempAgency: LocationCost = { kind: 'tempAgency' };

const CORE_LOCATIONS: ReadonlyArray<LocationConfig> = [
  {
    id: 'producer',
    name: 'Producer',
    type: 'core',
    costsByPlayerCount: {
      1: [fixed(1), fixed(1), fixed(1)],
      2: [fixed(1), fixed(1)],
      3: [fixed(1), fixed(1)],
      4: [fixed(1), fixed(1), fixed(1)],
    },
  },
  {
    id: 'supplier',
    name: 'Supplier',
    type: 'core',
    costsByPlayerCount: {
      1: [planCost, planCost],
      2: [planCost, planCost],
      3: [planCost, planCost],
      4: [planCost, planCost, planCost],
    },
  },
  {
    id: 'builder',
    name: 'Builder',
    type: 'core',
    costsByPlayerCount: {
      1: [fixed(2), fixed(2)],
      2: [fixed(2), fixed(2)],
      3: [fixed(2), fixed(2)],
      4: [fixed(2), fixed(2), fixed(2)],
    },
  },
  {
    id: 'leadership-council',
    name: 'Leadership Council',
    type: 'core',
    costsByPlayerCount: {
      1: [fixed(1)],
      2: [fixed(1)],
      3: [fixed(1)],
      4: [fixed(1)],
    },
  },
];

const DEED_LOCATIONS: ReadonlyArray<LocationConfig> = [
  {
    id: 'wholesaler-location',
    name: 'Wholesaler',
    type: 'deed',
    costsByPlayerCount: {
      1: [fixed(1)],
      2: [fixed(1)],
      3: [fixed(1)],
      4: [fixed(1)],
    },
    startsOpen: false,
  },
  {
    id: 'lotto-location',
    name: 'Lotto',
    type: 'deed',
    costsByPlayerCount: {
      1: [fixed(3)],
      2: [fixed(3)],
      3: [fixed(3)],
      4: [fixed(3)],
    },
    startsOpen: false,
  },
];

const ADVANCED_LOCATIONS: ReadonlyArray<LocationConfig> = [
  {
    id: 'crowdfunder',
    name: 'Crowdfunder',
    type: 'advanced',
    costsByPlayerCount: {
      1: [fixed(1)],
      2: [fixed(1)],
      3: [fixed(1)],
      4: [fixed(1)],
    },
  },
  {
    id: 'recycler',
    name: 'Recycler',
    type: 'advanced',
    costsByPlayerCount: {
      1: [fixed(1)],
      2: [fixed(1)],
      3: [fixed(1)],
      4: [fixed(1)],
    },
  },
  {
    id: 'temp-agency',
    name: 'Temp Agency',
    type: 'advanced',
    costsByPlayerCount: {
      1: [tempAgency],
      2: [tempAgency],
      3: [tempAgency],
      4: [tempAgency],
    },
  },
  {
    id: 'swap-meet',
    name: 'Swap Meet',
    type: 'advanced',
    costsByPlayerCount: {
      1: [fixed(2)],
      2: [fixed(2)],
      3: [fixed(2)],
      4: [fixed(2)],
    },
  },
];

export function getAdvancedLocationConfigs(): ReadonlyArray<LocationConfig> {
  return ADVANCED_LOCATIONS;
}

export function buildLocations(
  boardPlayerCount: PlayerCount,
  advancedLocations: ReadonlyArray<AdvancedLocationId>,
  soloMode: boolean,
): ReadonlyArray<LocationState> {
  const core = CORE_LOCATIONS.map((config) => toLocationState(config, boardPlayerCount));
  const deeds = DEED_LOCATIONS.map((config) => toLocationState(config, boardPlayerCount));
  const advanced = ADVANCED_LOCATIONS.filter((config) =>
    advancedLocations.includes(config.id as AdvancedLocationId),
  ).map((config) => toLocationState(config, boardPlayerCount));

  if (soloMode) {
    const order: LocationId[] = [
      'producer',
      'wholesaler-location',
      'builder',
      'supplier',
      'leadership-council',
      'lotto-location',
    ];
    if (advanced.length > 0) {
      order.push(advanced[0].id);
    }
    const map = new Map<LocationId, LocationState>(
      [...core, ...deeds, ...advanced].map((loc) => [loc.id, loc]),
    );
    return order.map((id) => map.get(id)!).filter(Boolean);
  }

  return [...core, ...deeds, ...advanced];
}

function toLocationState(config: LocationConfig, playerCount: PlayerCount): LocationState {
  return {
    id: config.id,
    name: config.name,
    type: config.type,
    isOpen: config.type !== 'deed' ? true : config.startsOpen === true,
    ownerId: undefined,
    spaces: config.costsByPlayerCount[playerCount].map((cost) => ({
      cost,
      occupiedBy: undefined,
      mints: 0,
    })),
  };
}
