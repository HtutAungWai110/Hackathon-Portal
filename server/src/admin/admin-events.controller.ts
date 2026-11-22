import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Roles } from '@thallesp/nestjs-better-auth';
import { CurrentUser } from '../auth/session/current-user.decorator.js';
import type { PublicUser } from '../auth/session/public-user.js';
import { CreateEventDto } from '../events/dto/create-event.dto.js';
import { CreateSponsorDto } from '../events/dto/create-sponsor.dto.js';
import { ListRegistrationsQueryDto } from '../events/dto/list-registrations-query.dto.js';
import { ReplaceEventDto } from '../events/dto/replace-event.dto.js';
import { UpdateEventDto } from '../events/dto/update-event.dto.js';
import { UpdateSponsorDto } from '../events/dto/update-sponsor.dto.js';
import { EventsService } from '../events/events.service.js';

/**
 * Writing the catalogue. The role check sits on the class, not on each
 * handler, so a route added here later cannot forget it: the JwtAuthGuard
 * reads `@Roles` from the controller as well as the method.
 */
@Controller('admin')
@Roles(['admin'])
export class AdminEventsController {
  constructor(private readonly events: EventsService) {}

  /** Drafts included: this is the console, not the public calendar. */
  @Get('events')
  list() {
    return this.events.listAll();
  }

  /** One event whatever its status, so a draft can be previewed. */
  @Get('events/:id')
  findOne(@Param('id') id: string) {
    return this.events.findOneForAdmin(id);
  }

  /** Feeds the sponsor picker on the event form. */
  @Get('companies')
  companies() {
    return this.events.listCompanies();
  }

  /** One page of this event's applications, newest first. */
  @Get('events/:id/registrations')
  registrations(
    @Param('id') id: string,
    @Query() query: ListRegistrationsQueryDto,
  ) {
    return this.events.listRegistrations(id, query);
  }

  @Post('events')
  create(@Body() body: CreateEventDto, @CurrentUser() user: PublicUser) {
    return this.events.create(body, user.id);
  }

  /** A partial edit: only what is sent changes. Used by the publish toggle. */
  @Patch('events/:id')
  update(@Param('id') id: string, @Body() body: UpdateEventDto) {
    return this.events.update(id, body);
  }

  /** The whole event, as the edit form holds it. Sponsors have their own routes. */
  @Put('events/:id')
  replace(@Param('id') id: string, @Body() body: ReplaceEventDto) {
    return this.events.replace(id, body);
  }

  @Delete('events/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.events.remove(id);
  }

  @Post('events/:id/sponsors')
  addSponsor(@Param('id') id: string, @Body() body: CreateSponsorDto) {
    return this.events.addSponsor(id, body);
  }

  @Patch('events/:id/sponsors/:sponsorId')
  updateSponsor(
    @Param('id') id: string,
    @Param('sponsorId') sponsorId: string,
    @Body() body: UpdateSponsorDto,
  ) {
    return this.events.updateSponsor(id, sponsorId, body);
  }

  @Delete('events/:id/sponsors/:sponsorId')
  @HttpCode(204)
  async removeSponsor(
    @Param('id') id: string,
    @Param('sponsorId') sponsorId: string,
  ): Promise<void> {
    await this.events.removeSponsor(id, sponsorId);
  }
}
