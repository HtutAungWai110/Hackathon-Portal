/** Names shared by the queue registration, the service, and the worker. */
export const MAIL_QUEUE = 'mail';

/** The configured mail settings, resolved once at bootstrap. */
export const MAIL_SETTINGS = Symbol('MAIL_SETTINGS');
