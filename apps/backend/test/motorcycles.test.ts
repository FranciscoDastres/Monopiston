import type {
  CreateMotorcycleInput,
  Motorcycle,
  UpdateMotorcycleInput,
} from '@monopiston/contracts';

import { buildApp } from '../src/app.js';
import { SessionService } from '../src/modules/auth/application/session-service.js';
import type { MotorcycleRepository } from '../src/modules/motorcycles/domain/motorcycle-repository.js';
import { MemoryAuthRepository } from './helpers/memory-auth-repository.js';

const motorcycle: Motorcycle = {
  color: 'Rojo',
  createdAt: '2026-06-20T00:00:00.000Z',
  id: '0ed4fc0c-ea93-4dc7-9af0-cba493e67491',
  licensePlate: 'ABCD12',
  make: 'Honda',
  model: 'NAVI',
  modelYear: 2024,
  nickname: 'La Roja',
  notes: null,
  odometerKm: 1200,
  updatedAt: '2026-06-20T00:00:00.000Z',
  vin: null,
};

class MemoryMotorcycleRepository implements MotorcycleRepository {
  async create(
    _ownerUserId: string,
    input: CreateMotorcycleInput,
  ): Promise<Motorcycle> {
    return mergeMotorcycle(input);
  }

  async deactivate(_ownerUserId: string, _id: string): Promise<boolean> {
    return true;
  }

  async listByOwner(_ownerUserId: string): Promise<Motorcycle[]> {
    return [motorcycle];
  }

  async update(
    _ownerUserId: string,
    _id: string,
    input: UpdateMotorcycleInput,
  ): Promise<Motorcycle> {
    return mergeMotorcycle(input);
  }
}

function mergeMotorcycle(
  input: CreateMotorcycleInput | UpdateMotorcycleInput,
): Motorcycle {
  return {
    ...motorcycle,
    color: input.color ?? motorcycle.color,
    licensePlate: input.licensePlate ?? motorcycle.licensePlate,
    modelYear: input.modelYear ?? motorcycle.modelYear,
    nickname: input.nickname ?? motorcycle.nickname,
    notes: input.notes ?? motorcycle.notes,
    odometerKm: input.odometerKm ?? motorcycle.odometerKm,
    vin: input.vin ?? motorcycle.vin,
  };
}

describe('motorcycle routes', () => {
  it('lists only through an authenticated session', async () => {
    const auth = new MemoryAuthRepository();
    const app = await createApp(auth);

    const response = await app.inject({
      headers: { cookie: 'drp_session=test-session' },
      method: 'GET',
      url: '/v1/motorcycles',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([motorcycle]);
    await app.close();
  });

  it('validates and creates a Honda NAVI for the current owner', async () => {
    const app = await createApp(new MemoryAuthRepository());
    const response = await app.inject({
      headers: {
        cookie: 'drp_session=test-session',
        origin: 'http://localhost:5173',
      },
      method: 'POST',
      payload: {
        color: 'Rojo',
        licensePlate: 'abcd12',
        modelYear: 2024,
        nickname: 'La Roja',
        odometerKm: 1200,
      },
      url: '/v1/motorcycles',
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ make: 'Honda', model: 'NAVI' });
    await app.close();
  });
});

async function createApp(auth: MemoryAuthRepository) {
  return buildApp({
    appOrigin: 'http://localhost:5173',
    checkDatabase: async () => undefined,
    logger: false,
    motorcycles: {
      appOrigin: 'http://localhost:5173',
      repository: new MemoryMotorcycleRepository(),
      sessions: new SessionService(auth),
    },
  });
}
