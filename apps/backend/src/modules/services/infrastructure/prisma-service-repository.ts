import type { Service } from '@monopiston/contracts';
import type { DatabaseClient } from '@monopiston/database';

import type { ServiceRepository } from '../domain/service-repository.js';

export class PrismaServiceRepository implements ServiceRepository {
  constructor(private readonly database: DatabaseClient) {}

  async listActive(): Promise<Service[]> {
    const services = await this.database.services.findMany({
      orderBy: { name: 'asc' },
      where: { is_active: true },
    });

    return services.map((service) => ({
      code: service.code,
      currency: service.currency,
      description: service.description,
      durationMinutes: service.duration_minutes,
      id: service.id,
      name: service.name,
      price: service.price_cents,
    }));
  }
}
