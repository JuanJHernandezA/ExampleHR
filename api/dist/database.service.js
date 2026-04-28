"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const common_1 = require("@nestjs/common");
const sqlite_1 = require("sqlite");
const sqlite3_1 = __importDefault(require("sqlite3"));
let DatabaseService = class DatabaseService {
    db;
    async onModuleInit() {
        this.db = await (0, sqlite_1.open)({
            filename: process.env.DB_PATH ?? 'timeoff.db',
            driver: sqlite3_1.default.Database,
        });
        await this.db.exec('PRAGMA foreign_keys = ON;');
        await this.createSchema();
    }
    async onModuleDestroy() {
        await this.db.close();
    }
    get connection() {
        return this.db;
    }
    async createSchema() {
        await this.db.exec(`
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS time_off_balances (
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

      CREATE TABLE IF NOT EXISTS time_off_requests (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        location_id TEXT NOT NULL,
        manager_id TEXT,
        days_requested INTEGER NOT NULL CHECK (days_requested > 0),
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
        idempotency_key TEXT,
        requested_at TEXT NOT NULL,
        decided_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (location_id) REFERENCES locations(id)
      );

      CREATE TABLE IF NOT EXISTS sync_events (
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

      CREATE TABLE IF NOT EXISTS idempotency_records (
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
    `);
    }
};
exports.DatabaseService = DatabaseService;
exports.DatabaseService = DatabaseService = __decorate([
    (0, common_1.Injectable)()
], DatabaseService);
//# sourceMappingURL=database.service.js.map