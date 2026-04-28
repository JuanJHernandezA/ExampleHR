# Time-Off Microservice (NestJS + SQLite)

Backend service for managing time-off requests and synchronizing balances with an HCM source of truth.

## Tech Stack

- NestJS
- SQLite (`sqlite` + `sqlite3`)
- Jest + Supertest

## Features Implemented (MVP)

- Time-off lifecycle:
  - `PENDING -> APPROVED`
  - `PENDING -> REJECTED`
  - `PENDING -> CANCELLED`
- Balance management per `employeeId + locationId`
- Local invariants and defensive validation
- Realtime HCM sync endpoint
- Batch HCM sync endpoint
- Idempotency for request creation via `Idempotency-Key`
- Duplicate batch protection (`DUPLICATE_BATCH_ID`)
- Reconciliation stale checks:
  - by `hcmVersion`
  - by `hcmUpdatedAt` when version is missing
- Dev bootstrap behavior:
  - employees/locations are created lazily when HCM sync endpoints receive data

## API Endpoints

- `GET /balances/:employeeId/:locationId`
- `POST /time-off-requests`
- `POST /time-off-requests/:id/approve`
- `POST /time-off-requests/:id/reject`
- `POST /time-off-requests/:id/cancel`
- `POST /sync/hcm/realtime`
- `POST /sync/hcm/batch`

### Status Code Policy

- `200`: read and state transitions (`approve/reject/cancel`)
- `201`: resource creation (`POST /time-off-requests`)
- `202`: accepted sync processing (`/sync/hcm/realtime`, `/sync/hcm/batch`)
- `409`: business conflicts (insufficient balance, stale version, idempotency conflict, duplicate batch)

## Project Structure

- `src/database.service.ts`: SQLite connection and schema bootstrap
- `src/timeoff/timeoff.controller.ts`: REST endpoints
- `src/timeoff/timeoff.service.ts`: business logic, transactions, sync rules
- `src/timeoff/timeoff.dto.ts`: request DTOs and validation
- `test/app.e2e-spec.ts`: e2e scenarios
- `src/timeoff/timeoff.service.spec.ts`: unit scenarios

## Run Locally

```bash
npm install
npm run start:dev
```

Server starts on:
- `http://localhost:3000`

Optional environment variable:
- `DB_PATH` (defaults to `timeoff.db`)

## Tests

```bash
# unit
npm run test -- --runInBand

# e2e
npm run test:e2e -- --runInBand

# coverage
npm run test:cov -- --runInBand
```

## Example Requests (All Endpoints)

### 1) Realtime HCM Sync

```bash
curl -X POST http://localhost:3000/sync/hcm/realtime \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId":"emp_1",
    "locationId":"mx",
    "availableDays":10,
    "consumedDays":0,
    "hcmVersion":1,
    "eventId":"evt-1"
  }'
```

### 2) Batch HCM Sync

```bash
curl -X POST http://localhost:3000/sync/hcm/batch \
  -H "Content-Type: application/json" \
  -d '{
    "batchId":"batch-2026-04-28-1",
    "generatedAt":"2026-04-28T12:00:00Z",
    "records":[
      {
        "employeeId":"emp_1",
        "locationId":"mx",
        "availableDays":10,
        "consumedDays":0,
        "hcmVersion":2,
        "hcmUpdatedAt":"2026-04-28T12:00:00Z"
      }
    ]
  }'
```

### 3) Create Time-Off Request

```bash
curl -X POST http://localhost:3000/time-off-requests \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: key-123" \
  -d '{
    "employeeId":"emp_1",
    "locationId":"mx",
    "daysRequested":2
  }'
```

### 4) List All Time-Off Requests

```bash
curl http://localhost:3000/time-off-requests
```

### 5) Get Time-Off Request by ID

```bash
curl http://localhost:3000/time-off-requests/<REQUEST_ID>
```

### 6) Approve Time-Off Request

```bash
curl -X POST http://localhost:3000/time-off-requests/<REQUEST_ID>/approve \
  -H "Content-Type: application/json" \
  -d '{
    "managerId":"mgr_1"
  }'
```

### 7) Reject Time-Off Request

```bash
curl -X POST http://localhost:3000/time-off-requests/<REQUEST_ID>/reject \
  -H "Content-Type: application/json" \
  -d '{
    "managerId":"mgr_1",
    "reason":"Capacity constraints"
  }'
```

### 8) Cancel Time-Off Request

```bash
curl -X POST http://localhost:3000/time-off-requests/<REQUEST_ID>/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "actorId":"emp_1",
    "reason":"No longer needed"
  }'
```

### 9) Get Balance by Employee and Location

```bash
curl http://localhost:3000/balances/emp_1/mx
```
