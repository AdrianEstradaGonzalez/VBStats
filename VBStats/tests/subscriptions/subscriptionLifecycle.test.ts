/// <reference types="jest" />
/**
 * Tests for Subscription Lifecycle
 *
 * Covers: fetching subscription state, cancellation, trial eligibility,
 * trial start, checkout sessions, verification, downgrade prevention,
 * and auto-renewal logic.
 */

import { subscriptionService, TRIAL_DAYS } from '../../services/subscriptionService';
import {
  mockFetchSuccess,
  mockFetchError,
  mockFetchNetworkError,
  setFetchMock,
  clearFetchMock,
  mockFetchSequence,
} from '../helpers/mockFetch';

afterEach(() => clearFetchMock());

// ─── getSubscription ─────────────────────────────────────────────────

describe('subscriptionService.getSubscription', () => {
  test('returns server data for active subscription', async () => {
    setFetchMock(mockFetchSuccess({
      type: 'pro',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      autoRenew: true,
      cancelledAt: null,
    }));

    const sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('pro');
    expect(sub.autoRenew).toBe(true);
  });

  test('returns free when subscription has expired', async () => {
    setFetchMock(mockFetchSuccess({
      type: 'basic',
      expiresAt: new Date(Date.now() - 86400000).toISOString(), // yesterday
    }));

    const sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('free');
  });

  test('returns free on server error', async () => {
    setFetchMock(mockFetchError({ error: 'Server error' }, 500));
    const sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('free');
  });

  test('returns free on network error', async () => {
    setFetchMock(mockFetchNetworkError());
    const sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('free');
  });

  test('returns data as-is when type is not present in response (no expiry)', async () => {
    setFetchMock(mockFetchSuccess({}));
    const sub = await subscriptionService.getSubscription(1);
    // When server returns {} with no type and no expiresAt, the raw data is returned
    expect(sub.type).toBeUndefined();
  });
});

// ─── validateSubscription ────────────────────────────────────────────

describe('subscriptionService.validateSubscription', () => {
  test('returns server-validated type', async () => {
    setFetchMock(mockFetchSuccess({ type: 'basic' }));
    const type = await subscriptionService.validateSubscription(1);
    expect(type).toBe('basic');
  });

  test('returns free when server is down', async () => {
    setFetchMock(mockFetchNetworkError());
    const type = await subscriptionService.validateSubscription(99);
    expect(type).toBe('free');
  });
});

// ─── validateFeatureAccess ───────────────────────────────────────────

describe('subscriptionService.validateFeatureAccess', () => {
  test('returns true for pro user on any feature', async () => {
    setFetchMock(mockFetchSuccess({ type: 'pro' }));
    expect(await subscriptionService.validateFeatureAccess(1, 'anything')).toBe(true);
  });

  test('returns false for free user on teams_limited', async () => {
    setFetchMock(mockFetchSuccess({ type: 'free' }));
    expect(await subscriptionService.validateFeatureAccess(1, 'teams_limited')).toBe(false);
  });
});

// ─── updateSubscription ──────────────────────────────────────────────

describe('subscriptionService.updateSubscription', () => {
  test('allows downgrade to free', async () => {
    setFetchMock(mockFetchSuccess({ success: true }));
    const result = await subscriptionService.updateSubscription(1, 'free');
    expect(result).toBe(true);
  });

  test('rejects direct upgrade to basic', async () => {
    const result = await subscriptionService.updateSubscription(1, 'basic');
    expect(result).toBe(false);
  });

  test('rejects direct upgrade to pro', async () => {
    const result = await subscriptionService.updateSubscription(1, 'pro');
    expect(result).toBe(false);
  });

  test('returns false on server error', async () => {
    setFetchMock(mockFetchError({ error: 'fail' }, 500));
    const result = await subscriptionService.updateSubscription(1, 'free');
    expect(result).toBe(false);
  });
});

// ─── cancelSubscription ──────────────────────────────────────────────

describe('subscriptionService.cancelSubscription', () => {
  test('returns success with expiry dates on successful cancel', async () => {
    const expiresAt = new Date(Date.now() + 86400000 * 30).toISOString();
    const cancelledAt = new Date().toISOString();
    setFetchMock(mockFetchSuccess({ expiresAt, cancelledAt }));

    const result = await subscriptionService.cancelSubscription(1);
    expect(result.success).toBe(true);
    expect(result.expiresAt).toBe(expiresAt);
    expect(result.cancelledAt).toBe(cancelledAt);
  });

  test('returns error message on server rejection', async () => {
    setFetchMock(mockFetchError({ error: 'No active subscription' }, 400));
    const result = await subscriptionService.cancelSubscription(1);
    expect(result.success).toBe(false);
    expect(result.error).toBe('No active subscription');
  });

  test('returns connection error on network failure', async () => {
    setFetchMock(mockFetchNetworkError());
    const result = await subscriptionService.cancelSubscription(1);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Error de conexión');
  });
});

// ─── Trial eligibility ──────────────────────────────────────────────

describe('subscriptionService.checkTrialEligibility', () => {
  test('returns eligible when neither device nor user used trial', async () => {
    setFetchMock(mockFetchSuccess({
      eligible: true,
      deviceUsedTrial: false,
      userUsedTrial: false,
      currentTrial: null,
      trialDays: TRIAL_DAYS,
    }));

    const result = await subscriptionService.checkTrialEligibility(1, 'device-123');
    expect(result.eligible).toBe(true);
    expect(result.deviceUsedTrial).toBe(false);
    expect(result.userUsedTrial).toBe(false);
    expect(result.trialDays).toBe(7);
  });

  test('returns ineligible when device already used trial', async () => {
    setFetchMock(mockFetchSuccess({
      eligible: false,
      deviceUsedTrial: true,
      userUsedTrial: false,
      currentTrial: null,
      trialDays: TRIAL_DAYS,
    }));

    const result = await subscriptionService.checkTrialEligibility(1, 'device-123');
    expect(result.eligible).toBe(false);
    expect(result.deviceUsedTrial).toBe(true);
  });

  test('returns ineligible when user already used trial', async () => {
    setFetchMock(mockFetchSuccess({
      eligible: false,
      deviceUsedTrial: false,
      userUsedTrial: true,
      currentTrial: null,
      trialDays: TRIAL_DAYS,
    }));

    const result = await subscriptionService.checkTrialEligibility(1, 'device-456');
    expect(result.eligible).toBe(false);
    expect(result.userUsedTrial).toBe(true);
  });

  test('returns current trial info when an active trial exists', async () => {
    const trialInfo = {
      planType: 'pro' as const,
      endsAt: new Date(Date.now() + 86400000 * 5).toISOString(),
      daysRemaining: 5,
    };
    setFetchMock(mockFetchSuccess({
      eligible: false,
      deviceUsedTrial: true,
      userUsedTrial: true,
      currentTrial: trialInfo,
      trialDays: TRIAL_DAYS,
    }));

    const result = await subscriptionService.checkTrialEligibility(1, 'device-123');
    expect(result.currentTrial).toEqual(trialInfo);
  });

  test('returns safe defaults on network error', async () => {
    setFetchMock(mockFetchNetworkError());
    const result = await subscriptionService.checkTrialEligibility(1, 'device-123');
    expect(result.eligible).toBe(false);
    expect(result.trialDays).toBe(TRIAL_DAYS);
  });
});

// ─── Start trial ─────────────────────────────────────────────────────

describe('subscriptionService.startTrial', () => {
  test('starts trial successfully', async () => {
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();
    setFetchMock(mockFetchSuccess({ trialEndsAt }));

    const result = await subscriptionService.startTrial(1, 'pro', 'device-123');
    expect(result.success).toBe(true);
    expect(result.trialEndsAt).toBe(trialEndsAt);
  });

  test('returns error when server rejects', async () => {
    setFetchMock(mockFetchError({ error: 'Trial already used' }, 400));
    const result = await subscriptionService.startTrial(1, 'pro', 'device-123');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Trial already used');
  });

  test('returns connection error on network failure', async () => {
    setFetchMock(mockFetchNetworkError());
    const result = await subscriptionService.startTrial(1, 'pro', 'device-123');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Error de conexión');
  });
});

// ─── Checkout session ────────────────────────────────────────────────

describe('subscriptionService.createCheckoutSession', () => {
  test('creates checkout session successfully', async () => {
    setFetchMock(mockFetchSuccess({ url: 'https://checkout.stripe.com/session-123' }));
    const result = await subscriptionService.createCheckoutSession(1, 'pro');
    expect(result.sessionUrl).toBe('https://checkout.stripe.com/session-123');
    expect(result.error).toBeUndefined();
  });

  test('rejects invalid plan (free)', async () => {
    const result = await subscriptionService.createCheckoutSession(1, 'free');
    expect(result.error).toBe('Plan no válido');
  });

  test('returns error on server failure', async () => {
    setFetchMock(mockFetchError({ message: 'Stripe error' }, 500));
    const result = await subscriptionService.createCheckoutSession(1, 'basic');
    expect(result.error).toBe('Stripe error');
  });
});

// ─── Checkout session with trial ─────────────────────────────────────

describe('subscriptionService.createCheckoutSessionWithTrial', () => {
  test('creates checkout with trial flag', async () => {
    setFetchMock(mockFetchSuccess({ url: 'https://checkout.stripe.com/trial', sessionId: 'sess_123' }));
    const result = await subscriptionService.createCheckoutSessionWithTrial(1, 'pro', 'device-xxx', true);
    expect(result.sessionUrl).toContain('checkout.stripe.com');
    expect(result.sessionId).toBe('sess_123');
  });

  test('rejects invalid plan', async () => {
    const result = await subscriptionService.createCheckoutSessionWithTrial(1, 'free', 'device-xxx');
    expect(result.error).toBe('Plan no válido');
  });
});

// ─── Verify checkout session ─────────────────────────────────────────

describe('subscriptionService.verifyCheckoutSession', () => {
  test('returns success with subscription type', async () => {
    setFetchMock(mockFetchSuccess({ success: true, type: 'pro', isTrial: false }));
    const result = await subscriptionService.verifyCheckoutSession('sess_123', 1);
    expect(result.success).toBe(true);
    expect(result.type).toBe('pro');
  });

  test('returns trial info when session was trial', async () => {
    setFetchMock(mockFetchSuccess({ success: true, type: 'pro', isTrial: true }));
    const result = await subscriptionService.verifyCheckoutSession('sess_trial', 1);
    expect(result.isTrial).toBe(true);
  });

  test('returns error on verification failure', async () => {
    setFetchMock(mockFetchError({ error: 'Session not found' }, 404));
    const result = await subscriptionService.verifyCheckoutSession('sess_invalid', 1);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Session not found');
  });
});

// ─── Search by code ──────────────────────────────────────────────────

describe('subscriptionService.searchByCode', () => {
  test('finds match by valid code', async () => {
    setFetchMock(mockFetchSuccess({ id: 42 }));
    const result = await subscriptionService.searchByCode('ABC12345');
    expect(result.matchId).toBe(42);
  });

  test('returns not-found error for 404', async () => {
    setFetchMock(mockFetchError({}, 404));
    const result = await subscriptionService.searchByCode('INVALID1');
    expect(result.error).toBe('Código no encontrado');
  });

  test('returns generic error for server error', async () => {
    setFetchMock(mockFetchError({}, 500));
    const result = await subscriptionService.searchByCode('BROKEN11');
    expect(result.error).toBe('Error al buscar el partido');
  });

  test('returns connection error on network failure', async () => {
    setFetchMock(mockFetchNetworkError());
    const result = await subscriptionService.searchByCode('NTWRK123');
    expect(result.error).toBe('Error de conexión');
  });
});
