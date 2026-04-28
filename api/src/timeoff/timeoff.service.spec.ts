import { Test, TestingModule } from '@nestjs/testing';
import { rmSync } from 'fs';
import { AppModule } from '../app.module';
import { TimeoffService } from './timeoff.service';

describe('TimeoffService', () => {
  let service: TimeoffService;
  let testingModule: TestingModule;
  const dbPath = 'unit-timeoff.db';

  beforeEach(async () => {
    try {
      rmSync(dbPath);
    } catch {
      // no-op
    }
    process.env.DB_PATH = dbPath;
    testingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await testingModule.init();
    service = testingModule.get(TimeoffService);
  });

  afterEach(async () => {
    await testingModule.close();
    try {
      rmSync(dbPath);
    } catch {
      // no-op
    }
  });

  it('enforces idempotency for request creation', async () => {
    await service.syncRealtime({
      employeeId: 'emp_u1',
      locationId: 'loc_1',
      availableDays: 10,
      consumedDays: 0,
      hcmVersion: 1,
      eventId: 'u_evt_1',
    });

    const first = await service.createRequest(
      { employeeId: 'emp_u1', locationId: 'loc_1', daysRequested: 1 },
      'idem-1',
    );
    const second = await service.createRequest(
      { employeeId: 'emp_u1', locationId: 'loc_1', daysRequested: 1 },
      'idem-1',
    );
    expect(second).toEqual(first);
  });

  it('rejects stale realtime updates by timestamp when version is missing', async () => {
    await service.syncRealtime({
      employeeId: 'emp_u2',
      locationId: 'loc_2',
      availableDays: 10,
      consumedDays: 0,
      hcmUpdatedAt: '2026-01-02T00:00:00.000Z',
      eventId: 'u_evt_2',
    });

    await expect(
      service.syncRealtime({
        employeeId: 'emp_u2',
        locationId: 'loc_2',
        availableDays: 9,
        consumedDays: 1,
        hcmUpdatedAt: '2026-01-01T00:00:00.000Z',
        eventId: 'u_evt_3',
      }),
    ).rejects.toThrow('STALE_VERSION');
  });
});
