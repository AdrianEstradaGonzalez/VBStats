/**
 * Shared HTTP layer.
 *
 * Every authenticated call goes through `apiFetch`, which attaches the session token
 * as `Authorization: Bearer <token>`. The server derives the caller's identity from
 * that header — user ids in the URL or body are no longer trusted on their own.
 *
 * The token lives here (module scope) plus AsyncStorage, so services don't each need
 * to thread it through their signatures.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@VBStats:sessionToken';
const DEFAULT_TIMEOUT_MS = 15000;

let sessionToken: string | null = null;

/** Called on login / register / Google sign-in / session restore. */
export const setSessionToken = async (token: string | null): Promise<void> => {
  sessionToken = token;
  try {
    if (token) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } else {
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  } catch (error) {
    console.error('Error persisting session token:', error);
  }
};

/** Restores the token on cold start, before any API call is made. */
export const loadSessionToken = async (): Promise<string | null> => {
  try {
    sessionToken = await AsyncStorage.getItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error reading session token:', error);
    sessionToken = null;
  }
  return sessionToken;
};

export const getSessionToken = (): string | null => sessionToken;

export const clearSessionToken = async (): Promise<void> => setSessionToken(null);

/**
 * Raised when the server rejects the session (expired, or signed in on another device).
 * Screens can catch this to send the user back to the login flow.
 */
export class UnauthorizedError extends Error {
  constructor(message = 'Sesión no válida') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

type ApiFetchOptions = RequestInit & { timeoutMs?: number; skipAuth?: boolean };

/**
 * fetch wrapper that adds the bearer token and a request timeout.
 * Returns the raw Response so callers keep their existing error handling.
 */
export const apiFetch = async (url: string, options: ApiFetchOptions = {}): Promise<Response> => {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, skipAuth = false, headers, ...rest } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const finalHeaders: Record<string, string> = {
    ...(headers as Record<string, string> | undefined),
  };
  if (!skipAuth && sessionToken) {
    finalHeaders.Authorization = `Bearer ${sessionToken}`;
  }

  try {
    return await fetch(url, { ...rest, headers: finalHeaders, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

/** apiFetch + JSON body, for the common POST/PUT case. */
export const apiFetchJson = async (
  url: string,
  method: string,
  body?: unknown,
  options: ApiFetchOptions = {}
): Promise<Response> =>
  apiFetch(url, {
    ...options,
    method,
    headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> | undefined) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
