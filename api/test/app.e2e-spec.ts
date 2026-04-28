import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { rmSync } from 'fs';

describe('Timeoff API (e2e)', () => {
  let app: INestApplication<App>;
  const dbPath = 'test-timeoff.db';

  beforeEach(async () => {
    try {
      rmSync(dbPath);
    } catch {
      // no-op
    }
    process.env.DB_PATH = dbPath;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('creates balance via sync and returns it', async () => {
    await request(app.getHttpServer()).post('/sync/hcm/realtime').send({
      employeeId: 'emp_1',
      locationId: 'mx',
      availableDays: 10,
      consumedDays: 0,
      hcmVersion: 1,
      eventId: 'evt-1',
    }).expect(202);

    await request(app.getHttpServer())
      .get('/balances/emp_1/mx')
      .expect(200)
      .expect((res) => {
        expect(res.body.availableDays).toBe(10);
        expect(res.body.reservedDays).toBe(0);
      });
  });

  it('creates and approves a request', async () => {
    await request(app.getHttpServer()).post('/sync/hcm/realtime').send({
      employeeId: 'emp_2',
      locationId: 'mx',
      availableDays: 5,
      consumedDays: 0,
      hcmVersion: 1,
      eventId: 'evt-2',
    }).expect(202);

    const created = await request(app.getHttpServer())
      .post('/time-off-requests')
      .set('Idempotency-Key', 'key-123')
      .send({
        employeeId: 'emp_2',
        locationId: 'mx',
        daysRequested: 2,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/time-off-requests/${created.body.id}/approve`)
      .send({ managerId: 'manager_1' })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/time-off-requests/${created.body.id}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('APPROVED');
      });

    return request(app.getHttpServer())
      .get('/balances/emp_2/mx')
      .expect(200)
      .expect((res) => {
        expect(res.body.consumedDays).toBe(2);
      });
  });

  it('lists existing requests', async () => {
    await request(app.getHttpServer())
      .post('/sync/hcm/realtime')
      .send({
        employeeId: 'emp_list',
        locationId: 'mx',
        availableDays: 5,
        consumedDays: 0,
        hcmVersion: 1,
        eventId: 'evt-list',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/time-off-requests')
      .send({
        employeeId: 'emp_list',
        locationId: 'mx',
        daysRequested: 1,
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/time-off-requests')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
      });
  });

  it('returns conflict when idempotency key is reused with different payload', async () => {
    await request(app.getHttpServer()).post('/sync/hcm/realtime').send({
      employeeId: 'emp_3',
      locationId: 'mx',
      availableDays: 10,
      consumedDays: 0,
      hcmVersion: 1,
      eventId: 'evt-3',
    }).expect(202);

    await request(app.getHttpServer())
      .post('/time-off-requests')
      .set('Idempotency-Key', 'dup-key')
      .send({
        employeeId: 'emp_3',
        locationId: 'mx',
        daysRequested: 1,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/time-off-requests')
      .set('Idempotency-Key', 'dup-key')
      .send({
        employeeId: 'emp_3',
        locationId: 'mx',
        daysRequested: 2,
      })
      .expect(409);
  });

  it('returns conflict on duplicate batch id', async () => {
    const payload = {
      batchId: 'batch-1',
      generatedAt: '2026-04-27T21:00:00Z',
      records: [
        {
          employeeId: 'emp_4',
          locationId: 'mx',
          availableDays: 10,
          consumedDays: 0,
          hcmVersion: 1,
          hcmUpdatedAt: '2026-04-27T21:00:00Z',
        },
      ],
    };

    await request(app.getHttpServer()).post('/sync/hcm/batch').send(payload).expect(202);
    await request(app.getHttpServer()).post('/sync/hcm/batch').send(payload).expect(409);
  });

  it('returns not found for unknown balance', async () => {
    await request(app.getHttpServer()).get('/balances/missing/mx').expect(404);
  });

  it('returns insufficient balance conflict', async () => {
    await request(app.getHttpServer())
      .post('/sync/hcm/realtime')
      .send({
        employeeId: 'emp_5',
        locationId: 'mx',
        availableDays: 1,
        consumedDays: 0,
        hcmVersion: 1,
        eventId: 'evt-5',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/time-off-requests')
      .send({
        employeeId: 'emp_5',
        locationId: 'mx',
        daysRequested: 2,
      })
      .expect(409);
  });

  it('returns invalid transition when approving twice', async () => {
    await request(app.getHttpServer())
      .post('/sync/hcm/realtime')
      .send({
        employeeId: 'emp_6',
        locationId: 'mx',
        availableDays: 5,
        consumedDays: 0,
        hcmVersion: 1,
        eventId: 'evt-6',
      })
      .expect(202);

    const created = await request(app.getHttpServer())
      .post('/time-off-requests')
      .send({
        employeeId: 'emp_6',
        locationId: 'mx',
        daysRequested: 1,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/time-off-requests/${created.body.id}/approve`)
      .send({ managerId: 'manager_1' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/time-off-requests/${created.body.id}/approve`)
      .send({ managerId: 'manager_1' })
      .expect(409);
  });

  it('returns stale version conflict on older realtime version', async () => {
    await request(app.getHttpServer())
      .post('/sync/hcm/realtime')
      .send({
        employeeId: 'emp_7',
        locationId: 'mx',
        availableDays: 8,
        consumedDays: 0,
        hcmVersion: 5,
        eventId: 'evt-7',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/sync/hcm/realtime')
      .send({
        employeeId: 'emp_7',
        locationId: 'mx',
        availableDays: 7,
        consumedDays: 1,
        hcmVersion: 4,
        eventId: 'evt-8',
      })
      .expect(409);
  });

  afterEach(async () => {
    await app.close();
    try {
      rmSync(dbPath);
    } catch {
      // no-op
    }
  });
});
