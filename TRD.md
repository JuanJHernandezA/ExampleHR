# Time-Off Microservice TRD

## 1. Purpose

Build a backend microservice for ExampleHR to manage time-off requests while keeping balances aligned with HCM (source of truth).

This document is intentionally concise for a technical assessment and focuses on implementation-critical decisions.

## 2. Scope

### In Scope
- Time-off request lifecycle (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`)
- Balance management per `employeeId + locationId`
- HCM synchronization via:
  - Realtime updates
  - Batch balance ingestion
- Defensive validation and idempotency
- Test suite with HCM mock endpoints

### Out of Scope (MVP)
- Frontend/UI
- Multi-HCM production adapters
- Advanced regional policy engines

## 3. Core Requirements

- Never approve requests that violate local balance invariants.
- Keep local state convergent with HCM after retries and/or batch sync.
- Ensure idempotent behavior for external and client retries.
- Preserve auditability for every balance-impacting operation.

## 4. Domain Model

### Entities
- `Employee(id, status)`
- `Location(id, name)`
- `TimeOffBalance(employeeId, locationId, availableDays, reservedDays, consumedDays, hcmVersion, hcmUpdatedAt, updatedAt)`
- `TimeOffRequest(id, employeeId, locationId, daysRequested, status, managerId, idempotencyKey, requestedAt, decidedAt)`
- `SyncEvent(id, direction, type, batchId, employeeId, locationId, payloadHash, status, errorMessage, attemptCount, createdAt)`
- `IdempotencyRecord(operationName, idempotencyKey, requestHash, responseStatusCode, responseBody, expiresAt)`

### Invariants
- `availableDays >= 0`
- `reservedDays >= 0`
- `consumedDays >= 0`
- One balance row per `employeeId + locationId`
- Final request states are immutable
- Same idempotency key + same operation must not produce duplicate effects

## 5. Lifecycle Rules

- `PENDING -> APPROVED`
- `PENDING -> REJECTED`
- `PENDING -> CANCELLED`

No transitions are allowed from terminal states.

Balance movement policy:
- On create (`PENDING`): reserve days (`reserved += daysRequested`)
- On approve: consume reserved days (`reserved -= daysRequested`, `consumed += daysRequested`)
- On reject/cancel: release reserved days (`reserved -= daysRequested`)

## 6. Architecture

### Logical Components
- **API Layer (NestJS Controllers):** validation, DTOs, HTTP contracts
- **Application Layer:** request and sync use cases
- **Domain Layer:** invariants and state transitions
- **Persistence Layer (SQLite):** repositories + transactions
- **HCM Adapter:** realtime outbound/inbound + batch ingestion
- **Reconciliation Engine:** version-based conflict handling

### Consistency Model
- Hybrid approach:
  - Synchronous local write for fast user response
  - Eventual convergence with HCM through retries and batch reconciliation

## 7. Sync and Reconciliation Strategy

### Version Resolution
1. Prefer monotonic `hcmVersion`
2. Fallback to `hcmUpdatedAt` (LWW) when version is unavailable

### Conflict Rules
- If incoming version is newer: apply
- If equal: idempotent no-op
- If older: discard

### Defensive Behavior
- Reject invalid dimensions/payloads
- Record failed sync events without crashing full batch processing
- Keep retries for transient HCM failures

## 8. SQLite Schema (MVP)

```sql
CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE time_off_balances (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  available_days INTEGER NOT NULL CHECK (available_days >= 0),
  reserved_days INTEGER NOT NULL CHECK (reserved_days >= 0),
  consumed_days INTEGER NOT NULL DEFAULT 0 CHECK (consumed_days >= 0),
  hcm_version INTEGER,
  hcm_updated_at TEXT,
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (location_id) REFERENCES locations(id),
  UNIQUE (employee_id, location_id)
);

CREATE TABLE time_off_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  manager_id TEXT,
  days_requested INTEGER NOT NULL CHECK (days_requested > 0),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  idempotency_key TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  decided_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE sync_events (
  id TEXT PRIMARY KEY,
  direction TEXT NOT NULL CHECK (direction IN ('INBOUND_HCM', 'OUTBOUND_HCM')),
  type TEXT NOT NULL CHECK (type IN ('REALTIME', 'BATCH')),
  batch_id TEXT,
  employee_id TEXT,
  location_id TEXT,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RECEIVED', 'APPLIED', 'FAILED')),
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE idempotency_records (
  id TEXT PRIMARY KEY,
  operation_name TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status_code INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  UNIQUE (operation_name, idempotency_key)
);
```

Recommended indexes:
- `time_off_balances(employee_id, location_id)`
- `time_off_requests(employee_id, location_id, status)`
- `sync_events(status, type, created_at)`
- `sync_events(batch_id)`
- `idempotency_records(expires_at)`

## 9. API Contracts (MVP)

- `GET /balances/:employeeId/:locationId`
- `POST /time-off-requests`
- `POST /time-off-requests/:id/approve`
- `POST /time-off-requests/:id/reject`
- `POST /time-off-requests/:id/cancel`
- `POST /sync/hcm/realtime`
- `POST /sync/hcm/batch`

Error payload standard:
```json
{
  "code": "INSUFFICIENT_BALANCE",
  "message": "Requested days exceed available balance",
  "details": {},
  "requestId": "trace_123"
}
```

Status code policy:
- `200` success
- `201` created
- `202` accepted for async processing
- `400` validation error
- `404` not found
- `409` business conflict/state conflict/idempotency conflict
- `500` unexpected error

## 10. Transaction Boundaries

Use DB transactions for:
- Create request + reserve balance
- Approve request + consume reserved + register outbound sync event
- Reject/cancel request + release reserved

## 11. Testing Strategy

### Test Layers
- **Unit tests**
  - lifecycle transitions
  - balance invariants
  - reconciliation rules
  - idempotency behavior
- **Integration tests (NestJS + SQLite)**
  - endpoint behavior
  - transactional integrity
  - concurrent request scenarios
- **Contract tests with HCM mocks**
  - realtime success/failure/retry
  - batch partial failures
  - stale version rejection

### Coverage Targets
- 85%+ statements
- 80%+ branches in domain/application modules
- 100% coverage for critical invariants and transitions

## 12. Risks and Mitigations

- **Concurrent writes:** use transactions and optimistic checks (`version`)
- **HCM partial failures:** retry with backoff and durable sync logs
- **Data drift:** periodic batch reconciliation and conflict rules
- **Duplicate requests/events:** strict idempotency keys and hashes

## 13. Deliverables

- This TRD
- NestJS + SQLite service implementation
- Automated test suite with HCM mocks
- Coverage report and run instructions

## 14. Implementation Plan

1. Scaffold NestJS project and DB layer
2. Implement balance + request domain logic
3. Implement sync endpoints and reconciliation
4. Add HCM mock server for test scenarios
5. Complete test suite and coverage report
# Time-Off Microservice TRD

## 1. Purpose

Build a backend microservice for ExampleHR to manage time-off requests while keeping balances aligned with HCM (source of truth).

This document is intentionally concise for a technical assessment and focuses on implementation-critical decisions.

## 2. Scope

### In Scope
- Time-off request lifecycle (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`)
- Balance management per `employeeId + locationId`
- HCM synchronization via:
  - Realtime updates
  - Batch balance ingestion
- Defensive validation and idempotency
- Test suite with HCM mock endpoints

### Out of Scope (MVP)
- Frontend/UI
- Multi-HCM production adapters
- Advanced regional policy engines

## 3. Core Requirements

- Never approve requests that violate local balance invariants.
- Keep local state convergent with HCM after retries and/or batch sync.
- Ensure idempotent behavior for external and client retries.
- Preserve auditability for every balance-impacting operation.

## 4. Domain Model

### Entities
- `Employee(id, status)`
- `Location(id, name)`
- `TimeOffBalance(employeeId, locationId, availableDays, reservedDays, consumedDays, hcmVersion, hcmUpdatedAt, updatedAt)`
- `TimeOffRequest(id, employeeId, locationId, daysRequested, status, managerId, idempotencyKey, requestedAt, decidedAt)`
- `SyncEvent(id, direction, type, batchId, employeeId, locationId, payloadHash, status, errorMessage, attemptCount, createdAt)`
- `IdempotencyRecord(operationName, idempotencyKey, requestHash, responseStatusCode, responseBody, expiresAt)`

### Invariants
- `availableDays >= 0`
- `reservedDays >= 0`
- `consumedDays >= 0`
- One balance row per `employeeId + locationId`
- Final request states are immutable
- Same idempotency key + same operation must not produce duplicate effects

## 5. Lifecycle Rules

- `PENDING -> APPROVED`
- `PENDING -> REJECTED`
- `PENDING -> CANCELLED`

No transitions are allowed from terminal states.

Balance movement policy:
- On create (`PENDING`): reserve days (`reserved += daysRequested`)
- On approve: consume reserved days (`reserved -= daysRequested`, `consumed += daysRequested`)
- On reject/cancel: release reserved days (`reserved -= daysRequested`)

## 6. Architecture

### Logical Components
- **API Layer (NestJS Controllers):** validation, DTOs, HTTP contracts
- **Application Layer:** request and sync use cases
- **Domain Layer:** invariants and state transitions
- **Persistence Layer (SQLite):** repositories + transactions
- **HCM Adapter:** realtime outbound/inbound + batch ingestion
- **Reconciliation Engine:** version-based conflict handling

### Consistency Model
- Hybrid approach:
  - Synchronous local write for fast user response
  - Eventual convergence with HCM through retries and batch reconciliation

## 7. Sync & Reconciliation Strategy

### Version Resolution
1. Prefer monotonic `hcmVersion`
2. Fallback to `hcmUpdatedAt` (LWW) when version is unavailable

### Conflict Rules
- If incoming version is newer: apply
- If equal: idempotent no-op
- If older: discard

### Defensive Behavior
- Reject invalid dimensions/payloads
- Record failed sync events without crashing full batch processing
- Keep retries for transient HCM failures

## 8. SQLite Schema (MVP)

```sql
CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE time_off_balances (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  available_days INTEGER NOT NULL CHECK (available_days >= 0),
  reserved_days INTEGER NOT NULL CHECK (reserved_days >= 0),
  consumed_days INTEGER NOT NULL DEFAULT 0 CHECK (consumed_days >= 0),
  hcm_version INTEGER,
  hcm_updated_at TEXT,
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (location_id) REFERENCES locations(id),
  UNIQUE (employee_id, location_id)
);

CREATE TABLE time_off_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  manager_id TEXT,
  days_requested INTEGER NOT NULL CHECK (days_requested > 0),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  idempotency_key TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  decided_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE sync_events (
  id TEXT PRIMARY KEY,
  direction TEXT NOT NULL CHECK (direction IN ('INBOUND_HCM', 'OUTBOUND_HCM')),
  type TEXT NOT NULL CHECK (type IN ('REALTIME', 'BATCH')),
  batch_id TEXT,
  employee_id TEXT,
  location_id TEXT,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RECEIVED', 'APPLIED', 'FAILED')),
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE idempotency_records (
  id TEXT PRIMARY KEY,
  operation_name TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status_code INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  UNIQUE (operation_name, idempotency_key)
);
```

Recommended indexes:
- `time_off_balances(employee_id, location_id)`
- `time_off_requests(employee_id, location_id, status)`
- `sync_events(status, type, created_at)`
- `sync_events(batch_id)`
- `idempotency_records(expires_at)`

## 9. API Contracts (MVP)

- `GET /balances/:employeeId/:locationId`
- `POST /time-off-requests`
- `POST /time-off-requests/:id/approve`
- `POST /time-off-requests/:id/reject`
- `POST /time-off-requests/:id/cancel`
- `POST /sync/hcm/realtime`
- `POST /sync/hcm/batch`

Error payload standard:
```json
{
  "code": "INSUFFICIENT_BALANCE",
  "message": "Requested days exceed available balance",
  "details": {},
  "requestId": "trace_123"
}
```

Status code policy:
- `200` success
- `201` created
- `202` accepted for async processing
- `400` validation error
- `404` not found
- `409` business conflict/state conflict/idempotency conflict
- `500` unexpected error

## 10. Transaction Boundaries

Use DB transactions for:
- Create request + reserve balance
- Approve request + consume reserved + register outbound sync event
- Reject/cancel request + release reserved

## 11. Testing Strategy

### Test Layers
- **Unit tests**
  - lifecycle transitions
  - balance invariants
  - reconciliation rules
  - idempotency behavior
- **Integration tests (NestJS + SQLite)**
  - endpoint behavior
  - transactional integrity
  - concurrent request scenarios
- **Contract tests with HCM mocks**
  - realtime success/failure/retry
  - batch partial failures
  - stale version rejection

### Coverage Targets
- 85%+ statements
- 80%+ branches in domain/application modules
- 100% coverage for critical invariants and transitions

## 12. Risks and Mitigations

- **Concurrent writes:** use transactions and optimistic checks (`version`)
- **HCM partial failures:** retry with backoff and durable sync logs
- **Data drift:** periodic batch reconciliation and conflict rules
- **Duplicate requests/events:** strict idempotency keys and hashes

## 13. Deliverables

- This TRD
- NestJS + SQLite service implementation
- Automated test suite with HCM mocks
- Coverage report and run instructions

## 14. Implementation Plan

1. Scaffold NestJS project and DB layer
2. Implement balance + request domain logic
3. Implement sync endpoints and reconciliation
4. Add HCM mock server for test scenarios
5. Complete test suite and coverage report
# Time-Off Microservice - Technical Requirements Document (Draft v0.1)

## 1) Product Context and Problem

ExampleHR es la interfaz principal para solicitudes de tiempo libre, pero el HCM (Workday/SAP u otro) es la fuente de verdad de los datos laborales y balances.

El reto principal es mantener consistencia de balances entre dos sistemas que pueden modificar datos en paralelo:
- ExampleHR crea/gestiona solicitudes de tiempo libre.
- HCM puede actualizar balances por su cuenta (aniversario, inicio de ano, ajustes masivos).

El sistema debe ser robusto ante:
- Desincronizacion temporal.
- Errores de integracion.
- Casos en que HCM no valide correctamente una combinacion o un saldo insuficiente.

## 2) Scope and Goals

### In Scope
- Crear y gestionar el ciclo de vida de solicitudes de tiempo libre.
- Exponer API para consultar balances por empleado y ubicacion.
- Sincronizar balances con HCM por dos vias:
  - Realtime API (consulta/envio puntual de valores).
  - Batch API (corpus completo de balances).
- Implementar validaciones defensivas locales antes de impactar balance.
- Trazabilidad de sincronizaciones y errores para auditoria.

### Out of Scope (MVP)
- UI/Frontend.
- Integraciones con multiples HCM reales en produccion (se usa mock en pruebas).
- Motor complejo de politicas por pais/sindicato (se asume regla uniforme inicial).

### Success Criteria
- No se aprueban solicitudes que dejen saldo negativo bajo reglas locales.
- El sistema converge al estado de HCM tras procesos de sync (realtime o batch).
- Operaciones criticas son idempotentes y auditables.
- Suite de pruebas detecta regresiones funcionales clave.

## 3) Personas and User Needs

- Employee:
  - Ver saldo confiable por ubicacion.
  - Recibir feedback inmediato al pedir tiempo libre.
- Manager:
  - Aprobar/rechazar con confianza en validez del saldo.
- Plataforma:
  - Mantener consistencia con HCM con minima friccion operativa.

## 4) Domain Model (Initial)

Balances son por `employeeId + locationId`.

### Entities
- Employee
  - `id`
  - `status` (active/inactive)
- Location
  - `id`
  - `name`
- TimeOffBalance
  - `id`
  - `employeeId`
  - `locationId`
  - `availableDays`
  - `reservedDays`
  - `version`
  - `updatedAt`
- TimeOffRequest
  - `id`
  - `employeeId`
  - `locationId`
  - `daysRequested`
  - `status`
  - `requestedAt`
  - `decidedAt`
  - `managerId` (nullable)
  - `idempotencyKey`
- SyncEvent
  - `id`
  - `direction` (INBOUND_HCM / OUTBOUND_HCM)
  - `type` (REALTIME / BATCH)
  - `employeeId` (nullable en batch)
  - `locationId` (nullable en batch)
  - `payloadHash`
  - `status` (RECEIVED / APPLIED / FAILED)
  - `errorMessage` (nullable)
  - `createdAt`

## 5) Request Lifecycle (Initial)

Estados de `TimeOffRequest`:
- `PENDING`: solicitud creada, aun sin decision final.
- `APPROVED`: solicitud validada y aprobada.
- `REJECTED`: solicitud denegada.
- `CANCELLED`: solicitud anulada por empleado/manager (segun politica).

Transiciones permitidas:
- `PENDING -> APPROVED`
- `PENDING -> REJECTED`
- `PENDING -> CANCELLED`

No permitidas:
- Cualquier transicion desde estado final (`APPROVED`, `REJECTED`, `CANCELLED`) a otro estado.

## 6) Business Invariants (Must Always Hold)

1. Balance no negativo local:
   - `availableDays >= 0`
   - `reservedDays >= 0`
2. Identidad de saldo:
   - `availableDays + reservedDays` no puede alterarse sin evento de negocio o sync explicito.
3. Idempotencia:
   - La misma operacion externa (misma `idempotencyKey`) no impacta saldo dos veces.
4. Integridad dimensional:
   - Toda operacion usa combinacion valida `employeeId + locationId`.
5. Estados terminales inmutables:
   - Una solicitud en estado final no reabre por accidente.
6. Trazabilidad:
   - Toda actualizacion por HCM debe registrar un `SyncEvent`.

## 7) High-Risk Scenarios to Cover Early

- Doble click/reintento del cliente creando la misma solicitud.
- Dos solicitudes concurrentes para el mismo balance.
- HCM devuelve exito pero no persiste (inconsistencia eventual).
- Batch de HCM sobrescribe un balance modificado recientemente por realtime.
- Ajuste externo de HCM (aniversario) mientras hay solicitudes pendientes.

## 8) API Surface (MVP Outline)

- `GET /balances/:employeeId/:locationId`
- `POST /time-off-requests`
- `POST /time-off-requests/:id/approve`
- `POST /time-off-requests/:id/reject`
- `POST /time-off-requests/:id/cancel`
- `POST /sync/hcm/realtime` (inbound webhook o endpoint interno)
- `POST /sync/hcm/batch` (ingesta de corpus)

## 9) Testing Strategy (Initial Outline)

- Unit tests:
  - Reglas de estado y validaciones de saldo.
  - Idempotencia.
- Integration tests (NestJS + SQLite):
  - Endpoints principales y persistencia.
  - Casos concurrentes sobre mismo balance.
- Contract tests con HCM mock:
  - Realtime success/failure.
  - Batch update y reconciliacion.

## 10) Architecture Design (Detailed)

### 10.1 Logical Components
- API Layer (NestJS Controllers)
  - Expone endpoints de balances, requests y sync inbound.
  - Valida formato, autenticacion (futuro), idempotency key y errores HTTP.
- Application Layer (Use Cases / Services)
  - Orquesta reglas de negocio:
    - Crear solicitud.
    - Aprobar/rechazar/cancelar.
    - Aplicar sync realtime.
    - Aplicar sync batch.
- Domain Layer
  - Entidades, value objects e invariantes (saldo, estados, transiciones).
- Persistence Layer (SQLite Repositories)
  - Guarda balances, requests, sync events e idempotency records.
- HCM Integration Adapter
  - Cliente HTTP para realtime.
  - Ingesta de batch (push o pull segun proveedor).
- Reconciliation Engine
  - Resuelve conflictos de version/tiempo.
  - Ejecuta reglas de convergencia al estado HCM.

### 10.2 Data Flow - Time-Off Request (Synchronous Path)
1. Cliente llama `POST /time-off-requests` con `idempotencyKey`.
2. API valida request y deduplicacion.
3. Servicio carga balance `employeeId + locationId` y valida saldo local.
4. Servicio crea `TimeOffRequest(PENDING)` y registra evento.
5. En aprobacion:
   - Transicion a `APPROVED`.
   - Actualiza balance local de forma atomica.
   - Dispara sync outbound a HCM realtime.
6. Si HCM falla temporalmente:
   - Se marca evento como `FAILED`.
   - Se agenda retry.
7. Si HCM confirma:
   - Evento `APPLIED`.

### 10.3 Data Flow - HCM Realtime Inbound
1. HCM envia ajuste puntual (delta o absoluto).
2. Se registra `SyncEvent(RECEIVED, REALTIME, INBOUND_HCM)`.
3. Se aplica validacion de dimensiones y version.
4. Se actualiza balance local en transaccion.
5. Se marca evento `APPLIED`; si falla, `FAILED` con causa.

### 10.4 Data Flow - HCM Batch Inbound
1. HCM envia corpus completo de balances.
2. Se crea `batchId` y evento de recepcion.
3. Se procesa por chunks (para escalar).
4. Cada registro pasa por reconciliacion (ver seccion 12).
5. Se persisten cambios y metricas:
   - registros aplicados
   - omitidos por version antigua
   - fallidos por datos invalidos
6. Se cierra evento batch con resumen final.

### 10.5 Recommended MVP Architecture Decisions
- Consistencia:
  - Modelo hibrido: sincrono para UX inmediata + eventual para retries/reconciliacion.
- Idempotencia:
  - Requerida en create request y en sync inbound/outbound.
- Observabilidad:
  - Logging estructurado por `requestId`, `employeeId`, `locationId`, `syncEventId`.
- Atomicidad:
  - Cambios de balance y estado de request en una sola transaccion SQLite.

## 11) Sequence Decisions (Resolved for MVP)

1. Estrategia de versionado:
   - Usar `hcmVersion` monotona cuando exista.
   - Fallback: `hcmUpdatedAt` (Last-Write-Wins) si no hay version numerica.
2. Momento de impactar saldo:
   - Reservar en `PENDING` (`reservedDays += requestedDays`).
   - En `APPROVED`: mover de reservado a consumido.
   - En `REJECTED`/`CANCELLED`: liberar reservado.
3. Politica de batch:
   - Batch aplica por registro solo si es mas nuevo que el estado local.
   - Nunca sobrescribir con version/fecha antigua.
4. Modelo de consistencia:
   - Solicitud responde rapido con estado local validado.
   - Convergencia final garantizada por retries + batch reconciliation.

## 12) Reconciliation Strategy

### 12.1 Conflict Rules per Balance
- Regla A: si `incomingVersion > localVersion`, aplicar incoming.
- Regla B: si `incomingVersion == localVersion`, no-op idempotente.
- Regla C: si `incomingVersion < localVersion`, descartar incoming.
- Regla D (sin version): comparar `incomingUpdatedAt` vs `localUpdatedAt`.

### 12.2 Pending Requests During External Adjustments
- Si llega ajuste HCM y hay requests `PENDING`:
  - Recalcular `availableDays` manteniendo `reservedDays`.
  - Si `availableDays` quedara negativo por nuevas condiciones:
    - marcar request para reevaluacion automatica (flag).
    - notificar para decision de manager (fase siguiente; en MVP registrar alerta).

### 12.3 Defensive Validation
- Rechazar registros con:
  - `employeeId` vacio.
  - `locationId` vacio.
  - dias negativos invalidos.
- Registrar errores de datos sin tumbar todo el batch.

## 13) SQLite Schema (Final for MVP)

Notas:
- Todas las tablas usan timestamps en formato ISO-8601 UTC (`TEXT`).
- UUIDs se almacenan como `TEXT`.
- Se activa `PRAGMA foreign_keys = ON`.

### 13.1 DDL de referencia

```sql
CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE time_off_balances (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  available_days INTEGER NOT NULL CHECK (available_days >= 0),
  reserved_days INTEGER NOT NULL CHECK (reserved_days >= 0),
  consumed_days INTEGER NOT NULL DEFAULT 0 CHECK (consumed_days >= 0),
  hcm_version INTEGER,
  hcm_updated_at TEXT,
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (location_id) REFERENCES locations(id),
  UNIQUE (employee_id, location_id)
);

CREATE TABLE time_off_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  manager_id TEXT,
  days_requested INTEGER NOT NULL CHECK (days_requested > 0),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  idempotency_key TEXT NOT NULL,
  reevaluation_required INTEGER NOT NULL DEFAULT 0 CHECK (reevaluation_required IN (0, 1)),
  requested_at TEXT NOT NULL,
  decided_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE sync_events (
  id TEXT PRIMARY KEY,
  direction TEXT NOT NULL CHECK (direction IN ('INBOUND_HCM', 'OUTBOUND_HCM')),
  type TEXT NOT NULL CHECK (type IN ('REALTIME', 'BATCH')),
  batch_id TEXT,
  employee_id TEXT,
  location_id TEXT,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RECEIVED', 'APPLIED', 'FAILED')),
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  received_at TEXT NOT NULL,
  applied_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE idempotency_records (
  id TEXT PRIMARY KEY,
  operation_name TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status_code INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  UNIQUE (operation_name, idempotency_key)
);
```

### 13.2 Indices recomendados

```sql
CREATE INDEX idx_balance_employee_location
  ON time_off_balances (employee_id, location_id);

CREATE INDEX idx_request_employee_location_status
  ON time_off_requests (employee_id, location_id, status);

CREATE INDEX idx_request_status_requested_at
  ON time_off_requests (status, requested_at);

CREATE INDEX idx_sync_status_type_created_at
  ON sync_events (status, type, created_at);

CREATE INDEX idx_sync_batch_id
  ON sync_events (batch_id);

CREATE INDEX idx_idempotency_expires_at
  ON idempotency_records (expires_at);
```

### 13.3 Constraints and Rules

- `UNIQUE (employee_id, location_id)` en `time_off_balances` asegura un solo balance por dimension.
- `CHECK (days_requested > 0)` evita solicitudes vacias/invalidas.
- `status` y enums en texto con `CHECK` garantizan consistencia semantica.
- `hcm_version` nullable para proveedores que no exponen version monotona.
- `idempotency_records` guarda respuesta para devolver mismo resultado en reintentos.

### 13.4 Transaction Boundaries (Required)

- Crear request `PENDING`:
  - inserta `time_off_requests`
  - actualiza `time_off_balances.reserved_days`
  - todo en una transaccion
- Aprobar request:
  - cambia estado a `APPROVED`
  - mueve `reserved_days -> consumed_days`
  - registra `sync_events` outbound
  - todo en una transaccion
- Rechazar/Cancelar request:
  - cambia estado final
  - libera `reserved_days`
  - todo en una transaccion

## 14) API Contracts (Detailed)

Convenciones generales:
- Formato JSON para request/response.
- Header recomendado para mutaciones: `Idempotency-Key`.
- Fechas en ISO-8601 UTC.
- Errores con estructura uniforme:
  - `code` (string estable)
  - `message` (legible)
  - `details` (objeto opcional)
  - `requestId` (trazabilidad)

### 14.1 Get Balance

`GET /balances/:employeeId/:locationId`

Response `200`:

```json
{
  "employeeId": "emp_123",
  "locationId": "loc_mx",
  "availableDays": 10,
  "reservedDays": 2,
  "consumedDays": 4,
  "hcmVersion": 42,
  "updatedAt": "2026-04-27T20:20:00Z"
}
```

Errores:
- `404 BALANCE_NOT_FOUND`
- `400 INVALID_DIMENSIONS`

### 14.2 Create Time-Off Request

`POST /time-off-requests`

Request:

```json
{
  "employeeId": "emp_123",
  "locationId": "loc_mx",
  "daysRequested": 2
}
```

Response `201`:

```json
{
  "id": "req_001",
  "employeeId": "emp_123",
  "locationId": "loc_mx",
  "daysRequested": 2,
  "status": "PENDING",
  "requestedAt": "2026-04-27T20:25:00Z"
}
```

Errores:
- `400 VALIDATION_ERROR` (payload invalido)
- `409 INSUFFICIENT_BALANCE`
- `409 IDEMPOTENCY_CONFLICT` (misma key, distinto payload)
- `404 BALANCE_NOT_FOUND`

Notas:
- Si llega la misma `Idempotency-Key` y mismo payload, retornar misma respuesta previa (`201` o resultado original persistido).

### 14.3 Approve Request

`POST /time-off-requests/:id/approve`

Request:

```json
{
  "managerId": "mgr_900"
}
```

Response `200`:

```json
{
  "id": "req_001",
  "status": "APPROVED",
  "decidedAt": "2026-04-27T20:30:00Z",
  "syncStatus": "PENDING_OUTBOUND"
}
```

Errores:
- `404 REQUEST_NOT_FOUND`
- `409 INVALID_STATE_TRANSITION`
- `409 INSUFFICIENT_BALANCE`

### 14.4 Reject Request

`POST /time-off-requests/:id/reject`

Request:

```json
{
  "managerId": "mgr_900",
  "reason": "Team capacity constraints"
}
```

Response `200`:

```json
{
  "id": "req_001",
  "status": "REJECTED",
  "decidedAt": "2026-04-27T20:31:00Z"
}
```

Errores:
- `404 REQUEST_NOT_FOUND`
- `409 INVALID_STATE_TRANSITION`

### 14.5 Cancel Request

`POST /time-off-requests/:id/cancel`

Request:

```json
{
  "actorId": "emp_123",
  "reason": "No longer needed"
}
```

Response `200`:

```json
{
  "id": "req_001",
  "status": "CANCELLED",
  "decidedAt": "2026-04-27T20:32:00Z"
}
```

Errores:
- `404 REQUEST_NOT_FOUND`
- `409 INVALID_STATE_TRANSITION`

### 14.6 HCM Realtime Inbound

`POST /sync/hcm/realtime`

Request (absoluto):

```json
{
  "employeeId": "emp_123",
  "locationId": "loc_mx",
  "availableDays": 12,
  "consumedDays": 4,
  "hcmVersion": 43,
  "hcmUpdatedAt": "2026-04-27T20:33:00Z",
  "eventId": "hcm_evt_abc"
}
```

Response `202`:

```json
{
  "eventId": "hcm_evt_abc",
  "status": "RECEIVED"
}
```

Errores:
- `400 VALIDATION_ERROR`
- `409 STALE_VERSION`

Notas:
- Endpoint idempotente por `eventId` o `payloadHash`.
- Se acepta `202` para procesamiento asincrono controlado.

### 14.7 HCM Batch Inbound

`POST /sync/hcm/batch`

Request:

```json
{
  "batchId": "hcm_batch_2026_04_27",
  "generatedAt": "2026-04-27T21:00:00Z",
  "records": [
    {
      "employeeId": "emp_123",
      "locationId": "loc_mx",
      "availableDays": 12,
      "consumedDays": 4,
      "hcmVersion": 43,
      "hcmUpdatedAt": "2026-04-27T20:59:00Z"
    }
  ]
}
```

Response `202`:

```json
{
  "batchId": "hcm_batch_2026_04_27",
  "status": "RECEIVED",
  "acceptedRecords": 1
}
```

Errores:
- `400 VALIDATION_ERROR`
- `409 DUPLICATE_BATCH_ID`

### 14.8 Standard Error Payload

Ejemplo:

```json
{
  "code": "INSUFFICIENT_BALANCE",
  "message": "Requested days exceed available balance",
  "details": {
    "employeeId": "emp_123",
    "locationId": "loc_mx",
    "availableDays": 1,
    "daysRequested": 2
  },
  "requestId": "req_trace_789"
}
```

### 14.9 HTTP Status Mapping

- `200`: operacion exitosa sin crear recurso.
- `201`: recurso creado (`POST /time-off-requests`).
- `202`: evento/batch recibido para procesamiento.
- `400`: payload invalido o dimensiones invalidas.
- `404`: entidad no encontrada.
- `409`: conflicto de estado/idempotencia/saldo/version.
- `500`: error inesperado.


