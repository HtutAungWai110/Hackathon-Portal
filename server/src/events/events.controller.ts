import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { CurrentUser } from '../auth/session/current-user.decorator.js';
import type { PublicUser } from '../auth/session/public-user.js';
import { CreateRegistrationDto } from './dto/create-registration.dto.js';
import { EventsService } from './events.service.js';

/**
 * The event surface. Reading is how someone finds an event, so those two
 * routes are anonymous. Applying needs an account: the caller is the
 * participant, and `@CurrentUser` turns an anonymous request on these two
 * routes into a 401.
 */
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @AllowAnonymous()
  list() {
    return this.events.list();
  }

  @Get(':id')
  @AllowAnonymous()
  findOne(@Param('id') id: string) {
    return this.events.findOne(id);
  }

  /** Whether this visitor holds a place, and whether registering is open. */
  @Get(':id/registration')
  registration(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    return this.events.registrationStatus(id, user.id);
  }

  /** Takes a place at a published event. A second application is a 409. */
  @Post(':id/registrations')
  register(@Param('id') id: string, @CurrentUser() user: PublicUser, @Body() body: CreateRegistrationDto) {
    return this.events.register(id, user, body);
  }
}
