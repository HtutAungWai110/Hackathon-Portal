import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module.js';
import { AdminController } from './admin.controller.js';
import { AdminEventsController } from './admin-events.controller.js';

@Module({
  imports: [EventsModule],
  controllers: [AdminController, AdminEventsController],
})
export class AdminModule {}
