export declare class CreateTimeOffRequestDto {
    employeeId: string;
    locationId: string;
    daysRequested: number;
}
export declare class ApproveRequestDto {
    managerId: string;
}
export declare class RejectRequestDto {
    managerId: string;
    reason?: string;
}
export declare class CancelRequestDto {
    actorId: string;
    reason?: string;
}
export declare class RealtimeSyncDto {
    employeeId: string;
    locationId: string;
    availableDays: number;
    consumedDays: number;
    hcmVersion?: number;
    hcmUpdatedAt?: string;
    eventId: string;
}
export declare class BatchRecordDto {
    employeeId: string;
    locationId: string;
    availableDays: number;
    consumedDays: number;
    hcmVersion?: number;
    hcmUpdatedAt?: string;
}
export declare class BatchSyncDto {
    batchId: string;
    generatedAt: string;
    records: BatchRecordDto[];
}
