/** The BullMQ queue name for the notifications module. */
export const NOTIFICATION_QUEUE = 'notifications';

/** The socket room a signed in user's sockets join. Rooms are joined by the
 *  gateway after its auth middleware accepts the JWT. */
export function userSocketRoom(userId: string): string {
  return `user:${userId}`;
}
