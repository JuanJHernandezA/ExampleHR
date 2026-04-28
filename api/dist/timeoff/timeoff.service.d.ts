import { DatabaseService } from '../database.service';
import { BatchSyncDto, CreateTimeOffRequestDto, RealtimeSyncDto } from './timeoff.dto';
export declare class TimeoffService {
    private readonly databaseService;
    constructor(databaseService: DatabaseService);
    getRequests(): Promise<any[]>;
    getRequestById(id: string): Promise<any>;
    getBalance(employeeId: string, locationId: string): Promise<any>;
    createRequest(dto: CreateTimeOffRequestDto, idempotencyKey?: string): Promise<Record<string, unknown>>;
    approveRequest(id: string, managerId: string): Promise<{
        id: string;
        status: "APPROVED" | "REJECTED" | "CANCELLED";
        decidedAt: string;
        syncStatus: string | undefined;
    }>;
    rejectRequest(id: string, managerId: string): Promise<{
        id: string;
        status: "APPROVED" | "REJECTED" | "CANCELLED";
        decidedAt: string;
        syncStatus: string | undefined;
    }>;
    cancelRequest(id: string, actorId: string): Promise<{
        id: string;
        status: "APPROVED" | "REJECTED" | "CANCELLED";
        decidedAt: string;
        syncStatus: string | undefined;
    }>;
    private moveRequestToTerminalState;
    syncRealtime(dto: RealtimeSyncDto): Promise<{
        eventId: string;
        status: string;
    }>;
    syncBatch(dto: BatchSyncDto): Promise<{
        batchId: string;
        status: string;
        acceptedRecords: number;
    }>;
    private ensureEmployeeAndLocation;
    private isStaleIncoming;
}
