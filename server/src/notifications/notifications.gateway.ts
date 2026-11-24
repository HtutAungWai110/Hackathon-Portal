import { SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { clientOrigins } from '../config/client-origins.js';
import { isBanned } from '../auth/session/public-user.js';
import { SessionService } from '../auth/session/session.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { userSocketRoom } from './notifications.constants.js';
import { NotificationsService } from './notifications.service.js';
import type { NotificationRow } from './notifications.types.js';

/**
 * The two-way channel. The server sends `notification:new`,
 * `notification:read`, and `notification:unreadCount` to the room a user
 * joined after its JWT was verified; the client can send
 * `notification:read` with `{ ids }` for the marks the REST endpoint could
 * not take.
 *
 * The JWT comes through the handshake's `auth.token`, so the websocket is
 * authenticated like an HTTP request rather than by a cookie the server can't
 * read reliably in a cross-origin handshake. Verification mirrors the JWT
 * guard: unknown or banned users are dropped before they join a room.
 */
@WebSocketGateway({
  cors: {
    origin: clientOrigins(),
    // The handshake is authenticated by the JWT in `auth.token`, but the
    // client still connects with credentials, so a wildcard origin would be
    // rejected by the browser. Mirror the HTTP CORS config exactly.
    credentials: true,
  },
})
export class NotificationsGateway {
  private readonly sockets = new Map<string, string>();

  @WebSocketServer() private readonly server!: Server;

  constructor(
    private readonly sessions: SessionService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    let userId: string;
    try {
      userId = await this.authenticate(client);
    } catch {
      client.disconnect(true);
      return;
    }
    this.sockets.set(client.id, userId);
    await client.join(userSocketRoom(userId));
  }

  async handleDisconnect(client: Socket): Promise<void> {
    this.sockets.delete(client.id);
  }

  /**
   * The client sends `{ ids }` with the ids it wants read (its unread set).
   * The mark is idempotent, so sending the same ids again is safe. Nothing is
   * broadcast unless a row exists for this user.
   */
  @SubscribeMessage('notification:read')
  async handleClientRead(client: Socket, payload: unknown): Promise<void> {
    const userId = this.sockets.get(client.id);
    if (userId === undefined) {
      return;
    }
    const ids = (payload as { ids?: unknown } | null)?.ids;
    const idsToMark = Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];
    if (idsToMark.length === 0) {
      return;
    }
    const { marked, unreadCount } = await this.notifications.markReadByIds(
      userId,
      idsToMark,
    );
    if (marked.length > 0) {
      this.emitRead(userId, marked, unreadCount);
    }
  }

  emitNew(row: NotificationRow): void {
    this.server
      .to(userSocketRoom(row.receiverId))
      .emit('notification:new', row);
  }

  /**
   * The read mark and the count go together: a tab that applies the mark must
   * not have to refetch to learn the number the badge should show.
   */
  emitRead(userId: string, ids: string[], unreadCount: number): void {
    this.server
      .to(userSocketRoom(userId))
      .emit('notification:read', { ids, unreadCount });
  }

  emitUnreadCount(userId: string, count: number): void {
    this.server
      .to(userSocketRoom(userId))
      .emit('notification:unreadCount', { count });
  }

  private async authenticate(client: Socket): Promise<string> {
    const auth: { token?: unknown } = client.handshake.auth ?? {};
    const token = typeof auth.token === 'string' ? auth.token : null;
    if (token === null) {
      throw new Error('Unauthorized');
    }
    const claims = await this.sessions.verifyAccess(token);
    const user = await this.prisma.user.findUnique({
      where: { id: claims.userId },
      select: { id: true, banned: true, banExpires: true },
    });
    if (user === null || isBanned(user)) {
      throw new Error('Unauthorized');
    }
    return user.id;
  }
}
