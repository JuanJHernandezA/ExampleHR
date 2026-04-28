"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeoffService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const database_service_1 = require("../database.service");
let TimeoffService = class TimeoffService {
    databaseService;
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async getRequests() {
        return this.databaseService.connection.all(`SELECT id, employee_id as employeeId, location_id as locationId,
              manager_id as managerId, days_requested as daysRequested, status,
              idempotency_key as idempotencyKey, requested_at as requestedAt,
              decided_at as decidedAt, created_at as createdAt, updated_at as updatedAt
       FROM time_off_requests
       ORDER BY created_at DESC`);
    }
    async getRequestById(id) {
        const row = await this.databaseService.connection.get(`SELECT id, employee_id as employeeId, location_id as locationId,
              manager_id as managerId, days_requested as daysRequested, status,
              idempotency_key as idempotencyKey, requested_at as requestedAt,
              decided_at as decidedAt, created_at as createdAt, updated_at as updatedAt
       FROM time_off_requests
       WHERE id = ?`, [id]);
        if (!row) {
            throw new common_1.NotFoundException('REQUEST_NOT_FOUND');
        }
        return row;
    }
    async getBalance(employeeId, locationId) {
        const row = await this.databaseService.connection.get(`SELECT employee_id as employeeId, location_id as locationId, available_days as availableDays,
              reserved_days as reservedDays, consumed_days as consumedDays, hcm_version as hcmVersion,
              updated_at as updatedAt
       FROM time_off_balances
       WHERE employee_id = ? AND location_id = ?`, [employeeId, locationId]);
        if (!row) {
            throw new common_1.NotFoundException('BALANCE_NOT_FOUND');
        }
        return row;
    }
    async createRequest(dto, idempotencyKey) {
        const db = this.databaseService.connection;
        const now = new Date().toISOString();
        const hash = (0, crypto_1.createHash)('sha256').update(JSON.stringify(dto)).digest('hex');
        if (idempotencyKey) {
            const existing = await db.get(`SELECT request_hash as requestHash, response_body as responseBody
         FROM idempotency_records
         WHERE operation_name = 'create_request' AND idempotency_key = ?`, [idempotencyKey]);
            if (existing) {
                if (existing.requestHash !== hash) {
                    throw new common_1.ConflictException('IDEMPOTENCY_CONFLICT');
                }
                return JSON.parse(existing.responseBody);
            }
        }
        await db.exec('BEGIN IMMEDIATE TRANSACTION');
        try {
            const balance = await db.get(`SELECT id, available_days as availableDays, reserved_days as reservedDays
         FROM time_off_balances
         WHERE employee_id = ? AND location_id = ?`, [dto.employeeId, dto.locationId]);
            if (!balance) {
                throw new common_1.NotFoundException('BALANCE_NOT_FOUND');
            }
            const remaining = balance.availableDays - balance.reservedDays;
            if (remaining < dto.daysRequested) {
                throw new common_1.ConflictException('INSUFFICIENT_BALANCE');
            }
            const requestId = (0, crypto_1.randomUUID)();
            await db.run(`INSERT INTO time_off_requests
          (id, employee_id, location_id, manager_id, days_requested, status, idempotency_key, requested_at, decided_at, created_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, 'PENDING', ?, ?, NULL, ?, ?)`, [
                requestId,
                dto.employeeId,
                dto.locationId,
                dto.daysRequested,
                idempotencyKey ?? null,
                now,
                now,
                now,
            ]);
            await db.run(`UPDATE time_off_balances
         SET reserved_days = reserved_days + ?, version = version + 1, updated_at = ?
         WHERE id = ?`, [dto.daysRequested, now, balance.id]);
            const response = {
                id: requestId,
                employeeId: dto.employeeId,
                locationId: dto.locationId,
                daysRequested: dto.daysRequested,
                status: 'PENDING',
                requestedAt: now,
            };
            if (idempotencyKey) {
                const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
                await db.run(`INSERT OR REPLACE INTO idempotency_records
            (id, operation_name, idempotency_key, request_hash, response_status_code, response_body, created_at, expires_at)
           VALUES (?, 'create_request', ?, ?, 201, ?, ?, ?)`, [
                    (0, crypto_1.randomUUID)(),
                    idempotencyKey,
                    hash,
                    JSON.stringify(response),
                    now,
                    expiresAt,
                ]);
            }
            await db.exec('COMMIT');
            return response;
        }
        catch (error) {
            await db.exec('ROLLBACK');
            throw error;
        }
    }
    async approveRequest(id, managerId) {
        return this.moveRequestToTerminalState(id, 'APPROVED', managerId);
    }
    async rejectRequest(id, managerId) {
        return this.moveRequestToTerminalState(id, 'REJECTED', managerId);
    }
    async cancelRequest(id, actorId) {
        return this.moveRequestToTerminalState(id, 'CANCELLED', actorId);
    }
    async moveRequestToTerminalState(requestId, nextState, actorId) {
        const db = this.databaseService.connection;
        const now = new Date().toISOString();
        await db.exec('BEGIN IMMEDIATE TRANSACTION');
        try {
            const request = await db.get(`SELECT id, employee_id as employeeId, location_id as locationId, days_requested as daysRequested, status
         FROM time_off_requests WHERE id = ?`, [requestId]);
            if (!request) {
                throw new common_1.NotFoundException('REQUEST_NOT_FOUND');
            }
            if (request.status !== 'PENDING') {
                throw new common_1.ConflictException('INVALID_STATE_TRANSITION');
            }
            const balance = await db.get(`SELECT id FROM time_off_balances WHERE employee_id = ? AND location_id = ?`, [request.employeeId, request.locationId]);
            if (!balance) {
                throw new common_1.NotFoundException('BALANCE_NOT_FOUND');
            }
            if (nextState === 'APPROVED') {
                await db.run(`UPDATE time_off_balances
           SET reserved_days = reserved_days - ?, consumed_days = consumed_days + ?, version = version + 1, updated_at = ?
           WHERE id = ?`, [request.daysRequested, request.daysRequested, now, balance.id]);
            }
            else {
                await db.run(`UPDATE time_off_balances
           SET reserved_days = reserved_days - ?, version = version + 1, updated_at = ?
           WHERE id = ?`, [request.daysRequested, now, balance.id]);
            }
            await db.run(`UPDATE time_off_requests
         SET status = ?, manager_id = ?, decided_at = ?, updated_at = ?
         WHERE id = ?`, [nextState, actorId, now, now, requestId]);
            if (nextState === 'APPROVED') {
                await db.run(`INSERT INTO sync_events
            (id, direction, type, batch_id, employee_id, location_id, payload_hash, status, error_message, attempt_count, created_at, updated_at)
           VALUES (?, 'OUTBOUND_HCM', 'REALTIME', NULL, ?, ?, ?, 'RECEIVED', NULL, 0, ?, ?)`, [
                    (0, crypto_1.randomUUID)(),
                    request.employeeId,
                    request.locationId,
                    (0, crypto_1.createHash)('sha256')
                        .update(JSON.stringify({ requestId, nextState, actorId }))
                        .digest('hex'),
                    now,
                    now,
                ]);
            }
            await db.exec('COMMIT');
            return {
                id: requestId,
                status: nextState,
                decidedAt: now,
                syncStatus: nextState === 'APPROVED' ? 'PENDING_OUTBOUND' : undefined,
            };
        }
        catch (error) {
            await db.exec('ROLLBACK');
            throw error;
        }
    }
    async syncRealtime(dto) {
        const db = this.databaseService.connection;
        const now = new Date().toISOString();
        const payloadHash = (0, crypto_1.createHash)('sha256').update(JSON.stringify(dto)).digest('hex');
        const existingEvent = await db.get(`SELECT id FROM sync_events WHERE payload_hash = ? AND type = 'REALTIME'`, [payloadHash]);
        if (existingEvent) {
            return { eventId: dto.eventId, status: 'RECEIVED' };
        }
        await db.exec('BEGIN IMMEDIATE TRANSACTION');
        try {
            await this.ensureEmployeeAndLocation(dto.employeeId, dto.locationId);
            await db.run(`INSERT INTO sync_events
         (id, direction, type, batch_id, employee_id, location_id, payload_hash, status, error_message, attempt_count, created_at, updated_at)
         VALUES (?, 'INBOUND_HCM', 'REALTIME', NULL, ?, ?, ?, 'RECEIVED', NULL, 0, ?, ?)`, [(0, crypto_1.randomUUID)(), dto.employeeId, dto.locationId, payloadHash, now, now]);
            const existingBalance = await db.get(`SELECT id, hcm_version as hcmVersion, hcm_updated_at as hcmUpdatedAt
         FROM time_off_balances WHERE employee_id = ? AND location_id = ?`, [dto.employeeId, dto.locationId]);
            if (this.isStaleIncoming(existingBalance, dto)) {
                throw new common_1.ConflictException('STALE_VERSION');
            }
            if (existingBalance) {
                await db.run(`UPDATE time_off_balances
           SET available_days = ?, consumed_days = ?, hcm_version = ?, hcm_updated_at = ?, version = version + 1, updated_at = ?
           WHERE id = ?`, [
                    dto.availableDays,
                    dto.consumedDays,
                    dto.hcmVersion ?? existingBalance.hcmVersion,
                    dto.hcmUpdatedAt ?? existingBalance.hcmUpdatedAt,
                    now,
                    existingBalance.id,
                ]);
            }
            else {
                await db.run(`INSERT INTO time_off_balances
           (id, employee_id, location_id, available_days, reserved_days, consumed_days, hcm_version, hcm_updated_at, version, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, ?, ?, ?, 0, ?, ?)`, [
                    (0, crypto_1.randomUUID)(),
                    dto.employeeId,
                    dto.locationId,
                    dto.availableDays,
                    dto.consumedDays,
                    dto.hcmVersion ?? null,
                    dto.hcmUpdatedAt ?? null,
                    now,
                    now,
                ]);
            }
            await db.exec('COMMIT');
            return { eventId: dto.eventId, status: 'RECEIVED' };
        }
        catch (error) {
            await db.exec('ROLLBACK');
            throw error;
        }
    }
    async syncBatch(dto) {
        const now = new Date().toISOString();
        const existingBatch = await this.databaseService.connection.get(`SELECT id FROM sync_events WHERE type = 'BATCH' AND batch_id = ?`, [dto.batchId]);
        if (existingBatch) {
            throw new common_1.ConflictException('DUPLICATE_BATCH_ID');
        }
        let acceptedRecords = 0;
        for (const record of dto.records) {
            await this.syncRealtime({
                ...record,
                eventId: `${dto.batchId}:${record.employeeId}:${record.locationId}`,
            });
            acceptedRecords += 1;
        }
        const payloadHash = (0, crypto_1.createHash)('sha256').update(JSON.stringify(dto)).digest('hex');
        await this.databaseService.connection.run(`INSERT INTO sync_events
       (id, direction, type, batch_id, employee_id, location_id, payload_hash, status, error_message, attempt_count, created_at, updated_at)
       VALUES (?, 'INBOUND_HCM', 'BATCH', ?, NULL, NULL, ?, 'RECEIVED', NULL, 0, ?, ?)`, [(0, crypto_1.randomUUID)(), dto.batchId, payloadHash, now, now]);
        return { batchId: dto.batchId, status: 'RECEIVED', acceptedRecords };
    }
    async ensureEmployeeAndLocation(employeeId, locationId) {
        const db = this.databaseService.connection;
        const now = new Date().toISOString();
        await db.run(`INSERT OR IGNORE INTO employees(id, status, created_at, updated_at)
       VALUES (?, 'active', ?, ?)`, [employeeId, now, now]);
        await db.run(`INSERT OR IGNORE INTO locations(id, name, created_at, updated_at)
       VALUES (?, ?, ?, ?)`, [locationId, locationId, now, now]);
    }
    isStaleIncoming(existingBalance, dto) {
        if (!existingBalance) {
            return false;
        }
        if (dto.hcmVersion !== undefined &&
            existingBalance.hcmVersion !== null &&
            dto.hcmVersion < existingBalance.hcmVersion) {
            return true;
        }
        if (dto.hcmVersion === undefined &&
            dto.hcmUpdatedAt &&
            existingBalance.hcmUpdatedAt &&
            dto.hcmUpdatedAt < existingBalance.hcmUpdatedAt) {
            return true;
        }
        return false;
    }
};
exports.TimeoffService = TimeoffService;
exports.TimeoffService = TimeoffService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], TimeoffService);
//# sourceMappingURL=timeoff.service.js.map