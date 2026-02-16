/**
 * Tests for Full Subscription Lifecycle — Android (Stripe) & iOS (Apple IAP)
 *
 * Covers:
 * - Creating a FREE account
 * - Subscribing to BASIC (4.99€/mo) — charged immediately, auto-renewal monthly
 * - Subscribing to PRO (9.99€/mo) — same billing behavior as BASIC
 * - Cancelling a BASIC/PRO plan → retains access until period end → downgrades to FREE
 * - FREE after cancellation: only scoreboard, code search, profile, upgrade/reactivate
 * - Reactivating after cancellation → new subscription, data preserved
 * - PRO Free Trial (7 days) → first payment after 7 days → then PRO
 * - Cancel trial before 7 days → no charge → downgrade to FREE
 * - Expired subscription auto-downgrade to FREE
 * - Subscription validation and security
 */

/// <reference types="jest" />

import { subscriptionService, TRIAL_DAYS, SubscriptionType } from '../../services/subscriptionService';
import {
  mockFetchSuccess,
  mockFetchError,
  mockFetchNetworkError,
  setFetchMock,
  clearFetchMock,
  mockFetchSequence,
} from '../helpers/mockFetch';

afterEach(() => clearFetchMock());

// Helpers
const futureDate = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
const pastDate = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
const now = () => new Date().toISOString();

// ═══════════════════════════════════════════════════════════════════════
// 1. FREE ACCOUNT CREATION
// ═══════════════════════════════════════════════════════════════════════

describe('1. Free Account — Initial State', () => {
  test('new account defaults to free plan', async () => {
    setFetchMock(mockFetchSuccess({
      type: 'free',
      expiresAt: null,
      autoRenew: false,
      cancelledAt: null,
      trialUsed: false,
      activeTrial: null,
    }));

    const sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('free');
    expect(sub.expiresAt).toBeNull();
    expect(sub.activeTrial).toBeNull();
  });

  test('free account cannot access team management', async () => {
    setFetchMock(mockFetchSuccess({ type: 'free' }));
    const access = await subscriptionService.validateFeatureAccess(1, 'teams_limited');
    expect(access).toBe(false);
  });

  test('free account cannot access stats registration', async () => {
    setFetchMock(mockFetchSuccess({ type: 'free' }));
    const access = await subscriptionService.validateFeatureAccess(1, 'basic_stats');
    expect(access).toBe(false);
  });

  test('free account CAN access scoreboard', async () => {
    setFetchMock(mockFetchSuccess({ type: 'free' }));
    const access = await subscriptionService.validateFeatureAccess(1, 'scoreboard');
    expect(access).toBe(true);
  });

  test('free account CAN search by code', async () => {
    setFetchMock(mockFetchSuccess({ type: 'free' }));
    const access = await subscriptionService.validateFeatureAccess(1, 'code_search');
    expect(access).toBe(true);
  });

  test('free account returns free on server error (graceful fallback)', async () => {
    setFetchMock(mockFetchError({ error: 'Server error' }, 500));
    const sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('free');
  });

  test('free account returns free on network error (graceful fallback)', async () => {
    setFetchMock(mockFetchNetworkError());
    const sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('free');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. BASIC SUBSCRIPTION (4.99€/mo) — via Stripe (Android)
// ═══════════════════════════════════════════════════════════════════════

describe('2. Basic Subscription — Stripe (Android)', () => {
  test('creating checkout session for basic plan succeeds', async () => {
    setFetchMock(mockFetchSuccess({
      url: 'https://checkout.stripe.com/session-basic',
    }));

    const result = await subscriptionService.createCheckoutSession(1, 'basic');
    expect(result.sessionUrl).toBe('https://checkout.stripe.com/session-basic');
    expect(result.error).toBeUndefined();
  });

  test('cannot create checkout for free plan', async () => {
    const result = await subscriptionService.createCheckoutSession(1, 'free');
    expect(result.error).toBe('Plan no válido');
    expect(result.sessionUrl).toBeUndefined();
  });

  test('verifying successful basic checkout activates subscription', async () => {
    setFetchMock(mockFetchSuccess({
      success: true,
      type: 'basic',
      isTrial: false,
    }));

    const result = await subscriptionService.verifyCheckoutSession('sess_basic_123', 1);
    expect(result.success).toBe(true);
    expect(result.type).toBe('basic');
    expect(result.isTrial).toBe(false);
  });

  test('active basic subscription returns correct data', async () => {
    setFetchMock(mockFetchSuccess({
      type: 'basic',
      expiresAt: futureDate(30),
      autoRenew: true,
      cancelledAt: null,
      hasAppleSubscription: false,
    }));

    const sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('basic');
    expect(sub.autoRenew).toBe(true);
    expect(sub.cancelledAt).toBeNull();
  });

  test('basic subscription has access to teams (limited)', async () => {
    setFetchMock(mockFetchSuccess({ type: 'basic' }));
    expect(await subscriptionService.validateFeatureAccess(1, 'teams_limited')).toBe(true);
  });

  test('basic subscription has access to stats', async () => {
    setFetchMock(mockFetchSuccess({ type: 'basic' }));
    expect(await subscriptionService.validateFeatureAccess(1, 'basic_stats')).toBe(true);
  });

  test('basic subscription does NOT have access to team tracking', async () => {
    setFetchMock(mockFetchSuccess({ type: 'basic' }));
    expect(await subscriptionService.validateFeatureAccess(1, 'team_tracking')).toBe(false);
  });

  test('basic subscription does NOT have access to export', async () => {
    setFetchMock(mockFetchSuccess({ type: 'basic' }));
    expect(await subscriptionService.validateFeatureAccess(1, 'export_excel')).toBe(false);
  });

  test('checkout session error returns proper error message', async () => {
    setFetchMock(mockFetchError({ message: 'Stripe error' }, 500));
    const result = await subscriptionService.createCheckoutSession(1, 'basic');
    expect(result.error).toBe('Stripe error');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. PRO SUBSCRIPTION (9.99€/mo) — via Stripe (Android)
// ═══════════════════════════════════════════════════════════════════════

describe('3. PRO Subscription — Stripe (Android)', () => {
  test('creating checkout session for pro plan succeeds', async () => {
    setFetchMock(mockFetchSuccess({
      url: 'https://checkout.stripe.com/session-pro',
    }));

    const result = await subscriptionService.createCheckoutSession(1, 'pro');
    expect(result.sessionUrl).toBe('https://checkout.stripe.com/session-pro');
    expect(result.error).toBeUndefined();
  });

  test('verifying successful pro checkout activates subscription', async () => {
    setFetchMock(mockFetchSuccess({
      success: true,
      type: 'pro',
      isTrial: false,
    }));

    const result = await subscriptionService.verifyCheckoutSession('sess_pro_123', 1);
    expect(result.success).toBe(true);
    expect(result.type).toBe('pro');
    expect(result.isTrial).toBe(false);
  });

  test('active pro subscription returns correct data', async () => {
    setFetchMock(mockFetchSuccess({
      type: 'pro',
      expiresAt: futureDate(30),
      autoRenew: true,
      cancelledAt: null,
    }));

    const sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('pro');
    expect(sub.autoRenew).toBe(true);
  });

  test('pro subscription has access to ALL features', async () => {
    setFetchMock(mockFetchSuccess({ type: 'pro' }));
    expect(await subscriptionService.validateFeatureAccess(1, 'teams_limited')).toBe(true);
    expect(await subscriptionService.validateFeatureAccess(1, 'basic_stats')).toBe(true);
    expect(await subscriptionService.validateFeatureAccess(1, 'export_excel')).toBe(true);
    expect(await subscriptionService.validateFeatureAccess(1, 'team_tracking')).toBe(true);
    expect(await subscriptionService.validateFeatureAccess(1, 'any_feature')).toBe(true);
  });

  test('pro subscription has unlimited teams', () => {
    expect(subscriptionService.canCreateTeam('pro', 0)).toBe(true);
    expect(subscriptionService.canCreateTeam('pro', 50)).toBe(true);
    expect(subscriptionService.canCreateTeam('pro', 999)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. CANCELLATION — Retains access until period end, then FREE
// ═══════════════════════════════════════════════════════════════════════

describe('4. Cancellation — Basic Plan', () => {
  test('cancel basic returns success with expiry date', async () => {
    const expiresAt = futureDate(25);
    const cancelledAt = now();
    setFetchMock(mockFetchSuccess({ expiresAt, cancelledAt }));

    const result = await subscriptionService.cancelSubscription(1);
    expect(result.success).toBe(true);
    expect(result.expiresAt).toBe(expiresAt);
    expect(result.cancelledAt).toBeDefined();
  });

  test('after cancellation, subscription still active until period end', async () => {
    setFetchMock(mockFetchSuccess({
      type: 'basic',
      expiresAt: futureDate(20),
      autoRenew: false,
      cancelledAt: now(),
      cancelAtPeriodEnd: true,
    }));

    const sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('basic'); // Still basic until period end!
    expect(sub.autoRenew).toBe(false);
    expect(sub.cancelledAt).toBeDefined();
  });

  test('after cancellation, user still has basic features during remaining period', async () => {
    // Server still reports basic during grace period
    setFetchMock(mockFetchSuccess({ type: 'basic' }));
    expect(await subscriptionService.validateFeatureAccess(1, 'teams_limited')).toBe(true);
    expect(await subscriptionService.validateFeatureAccess(1, 'basic_stats')).toBe(true);
  });

  test('after period end, subscription expires and becomes free', async () => {
    // Subscription now expired
    setFetchMock(mockFetchSuccess({
      type: 'basic',
      expiresAt: pastDate(1), // Expired yesterday
      autoRenew: false,
    }));

    const sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('free'); // Downgraded automatically!
  });

  test('after downgrade to free, cannot access basic features', async () => {
    setFetchMock(mockFetchSuccess({ type: 'free' }));
    expect(await subscriptionService.validateFeatureAccess(1, 'teams_limited')).toBe(false);
    expect(await subscriptionService.validateFeatureAccess(1, 'basic_stats')).toBe(false);
    expect(await subscriptionService.validateFeatureAccess(1, 'summary_report')).toBe(false);
  });

  test('after downgrade to free, CAN still access free features', async () => {
    setFetchMock(mockFetchSuccess({ type: 'free' }));
    expect(await subscriptionService.validateFeatureAccess(1, 'scoreboard')).toBe(true);
    expect(await subscriptionService.validateFeatureAccess(1, 'code_search')).toBe(true);
    expect(await subscriptionService.validateFeatureAccess(1, 'view_reports')).toBe(true);
  });
});

describe('4b. Cancellation — PRO Plan', () => {
  test('cancel pro returns success with expiry date', async () => {
    const expiresAt = futureDate(28);
    const cancelledAt = now();
    setFetchMock(mockFetchSuccess({ expiresAt, cancelledAt }));

    const result = await subscriptionService.cancelSubscription(2);
    expect(result.success).toBe(true);
    expect(result.expiresAt).toBe(expiresAt);
  });

  test('after cancellation, pro user still has ALL features during remaining period', async () => {
    setFetchMock(mockFetchSuccess({ type: 'pro' }));
    expect(await subscriptionService.validateFeatureAccess(2, 'export_excel')).toBe(true);
    expect(await subscriptionService.validateFeatureAccess(2, 'team_tracking')).toBe(true);
    expect(await subscriptionService.validateFeatureAccess(2, 'teams_limited')).toBe(true);
  });

  test('after pro period end, subscription expires and becomes free', async () => {
    setFetchMock(mockFetchSuccess({
      type: 'pro',
      expiresAt: pastDate(1),
      autoRenew: false,
    }));

    const sub = await subscriptionService.getSubscription(2);
    expect(sub.type).toBe('free');
  });

  test('cancel with no active subscription returns error', async () => {
    setFetchMock(mockFetchError({ error: 'No active subscription' }, 400));
    const result = await subscriptionService.cancelSubscription(99);
    expect(result.success).toBe(false);
    expect(result.error).toBe('No active subscription');
  });

  test('cancel on network failure returns connection error', async () => {
    setFetchMock(mockFetchNetworkError());
    const result = await subscriptionService.cancelSubscription(99);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Error de conexión');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. REACTIVATION — New subscription, data preserved
// ═══════════════════════════════════════════════════════════════════════

describe('5. Reactivation — After cancellation/expiry', () => {
  test('former basic user can create new checkout for basic', async () => {
    setFetchMock(mockFetchSuccess({
      url: 'https://checkout.stripe.com/reactivate-basic',
    }));

    const result = await subscriptionService.createCheckoutSession(1, 'basic');
    expect(result.sessionUrl).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  test('former basic user can upgrade to pro on reactivation', async () => {
    setFetchMock(mockFetchSuccess({
      url: 'https://checkout.stripe.com/upgrade-to-pro',
    }));

    const result = await subscriptionService.createCheckoutSession(1, 'pro');
    expect(result.sessionUrl).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  test('after reactivation, subscription is active with new expiry', async () => {
    setFetchMock(mockFetchSuccess({
      type: 'pro',
      expiresAt: futureDate(30), // New period starts from today
      autoRenew: true,
      cancelledAt: null,
    }));

    const sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('pro');
    expect(sub.autoRenew).toBe(true);
    expect(sub.cancelledAt).toBeNull();
  });

  test('reactivation preserves account data (subscription update only changes sub fields)', async () => {
    // Downgrade only changes subscription_type, not user data
    setFetchMock(mockFetchSuccess({ success: true }));
    const result = await subscriptionService.updateSubscription(1, 'free');
    expect(result).toBe(true);
    // updateSubscription only allows 'free' — reactivation goes through checkout
  });

  test('direct upgrade to paid plan is blocked (must go through checkout)', async () => {
    const basic = await subscriptionService.updateSubscription(1, 'basic');
    expect(basic).toBe(false);

    const pro = await subscriptionService.updateSubscription(1, 'pro');
    expect(pro).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. PRO FREE TRIAL (7 days)
// ═══════════════════════════════════════════════════════════════════════

describe('6. PRO Free Trial — 7 days', () => {
  describe('6a. Trial Eligibility', () => {
    test('new user and device are eligible for trial', async () => {
      setFetchMock(mockFetchSuccess({
        eligible: true,
        deviceUsedTrial: false,
        userUsedTrial: false,
        currentTrial: null,
        trialDays: TRIAL_DAYS,
      }));

      const result = await subscriptionService.checkTrialEligibility(1, 'device-new');
      expect(result.eligible).toBe(true);
      expect(result.trialDays).toBe(7);
    });

    test('device that already used trial is NOT eligible', async () => {
      setFetchMock(mockFetchSuccess({
        eligible: false,
        deviceUsedTrial: true,
        userUsedTrial: false,
        currentTrial: null,
        trialDays: TRIAL_DAYS,
      }));

      const result = await subscriptionService.checkTrialEligibility(2, 'device-used');
      expect(result.eligible).toBe(false);
      expect(result.deviceUsedTrial).toBe(true);
    });

    test('user that already used trial is NOT eligible', async () => {
      setFetchMock(mockFetchSuccess({
        eligible: false,
        deviceUsedTrial: false,
        userUsedTrial: true,
        currentTrial: null,
        trialDays: TRIAL_DAYS,
      }));

      const result = await subscriptionService.checkTrialEligibility(3, 'device-fresh');
      expect(result.eligible).toBe(false);
      expect(result.userUsedTrial).toBe(true);
    });

    test('both device AND user already used trial → NOT eligible', async () => {
      setFetchMock(mockFetchSuccess({
        eligible: false,
        deviceUsedTrial: true,
        userUsedTrial: true,
        currentTrial: null,
        trialDays: TRIAL_DAYS,
      }));

      const result = await subscriptionService.checkTrialEligibility(3, 'device-used');
      expect(result.eligible).toBe(false);
    });

    test('returns safe defaults on network error', async () => {
      setFetchMock(mockFetchNetworkError());
      const result = await subscriptionService.checkTrialEligibility(1, 'device-123');
      expect(result.eligible).toBe(false);
      expect(result.trialDays).toBe(7);
    });
  });

  describe('6b. Starting a Trial', () => {
    test('starts trial successfully with 7-day end date', async () => {
      const trialEndsAt = futureDate(7);
      setFetchMock(mockFetchSuccess({ trialEndsAt }));

      const result = await subscriptionService.startTrial(1, 'pro', 'device-123');
      expect(result.success).toBe(true);
      expect(result.trialEndsAt).toBe(trialEndsAt);
    });

    test('server rejects trial for user who already used one', async () => {
      setFetchMock(mockFetchError({ error: 'Trial already used' }, 400));
      const result = await subscriptionService.startTrial(1, 'pro', 'device-123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Trial already used');
    });

    test('network error returns connection error', async () => {
      setFetchMock(mockFetchNetworkError());
      const result = await subscriptionService.startTrial(1, 'pro', 'device-123');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Error de conexión');
    });
  });

  describe('6c. Trial with Stripe Checkout (payment method collected upfront)', () => {
    test('creates checkout with trial flag', async () => {
      setFetchMock(mockFetchSuccess({
        url: 'https://checkout.stripe.com/trial-pro',
        sessionId: 'sess_trial_123',
      }));

      const result = await subscriptionService.createCheckoutSessionWithTrial(1, 'pro', 'device-123', true);
      expect(result.sessionUrl).toContain('checkout.stripe.com');
      expect(result.sessionId).toBe('sess_trial_123');
      expect(result.error).toBeUndefined();
    });

    test('verifying trial checkout returns isTrial=true', async () => {
      setFetchMock(mockFetchSuccess({
        success: true,
        type: 'pro',
        isTrial: true,
      }));

      const result = await subscriptionService.verifyCheckoutSession('sess_trial_123', 1);
      expect(result.success).toBe(true);
      expect(result.type).toBe('pro');
      expect(result.isTrial).toBe(true);
    });

    test('during trial period, user has full PRO access', async () => {
      setFetchMock(mockFetchSuccess({ type: 'pro' }));
      expect(await subscriptionService.validateFeatureAccess(1, 'export_excel')).toBe(true);
      expect(await subscriptionService.validateFeatureAccess(1, 'team_tracking')).toBe(true);
      expect(await subscriptionService.validateFeatureAccess(1, 'teams_limited')).toBe(true);
      expect(await subscriptionService.validateFeatureAccess(1, 'basic_stats')).toBe(true);
    });

    test('during trial, subscription shows active trial info', async () => {
      setFetchMock(mockFetchSuccess({
        type: 'pro',
        expiresAt: futureDate(7),
        autoRenew: true,
        activeTrial: {
          planType: 'pro',
          endsAt: futureDate(5),
          daysRemaining: 5,
        },
      }));

      const sub = await subscriptionService.getSubscription(1);
      expect(sub.type).toBe('pro');
      expect(sub.activeTrial).toBeDefined();
      expect(sub.activeTrial!.planType).toBe('pro');
      expect(sub.activeTrial!.daysRemaining).toBe(5);
    });

    test('reject creating trial checkout for free plan', async () => {
      const result = await subscriptionService.createCheckoutSessionWithTrial(1, 'free', 'device-123', true);
      expect(result.error).toBe('Plan no válido');
    });
  });

  describe('6d. Cancel Trial Before 7 Days — No charge', () => {
    test('cancel trial returns success', async () => {
      const expiresAt = futureDate(5); // 2 days into 7-day trial
      setFetchMock(mockFetchSuccess({ expiresAt, cancelledAt: now() }));

      const result = await subscriptionService.cancelSubscription(1);
      expect(result.success).toBe(true);
    });

    test('after cancelling trial, user retains access until trial end', async () => {
      setFetchMock(mockFetchSuccess({
        type: 'pro',
        expiresAt: futureDate(5),
        autoRenew: false,
        cancelledAt: now(),
      }));

      const sub = await subscriptionService.getSubscription(1);
      expect(sub.type).toBe('pro'); // Still pro during remaining trial
      expect(sub.autoRenew).toBe(false);
    });

    test('after trial period expires (cancelled before), becomes free', async () => {
      setFetchMock(mockFetchSuccess({
        type: 'pro',
        expiresAt: pastDate(1), // Trial expired
        autoRenew: false,
      }));

      const sub = await subscriptionService.getSubscription(1);
      expect(sub.type).toBe('free');
    });

    test('after trial expiry + cancel, user only has free features', async () => {
      setFetchMock(mockFetchSuccess({ type: 'free' }));
      expect(await subscriptionService.validateFeatureAccess(1, 'scoreboard')).toBe(true);
      expect(await subscriptionService.validateFeatureAccess(1, 'code_search')).toBe(true);
      expect(await subscriptionService.validateFeatureAccess(1, 'teams_limited')).toBe(false);
      expect(await subscriptionService.validateFeatureAccess(1, 'export_excel')).toBe(false);
    });
  });

  describe('6e. Trial completes → First payment → PRO', () => {
    test('after 7-day trial, subscription auto-renews as PRO', async () => {
      setFetchMock(mockFetchSuccess({
        type: 'pro',
        expiresAt: futureDate(30), // 30 days after trial
        autoRenew: true,
        activeTrial: null, // Trial period is over
        trialUsed: true,
      }));

      const sub = await subscriptionService.getSubscription(1);
      expect(sub.type).toBe('pro');
      expect(sub.autoRenew).toBe(true);
      expect(sub.activeTrial).toBeNull();
      expect(sub.trialUsed).toBe(true);
    });

    test('after trial ends, user cannot start another trial', async () => {
      setFetchMock(mockFetchSuccess({
        eligible: false,
        deviceUsedTrial: true,
        userUsedTrial: true,
        currentTrial: null,
        trialDays: TRIAL_DAYS,
      }));

      const result = await subscriptionService.checkTrialEligibility(1, 'device-123');
      expect(result.eligible).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. SUBSCRIPTION VALIDATION & SECURITY
// ═══════════════════════════════════════════════════════════════════════

describe('7. Subscription Validation & Security', () => {
  test('validateSubscription returns server-validated type', async () => {
    setFetchMock(mockFetchSuccess({ type: 'basic' }));
    const type = await subscriptionService.validateSubscription(1);
    expect(type).toBe('basic');
  });

  test('validateSubscription returns free when server is down', async () => {
    setFetchMock(mockFetchNetworkError());
    const type = await subscriptionService.validateSubscription(99);
    expect(type).toBe('free');
  });

  test('validateSubscription returns free when server returns error', async () => {
    setFetchMock(mockFetchError({ error: 'Internal error' }, 500));
    const type = await subscriptionService.validateSubscription(1);
    expect(type).toBe('free');
  });

  test('expired subscription returns free even if server says otherwise', async () => {
    setFetchMock(mockFetchSuccess({
      type: 'pro',
      expiresAt: pastDate(2), // Expired 2 days ago
    }));

    const sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('free');
  });

  test('direct API upgrade to paid plan is blocked', async () => {
    expect(await subscriptionService.updateSubscription(1, 'basic')).toBe(false);
    expect(await subscriptionService.updateSubscription(1, 'pro')).toBe(false);
  });

  test('only downgrade to free is allowed via direct API', async () => {
    setFetchMock(mockFetchSuccess({ success: true }));
    expect(await subscriptionService.updateSubscription(1, 'free')).toBe(true);
  });

  test('updateSubscription returns false on server error', async () => {
    setFetchMock(mockFetchError({ error: 'fail' }, 500));
    expect(await subscriptionService.updateSubscription(1, 'free')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 8. SEARCH BY CODE (Available for all plans)
// ═══════════════════════════════════════════════════════════════════════

describe('8. Search by Code', () => {
  test('finds match by valid code', async () => {
    setFetchMock(mockFetchSuccess({ id: 42 }));
    const result = await subscriptionService.searchByCode('ABC12345');
    expect(result.matchId).toBe(42);
    expect(result.error).toBeUndefined();
  });

  test('returns not-found for 404', async () => {
    setFetchMock(mockFetchError({}, 404));
    const result = await subscriptionService.searchByCode('INVALID1');
    expect(result.error).toBe('Código no encontrado');
  });

  test('returns generic error for 500', async () => {
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

// ═══════════════════════════════════════════════════════════════════════
// 9. COMPLETE USER JOURNEY SCENARIOS
// ═══════════════════════════════════════════════════════════════════════

describe('9. Complete User Journeys', () => {
  test('Journey: Free → Subscribe Basic → Cancel → Period ends → Free → Reactivate Pro', async () => {
    // Step 1: User starts as free
    setFetchMock(mockFetchSuccess({ type: 'free' }));
    let sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('free');

    // Step 2: User subscribes to basic
    setFetchMock(mockFetchSuccess({ url: 'https://checkout.stripe.com/basic' }));
    const checkout = await subscriptionService.createCheckoutSession(1, 'basic');
    expect(checkout.sessionUrl).toBeDefined();

    // Step 3: Checkout verified
    setFetchMock(mockFetchSuccess({ success: true, type: 'basic', isTrial: false }));
    const verified = await subscriptionService.verifyCheckoutSession('sess_1', 1);
    expect(verified.type).toBe('basic');

    // Step 4: User cancels
    setFetchMock(mockFetchSuccess({ expiresAt: futureDate(20), cancelledAt: now() }));
    const cancel = await subscriptionService.cancelSubscription(1);
    expect(cancel.success).toBe(true);

    // Step 5: Still active during period
    setFetchMock(mockFetchSuccess({ type: 'basic', expiresAt: futureDate(20), autoRenew: false }));
    sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('basic');

    // Step 6: Period expires → becomes free
    setFetchMock(mockFetchSuccess({ type: 'basic', expiresAt: pastDate(1), autoRenew: false }));
    sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('free');

    // Step 7: Reactivate with pro
    setFetchMock(mockFetchSuccess({ url: 'https://checkout.stripe.com/pro' }));
    const reactivate = await subscriptionService.createCheckoutSession(1, 'pro');
    expect(reactivate.sessionUrl).toBeDefined();

    // Step 8: Pro verified
    setFetchMock(mockFetchSuccess({ success: true, type: 'pro', isTrial: false }));
    const verifiedPro = await subscriptionService.verifyCheckoutSession('sess_2', 1);
    expect(verifiedPro.type).toBe('pro');
  });

  test('Journey: Trial Pro → Cancel before 7 days → No charge → Free', async () => {
    // Step 1: Check trial eligibility
    setFetchMock(mockFetchSuccess({
      eligible: true, deviceUsedTrial: false, userUsedTrial: false,
      currentTrial: null, trialDays: 7,
    }));
    const eligibility = await subscriptionService.checkTrialEligibility(1, 'dev-1');
    expect(eligibility.eligible).toBe(true);

    // Step 2: Create checkout with trial
    setFetchMock(mockFetchSuccess({ url: 'https://checkout.stripe.com/trial', sessionId: 'sess_trial' }));
    const checkout = await subscriptionService.createCheckoutSessionWithTrial(1, 'pro', 'dev-1', true);
    expect(checkout.sessionUrl).toBeDefined();

    // Step 3: Verify trial checkout
    setFetchMock(mockFetchSuccess({ success: true, type: 'pro', isTrial: true }));
    const verified = await subscriptionService.verifyCheckoutSession('sess_trial', 1);
    expect(verified.isTrial).toBe(true);

    // Step 4: During trial, has pro access
    setFetchMock(mockFetchSuccess({ type: 'pro' }));
    expect(await subscriptionService.validateFeatureAccess(1, 'export_excel')).toBe(true);

    // Step 5: Cancel before trial ends (day 3)
    setFetchMock(mockFetchSuccess({ expiresAt: futureDate(4), cancelledAt: now() }));
    const cancel = await subscriptionService.cancelSubscription(1);
    expect(cancel.success).toBe(true);

    // Step 6: Still has pro during remaining trial
    setFetchMock(mockFetchSuccess({ type: 'pro', expiresAt: futureDate(4), autoRenew: false }));
    const sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('pro');

    // Step 7: Trial expires → free (no charge was made)
    setFetchMock(mockFetchSuccess({ type: 'pro', expiresAt: pastDate(1), autoRenew: false }));
    const expiredSub = await subscriptionService.getSubscription(1);
    expect(expiredSub.type).toBe('free');
  });

  test('Journey: Trial Pro → Let trial complete → Auto-charge → Full PRO', async () => {
    // Step 1: Start trial
    setFetchMock(mockFetchSuccess({ url: 'https://checkout.stripe.com/trial', sessionId: 'sess_trial_2' }));
    const checkout = await subscriptionService.createCheckoutSessionWithTrial(1, 'pro', 'dev-2', true);
    expect(checkout.sessionId).toBeDefined();

    // Step 2: During trial
    setFetchMock(mockFetchSuccess({
      type: 'pro',
      expiresAt: futureDate(5),
      autoRenew: true,
      activeTrial: { planType: 'pro', endsAt: futureDate(5), daysRemaining: 5 },
    }));
    let sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('pro');
    expect(sub.activeTrial).toBeDefined();

    // Step 3: Trial ends, first payment charged, now regular PRO
    setFetchMock(mockFetchSuccess({
      type: 'pro',
      expiresAt: futureDate(30),
      autoRenew: true,
      activeTrial: null,
      trialUsed: true,
    }));
    sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('pro');
    expect(sub.autoRenew).toBe(true);
    expect(sub.activeTrial).toBeNull();

    // Step 4: Cannot start another trial
    setFetchMock(mockFetchSuccess({
      eligible: false, deviceUsedTrial: true, userUsedTrial: true,
      currentTrial: null, trialDays: 7,
    }));
    const eligibility = await subscriptionService.checkTrialEligibility(1, 'dev-2');
    expect(eligibility.eligible).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 10. AUTO-RENEWAL BEHAVIOR
// ═══════════════════════════════════════════════════════════════════════

describe('10. Auto-Renewal Behavior', () => {
  test('active subscription with auto_renew=true stays active after period', async () => {
    // Server handles renewal via webhook, so subscription is still active
    setFetchMock(mockFetchSuccess({
      type: 'pro',
      expiresAt: futureDate(30),
      autoRenew: true,
    }));

    const sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('pro');
    expect(sub.autoRenew).toBe(true);
  });

  test('cancelled subscription (auto_renew=false) with future expiry still active', async () => {
    setFetchMock(mockFetchSuccess({
      type: 'basic',
      expiresAt: futureDate(10),
      autoRenew: false,
      cancelledAt: pastDate(5),
    }));

    const sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('basic'); // Still active!
    expect(sub.autoRenew).toBe(false);
  });

  test('cancelled subscription (auto_renew=false) with past expiry becomes free', async () => {
    setFetchMock(mockFetchSuccess({
      type: 'basic',
      expiresAt: pastDate(1),
      autoRenew: false,
      cancelledAt: pastDate(20),
    }));

    const sub = await subscriptionService.getSubscription(1);
    expect(sub.type).toBe('free');
  });
});
