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
exports.BatchSyncDto = exports.BatchRecordDto = exports.RealtimeSyncDto = exports.CancelRequestDto = exports.RejectRequestDto = exports.ApproveRequestDto = exports.CreateTimeOffRequestDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class CreateTimeOffRequestDto {
    employeeId;
    locationId;
    daysRequested;
}
exports.CreateTimeOffRequestDto = CreateTimeOffRequestDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateTimeOffRequestDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateTimeOffRequestDto.prototype, "locationId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateTimeOffRequestDto.prototype, "daysRequested", void 0);
class ApproveRequestDto {
    managerId;
}
exports.ApproveRequestDto = ApproveRequestDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ApproveRequestDto.prototype, "managerId", void 0);
class RejectRequestDto {
    managerId;
    reason;
}
exports.RejectRequestDto = RejectRequestDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RejectRequestDto.prototype, "managerId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RejectRequestDto.prototype, "reason", void 0);
class CancelRequestDto {
    actorId;
    reason;
}
exports.CancelRequestDto = CancelRequestDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CancelRequestDto.prototype, "actorId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CancelRequestDto.prototype, "reason", void 0);
class RealtimeSyncDto {
    employeeId;
    locationId;
    availableDays;
    consumedDays;
    hcmVersion;
    hcmUpdatedAt;
    eventId;
}
exports.RealtimeSyncDto = RealtimeSyncDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RealtimeSyncDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RealtimeSyncDto.prototype, "locationId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], RealtimeSyncDto.prototype, "availableDays", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], RealtimeSyncDto.prototype, "consumedDays", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], RealtimeSyncDto.prototype, "hcmVersion", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RealtimeSyncDto.prototype, "hcmUpdatedAt", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RealtimeSyncDto.prototype, "eventId", void 0);
class BatchRecordDto {
    employeeId;
    locationId;
    availableDays;
    consumedDays;
    hcmVersion;
    hcmUpdatedAt;
}
exports.BatchRecordDto = BatchRecordDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BatchRecordDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BatchRecordDto.prototype, "locationId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], BatchRecordDto.prototype, "availableDays", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], BatchRecordDto.prototype, "consumedDays", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], BatchRecordDto.prototype, "hcmVersion", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], BatchRecordDto.prototype, "hcmUpdatedAt", void 0);
class BatchSyncDto {
    batchId;
    generatedAt;
    records;
}
exports.BatchSyncDto = BatchSyncDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BatchSyncDto.prototype, "batchId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BatchSyncDto.prototype, "generatedAt", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => BatchRecordDto),
    (0, class_validator_1.ArrayMinSize)(1),
    __metadata("design:type", Array)
], BatchSyncDto.prototype, "records", void 0);
//# sourceMappingURL=timeoff.dto.js.map