import type {
  CreateMotorcycleInput,
  Motorcycle,
  UpdateMotorcycleInput,
} from '@monopiston/contracts';

export interface MotorcycleRepository {
  create(
    ownerUserId: string,
    input: CreateMotorcycleInput,
  ): Promise<Motorcycle>;
  deactivate(ownerUserId: string, id: string): Promise<boolean>;
  listByOwner(ownerUserId: string): Promise<Motorcycle[]>;
  update(
    ownerUserId: string,
    id: string,
    input: UpdateMotorcycleInput,
  ): Promise<Motorcycle | null>;
}
