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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeoffController = void 0;
const common_1 = require("@nestjs/common");
const timeoff_dto_1 = require("./timeoff.dto");
const timeoff_service_1 = require("./timeoff.service");
let TimeoffController = class TimeoffController {
    timeoffService;
    constructor(timeoffService) {
        this.timeoffService = timeoffService;
    }
    getRequests() {
        return this.timeoffService.getRequests();
    }
    getRequestById(id) {
        return this.timeoffService.getRequestById(id);
    }
    getBalance(employeeId, locationId) {
        return this.timeoffService.getBalance(employeeId, locationId);
    }
    createRequest(dto, idempotencyKey) {
        return this.timeoffService.createRequest(dto, idempotencyKey);
    }
    approveRequest(id, dto) {
        return this.timeoffService.approveRequest(id, dto.managerId);
    }
    rejectRequest(id, dto) {
        return this.timeoffService.rejectRequest(id, dto.managerId);
    }
    cancelRequest(id, dto) {
        return this.timeoffService.cancelRequest(id, dto.actorId);
    }
    syncRealtime(dto) {
        return this.timeoffService.syncRealtime(dto);
    }
    syncBatch(dto) {
        return this.timeoffService.syncBatch(dto);
    }
};
exports.TimeoffController = TimeoffController;
__decorate([
    (0, common_1.Get)('/time-off-requests'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TimeoffController.prototype, "getRequests", null);
__decorate([
    (0, common_1.Get)('/time-off-requests/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TimeoffController.prototype, "getRequestById", null);
__decorate([
    (0, common_1.Get)('/balances/:employeeId/:locationId'),
    __param(0, (0, common_1.Param)('employeeId')),
    __param(1, (0, common_1.Param)('locationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], TimeoffController.prototype, "getBalance", null);
__decorate([
    (0, common_1.Post)('/time-off-requests'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [timeoff_dto_1.CreateTimeOffRequestDto, String]),
    __metadata("design:returntype", void 0)
], TimeoffController.prototype, "createRequest", null);
__decorate([
    (0, common_1.Post)('/time-off-requests/:id/approve'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, timeoff_dto_1.ApproveRequestDto]),
    __metadata("design:returntype", void 0)
], TimeoffController.prototype, "approveRequest", null);
__decorate([
    (0, common_1.Post)('/time-off-requests/:id/reject'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, timeoff_dto_1.RejectRequestDto]),
    __metadata("design:returntype", void 0)
], TimeoffController.prototype, "rejectRequest", null);
__decorate([
    (0, common_1.Post)('/time-off-requests/:id/cancel'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, timeoff_dto_1.CancelRequestDto]),
    __metadata("design:returntype", void 0)
], TimeoffController.prototype, "cancelRequest", null);
__decorate([
    (0, common_1.Post)('/sync/hcm/realtime'),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [timeoff_dto_1.RealtimeSyncDto]),
    __metadata("design:returntype", void 0)
], TimeoffController.prototype, "syncRealtime", null);
__decorate([
    (0, common_1.Post)('/sync/hcm/batch'),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [timeoff_dto_1.BatchSyncDto]),
    __metadata("design:returntype", void 0)
], TimeoffController.prototype, "syncBatch", null);
exports.TimeoffController = TimeoffController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [timeoff_service_1.TimeoffService])
], TimeoffController);
//# sourceMappingURL=timeoff.controller.js.map