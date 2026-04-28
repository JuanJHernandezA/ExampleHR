import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateTimeOffRequestDto {
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @IsInt()
  @Min(1)
  daysRequested!: number;
}

export class ApproveRequestDto {
  @IsString()
  @IsNotEmpty()
  managerId!: string;
}

export class RejectRequestDto {
  @IsString()
  @IsNotEmpty()
  managerId!: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class CancelRequestDto {
  @IsString()
  @IsNotEmpty()
  actorId!: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class RealtimeSyncDto {
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @IsInt()
  @Min(0)
  availableDays!: number;

  @IsInt()
  @Min(0)
  consumedDays!: number;

  @IsInt()
  @IsOptional()
  hcmVersion?: number;

  @IsString()
  @IsOptional()
  hcmUpdatedAt?: string;

  @IsString()
  @IsNotEmpty()
  eventId!: string;
}

export class BatchRecordDto {
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @IsInt()
  @Min(0)
  availableDays!: number;

  @IsInt()
  @Min(0)
  consumedDays!: number;

  @IsInt()
  @IsOptional()
  hcmVersion?: number;

  @IsString()
  @IsOptional()
  hcmUpdatedAt?: string;
}

export class BatchSyncDto {
  @IsString()
  @IsNotEmpty()
  batchId!: string;

  @IsString()
  @IsNotEmpty()
  generatedAt!: string;

  @ValidateNested({ each: true })
  @Type(() => BatchRecordDto)
  @ArrayMinSize(1)
  records!: BatchRecordDto[];
}
