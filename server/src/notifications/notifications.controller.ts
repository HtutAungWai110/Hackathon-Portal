import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/session/current-user.decorator.js';
import type { PublicUser } from '../auth/session/public-user.js';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { NotificationsService } from './notifications.service.js';

/**
 * The read side of the notice inbox. Everything the client can do without a
 * job is a request here; delivery of new rows is over the websocket.
 */
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly gateway: NotificationsGateway,
  ) {}

  /** The unread page for the bell: rows plus the total unread count. */
  @Get()
  list(
    @CurrentUser() user: PublicUser,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notifications.listUnread(user.id, query.page ?? 1, query.limit ?? 50);
  }

  /** Marks rows read; the broadcast over the socket tells other tabs. */
  @Patch(':id/read')
  async readOne(
    @CurrentUser() user: PublicUser,
    @Param('id') id: string,
  ): Promise<{ id: string; read: true; unreadCount: number }> {
    const { marked, unreadCount } = await this.notifications.markReadByIds(
      user.id,
      [id],
    );
    if (marked.length === 0) {
      throw new NotFoundException('No notification with that id.');
    }
    // Another tab may be showing the same row as unread; the same ids and
    // count it would get from the socket path go out here too.
    this.gateway.emitRead(user.id, marked, unreadCount);
    return { id, read: true, unreadCount };
  }

  /** Clears the whole inbox for this user. */
  @Post('read-all')
  async readAll(@CurrentUser() user: PublicUser): Promise<{ count: number }> {
    const count = await this.notifications.markReadAll(user.id);
    this.gateway.emitUnreadCount(user.id, 0);
    return { count };
  }
}
