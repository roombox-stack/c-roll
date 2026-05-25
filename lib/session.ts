// Anonymous session token helpers.
//
// V1 ties anonymous uploads and likes to a UUID stored in localStorage on the
// client. The server simply accepts the token as a request parameter and uses
// it as a uniqueness/ownership key (see the partial unique index on `likes`).

export const SESSION_STORAGE_KEY = 'showside_session';

/** Browser only — initializes (and caches in localStorage) an anonymous session UUID. */
export function getOrCreateClientSessionToken(): string {
  if (typeof window === 'undefined') {
    throw new Error('getOrCreateClientSessionToken called on the server');
  }
  let token = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!token) {
    token = crypto.randomUUID();
    window.localStorage.setItem(SESSION_STORAGE_KEY, token);
  }
  return token;
}

/** Validate that a string looks like a v4 UUID. Rejects garbage from clients. */
export function isValidSessionToken(token: unknown): token is string {
  return (
    typeof token === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)
  );
}
