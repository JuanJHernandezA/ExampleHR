import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApproveRequestDto,
  BatchSyncDto,
  CancelRequestDto,
  CreateTimeOffRequestDto,
  RejectRequestDto,
  RealtimeSyncDto,
} from './timeoff.dto';
import { TimeoffService } from './timeoff.service';

@Controller()
export class TimeoffController {
  constructor(private readonly timeoffService: TimeoffService) {}

  @Get('/time-off-requests')
  getRequests() {
    return this.timeoffService.getRequests();
  }

  @Get('/time-off-requests/:id')
  getRequestById(@Param('id') id: string) {
    return this.timeoffService.getRequestById(id);
  }

  @Get('/balances/:employeeId/:locationId')
  getBalance(@Param('employeeId') employeeId: string, @Param('locationId') locationId: string) {
    return this.timeoffService.getBalance(employeeId, locationId);
  }

  @Post('/time-off-requests')
  createRequest(
    @Body() dto: CreateTimeOffRequestDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.timeoffService.createRequest(dto, idempotencyKey);
  }

  @Post('/time-off-requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  approveRequest(@Param('id') id: string, @Body() dto: ApproveRequestDto) {
    return this.timeoffService.approveRequest(id, dto.managerId);
  }

  @Post('/time-off-requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  rejectRequest(@Param('id') id: string, @Body() dto: RejectRequestDto) {
    return this.timeoffService.rejectRequest(id, dto.managerId);
  }

  @Post('/time-off-requests/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelRequest(@Param('id') id: string, @Body() dto: CancelRequestDto) {
    return this.timeoffService.cancelRequest(id, dto.actorId);
  }

  @Post('/sync/hcm/realtime')
  @HttpCode(HttpStatus.ACCEPTED)
  syncRealtime(@Body() dto: RealtimeSyncDto) {
    return this.timeoffService.syncRealtime(dto);
  }

  @Post('/sync/hcm/batch')
  @HttpCode(HttpStatus.ACCEPTED)
  syncBatch(@Body() dto: BatchSyncDto) {
    return this.timeoffService.syncBatch(dto);
  }
}
