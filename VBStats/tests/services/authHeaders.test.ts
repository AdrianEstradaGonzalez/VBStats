/**
 * Guard against services that bypass the auth layer.
 *
 * Regression: when the app moved to token authentication, subscriptionService,
 * appleIAPService and two screens were missed and kept calling bare `fetch`. The
 * server answered 401 and the client's "any failure means free" fallback silently
 * downgraded every paying user to the free plan.
 *
 * These tests assert the header is actually attached, so a future service that
 * forgets to go through `apiFetch` fails here instead of in production.
 */

import { setSessionToken, clearSessionToken } from '../../services/http';
import { subscriptionService } from '../../services/subscriptionService';
import { teamsService } from '../../services/teamsService';
import { matchesService } from '../../services/matchesService';
import { statsService } from '../../services/statsService';
import { settingsService } from '../../services/settingsService';
import { playersService } from '../../services/playersService';
import { adminService } from '../../services/adminService';
import { usersService } from '../../services/usersService';
import { setFetchMock, clearFetchMock, mockFetchSuccess } from '../helpers/mockFetch';

const TOKEN = 'test-session-token-abc123';

beforeEach(async () => {
  await setSessionToken(TOKEN);
});

afterEach(async () => {
  clearFetchMock();
  await clearSessionToken();
});

/** Authorization header of the last fetch call, if any. */
const lastAuthHeader = (mock: jest.Mock): string | undefined => {
  const [, options] = mock.mock.calls[mock.mock.calls.length - 1];
  return options?.headers?.Authorization;
};

describe('every authenticated service attaches the session token', () => {
  const cases: Array<[string, () => Promise<unknown>]> = [
    ['subscriptionService.getSubscription', () => subscriptionService.getSubscription(1)],
    ['subscriptionService.cancelSubscription', () => subscriptionService.cancelSubscription(1)],
    ['subscriptionService.checkTrialEligibility', () => subscriptionService.checkTrialEligibility(1, 'dev')],
    ['subscriptionService.startTrial', () => subscriptionService.startTrial(1, 'pro', 'dev')],
    ['subscriptionService.verifyCheckoutSession', () => subscriptionService.verifyCheckoutSession('cs_1', 1)],
    ['subscriptionService.createCheckoutSessionWithTrial', () => subscriptionService.createCheckoutSessionWithTrial(1, 'pro', 'dev', false)],
    ['teamsService.getAll', () => teamsService.getAll(1)],
    ['matchesService.getAll', () => matchesService.getAll()],
    ['statsService.getMatchStats', () => statsService.getMatchStats(1)],
    ['settingsService.getAll', () => settingsService.getAll()],
    ['playersService.getAll', () => playersService.getAll()],
    ['adminService.getUsers', () => adminService.getUsers()],
    ['adminService.isSuperadmin', () => adminService.isSuperadmin()],
    ['usersService.getSession', () => usersService.getSession(1)],
  ];

  test.each(cases)('%s sends Authorization: Bearer', async (_name, call) => {
    const mock = setFetchMock(mockFetchSuccess({ type: 'pro', isSuperadmin: true, session_token: TOKEN }));
    await call().catch(() => {
      // Some services swallow errors and return a default; the header check below
      // is what matters, and the call was still made.
    });

    expect(mock).toHaveBeenCalled();
    expect(lastAuthHeader(mock)).toBe(`Bearer ${TOKEN}`);
  });
});

describe('pre-login endpoints do NOT send a token', () => {
  const cases: Array<[string, () => Promise<unknown>]> = [
    ['usersService.login', () => usersService.login({ email: 'a@b.c', password: 'x' })],
    ['usersService.forgotPassword', () => usersService.forgotPassword('a@b.c')],
    ['usersService.verifyResetToken', () => usersService.verifyResetToken('a@b.c', '1234abcd')],
    ['usersService.googleSignIn', () => usersService.googleSignIn('id-token')],
  ];

  test.each(cases)('%s omits Authorization', async (_name, call) => {
    const mock = setFetchMock(mockFetchSuccess({ id: 1, email: 'a@b.c', valid: true }));
    await call().catch(() => {});

    expect(mock).toHaveBeenCalled();
    expect(lastAuthHeader(mock)).toBeUndefined();
  });
});

describe('subscription is not silently downgraded by a transient failure', () => {
  test('a server error keeps the last confirmed plan instead of returning free', async () => {
    // First call succeeds and caches 'pro'.
    setFetchMock(mockFetchSuccess({ type: 'pro' }));
    const first = await subscriptionService.getSubscription(42);
    expect(first.type).toBe('pro');

    // Server hiccups: must not report the user as free.
    clearFetchMock();
    setFetchMock(jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'boom' }),
    }) as unknown as jest.Mock);

    const second = await subscriptionService.getSubscription(42);
    expect(second.type).toBe('pro');
  });

  test('an explicit 401 does report free', async () => {
    setFetchMock(jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'AUTH_REQUIRED' }),
    }) as unknown as jest.Mock);

    const result = await subscriptionService.getSubscription(99);
    expect(result.type).toBe('free');
  });
});
