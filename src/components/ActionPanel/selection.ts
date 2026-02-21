import type { LocationId, PlanId } from '../../types/game';

export interface SelectionState {
  locationId: LocationId | '';
  spaceIndex: number | null;
  supplierPlanId: PlanId | '';
  builderPlanId: PlanId | '';
  recyclePlanId: PlanId | '';
  recycleFrom: 'plan' | 'building';
  swapGiveId: PlanId | '';
  swapTakeId: PlanId | '';
  tempTargetLocationId: LocationId | '';
  tempSupplierPlanId: PlanId | '';
  tempBuilderPlanId: PlanId | '';
  tempRecyclePlanId: PlanId | '';
  tempRecycleFrom: 'plan' | 'building';
  tempSwapGiveId: PlanId | '';
  tempSwapTakeId: PlanId | '';
}

export const initialSelection: SelectionState = {
  locationId: '',
  spaceIndex: null,
  supplierPlanId: '',
  builderPlanId: '',
  recyclePlanId: '',
  recycleFrom: 'plan',
  swapGiveId: '',
  swapTakeId: '',
  tempTargetLocationId: '',
  tempSupplierPlanId: '',
  tempBuilderPlanId: '',
  tempRecyclePlanId: '',
  tempRecycleFrom: 'plan',
  tempSwapGiveId: '',
  tempSwapTakeId: '',
};
