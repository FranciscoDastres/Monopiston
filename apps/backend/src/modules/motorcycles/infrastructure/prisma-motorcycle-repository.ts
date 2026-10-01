import type {
  CreateMotorcycleInput,
  Motorcycle,
  UpdateMotorcycleInput,
} from '@monopiston/contracts';
import type { DatabaseClient } from '@monopiston/database';

import type { MotorcycleRepository } from '../domain/motorcycle-repository.js';

export class PrismaMotorcycleRepository implements MotorcycleRepository {
  constructor(private readonly database: DatabaseClient) {}

  async create(
    ownerUserId: string,
    input: CreateMotorcycleInput,
  ): Promise<Motorcycle> {
    const motorcycle = await this.database.motorcycles.create({
      data: {
        color: input.color ?? null,
        license_plate: input.licensePlate?.toUpperCase() ?? null,
        model_year: input.modelYear ?? null,
        nickname: input.nickname ?? null,
        notes: input.notes ?? null,
        odometer_km: input.odometerKm ?? null,
        owner_user_id: ownerUserId,
        vin: input.vin?.toUpperCase() ?? null,
      },
    });
    return mapMotorcycle(motorcycle);
  }

  async deactivate(ownerUserId: string, id: string): Promise<boolean> {
    const result = await this.database.motorcycles.updateMany({
      data: { is_active: false },
      where: { id, is_active: true, owner_user_id: ownerUserId },
    });
    return result.count === 1;
  }

  async listByOwner(ownerUserId: string): Promise<Motorcycle[]> {
    const motorcycles = await this.database.motorcycles.findMany({
      orderBy: { created_at: 'desc' },
      where: { is_active: true, owner_user_id: ownerUserId },
    });
    return motorcycles.map(mapMotorcycle);
  }

  async update(
    ownerUserId: string,
    id: string,
    input: UpdateMotorcycleInput,
  ): Promise<Motorcycle | null> {
    const result = await this.database.motorcycles.updateMany({
      data: {
        ...(input.color !== undefined && { color: input.color }),
        ...(input.licensePlate !== undefined && {
          license_plate: input.licensePlate.toUpperCase(),
        }),
        ...(input.modelYear !== undefined && { model_year: input.modelYear }),
        ...(input.nickname !== undefined && { nickname: input.nickname }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.odometerKm !== undefined && {
          odometer_km: input.odometerKm,
        }),
        ...(input.vin !== undefined && { vin: input.vin.toUpperCase() }),
      },
      where: { id, is_active: true, owner_user_id: ownerUserId },
    });
    if (result.count === 0) return null;

    const motorcycle = await this.database.motorcycles.findUniqueOrThrow({
      where: { id_owner_user_id: { id, owner_user_id: ownerUserId } },
    });
    return mapMotorcycle(motorcycle);
  }
}

function mapMotorcycle(motorcycle: {
  color: string | null;
  created_at: Date;
  id: string;
  license_plate: string | null;
  make: string;
  model: string;
  model_year: number | null;
  nickname: string | null;
  notes: string | null;
  odometer_km: number | null;
  updated_at: Date;
  vin: string | null;
}): Motorcycle {
  return {
    color: motorcycle.color,
    createdAt: motorcycle.created_at.toISOString(),
    id: motorcycle.id,
    licensePlate: motorcycle.license_plate,
    make: motorcycle.make,
    model: motorcycle.model,
    modelYear: motorcycle.model_year,
    nickname: motorcycle.nickname,
    notes: motorcycle.notes,
    odometerKm: motorcycle.odometer_km,
    updatedAt: motorcycle.updated_at.toISOString(),
    vin: motorcycle.vin,
  };
}
