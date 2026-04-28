import { ApproveRequestDto, BatchSyncDto, CancelRequestDto, CreateTimeOffRequestDto, RejectRequestDto, RealtimeSyncDto } from './timeoff.dto';
import { TimeoffService } from './timeoff.service';
export declare class TimeoffController {
    private readonly timeoffService;
    constructor(timeoffService: TimeoffService);
    getRequests(): Promise<any[]>;
    getRequestById(id: string): Promise<any>;
    getBalance(employeeId: string, locationId: string): Promise<any>;
    createRequest(dto: CreateTimeOffRequestDto, idempotencyKey?: string): Promise<Record<string, unknown>>;
    approveRequest(id: string, dto: ApproveRequestDto): Promise<{
        id: string;
        status: "APPROVED" | "REJECTED" | "CANCELLED";
        decidedAt: string;
        syncStatus: string | undefined;
    }>;
    rejectRequest(id: string, dto: RejectRequestDto): Promise<{
        id: string;
        status: "APPROVED" | "REJECTED" | "CANCELLED";
        decidedAt: string;
        syncStatus: string | undefined;
    }>;
    cancelRequest(id: string, dto: CancelRequestDto): Promise<{
        id: string;
        status: "APPROVED" | "REJECTED" | "CANCELLED";
        decidedAt: string;
        syncStatus: string | undefined;
    }>;
    syncRealtime(dto: RealtimeSyncDto): Promise<{
        eventId: string;
        status: string;
    }>;
    syncBatch(dto: BatchSyncDto): Promise<{
        batchId: string;
        status: string;
        acceptedRecords: number;
    }>;
}
