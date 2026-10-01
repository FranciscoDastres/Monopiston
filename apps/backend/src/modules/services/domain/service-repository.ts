import type { Service } from '@monopiston/contracts';

export interface ServiceRepository {
  listActive(): Promise<Service[]>;
}
