import { Controller, Get, Param } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { EventsService } from './events.service.js';

/**
 * The public calendar. Browsing is how someone finds an event, so it does not
 * ask for a token; drafts and cancellations are filtered out by the service.
 */
@Controller('events')
@AllowAnonymous()
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list() {
    return this.events.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.events.findOne(id);
  }
}
