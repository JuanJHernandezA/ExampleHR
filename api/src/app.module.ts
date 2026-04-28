import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { TimeoffController } from './timeoff/timeoff.controller';
import { TimeoffService } from './timeoff/timeoff.service';

@Module({
  imports: [],
  controllers: [TimeoffController],
  providers: [DatabaseService, TimeoffService],
})
export class AppModule {}
