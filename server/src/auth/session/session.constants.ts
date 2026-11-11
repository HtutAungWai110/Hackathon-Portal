/**
 * Cookie names, token lifetimes, and the claims that keep an access token from
 * being accepted where a refresh token is expected (and the other way round).
 */
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

/** The access cookie is sent to every route, because it is the API credential. */
export const ACCESS_COOKIE_PATH = '/';

/**
 * The refresh cookie is only sent to the session routes. Path scoping keeps a
 * seven day credential off every ordinary API request.
 */
export const REFRESH_COOKIE_PATH = '/session';

export const TOKEN_ISSUER = 'hackathon-api';
export const ACCESS_TOKEN_AUDIENCE = 'hackathon-api:access';
export const REFRESH_TOKEN_AUDIENCE = 'hackathon-api:refresh';
