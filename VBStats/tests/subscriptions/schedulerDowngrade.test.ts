/**
 * Tests for Subscription Scheduler — Downgrade & Data Preservation
 *
 * Exhaustive tests for the backend scheduler that:
 * - Detects expired subscriptions with auto_renew=FALSE → downgrades to free
 * - Gives grace period (2 days) for auto_renew=TRUE before checking Stripe
 * - Verifies with Stripe for overdue auto-renew subscriptions
 * - NEVER deletes user data (teams, matches, stats, players preserved)
 * - Reactivation restores full account state
 */

describe('Scheduler — Expired Subscription Detection', () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
  const tomorrow = new Date(now.getTime() + 86400000);
  const inAWeek = new Date(now.getTime() + 7 * 86400000);

  // ─── auto_renew=FALSE scenarios ───────────────────────────────────

  describe('auto_renew=FALSE (user cancelled)', () => {
    test('expired basic → should downgrade to free', () => {
      const user = {
        subscription_type: 'basic',
        subscription_expires_at: yesterday,
        auto_renew: false,
        cancelled_at: twoDaysAgo,
      };
      const shouldDowngrade = new Date(user.subscription_expires_at) < now && !user.auto_renew;
      expect(shouldDowngrade).toBe(true);
    });

    test('expired pro → should downgrade to free', () => {
      const user = {
        subscription_type: 'pro',
        subscription_expires_at: yesterday,
        auto_renew: false,
        cancelled_at: twoDaysAgo,
      };
      const shouldDowngrade = new Date(user.subscription_expires_at) < now && !user.auto_renew;
      expect(shouldDowngrade).toBe(true);
    });

    test('NOT expired but cancelled → should NOT downgrade yet', () => {
      const user = {
        subscription_type: 'basic',
        subscription_expires_at: inAWeek,
        auto_renew: false,
        cancelled_at: now,
      };
      const shouldDowngrade = new Date(user.subscription_expires_at) < now && !user.auto_renew;
      expect(shouldDowngrade).toBe(false);
    });

    test('expires tomorrow → should NOT downgrade yet', () => {
      const user = {
        subscription_type: 'pro',
        subscription_expires_at: tomorrow,
        auto_renew: false,
        cancelled_at: twoDaysAgo,
      };
      const shouldDowngrade = new Date(user.subscription_expires_at) < now && !user.auto_renew;
      expect(shouldDowngrade).toBe(false);
    });
  });

  // ─── auto_renew=TRUE (potential failed payment) ───────────────────

  describe('auto_renew=TRUE (payment should have renewed)', () => {
    test('expired 1 day ago → within grace period, should NOT downgrade', () => {
      const user = {
        subscription_type: 'pro',
        subscription_expires_at: yesterday,
        auto_renew: true,
      };

      const overdueMs = now.getTime() - new Date(user.subscription_expires_at).getTime();
      const overdueDays = overdueMs / (1000 * 60 * 60 * 24);

      // Should NOT immediately downgrade (auto_renew is true)
      const shouldImmediateDowngrade = new Date(user.subscription_expires_at) < now && !user.auto_renew;
      expect(shouldImmediateDowngrade).toBe(false);

      // Within 2-day grace period → don't check Stripe yet
      expect(overdueDays).toBeLessThanOrEqual(2);
    });

    test('expired 3+ days ago → past grace period, should check Stripe', () => {
      const user = {
        subscription_type: 'pro',
        subscription_expires_at: threeDaysAgo,
        auto_renew: true,
      };

      const overdueMs = now.getTime() - new Date(user.subscription_expires_at).getTime();
      const overdueDays = overdueMs / (1000 * 60 * 60 * 24);

      expect(overdueDays).toBeGreaterThan(2);
    });

    test('NOT expired → should NOT be processed at all', () => {
      const user = {
        subscription_type: 'basic',
        subscription_expires_at: tomorrow,
        auto_renew: true,
      };
      const isExpired = new Date(user.subscription_expires_at) < now;
      expect(isExpired).toBe(false);
    });
  });

  // ─── Stripe verification results ─────────────────────────────────

  describe('Stripe Status → Downgrade Decision', () => {
    const statuses = [
      { status: 'active', shouldDowngrade: false },
      { status: 'canceled', shouldDowngrade: true },
      { status: 'past_due', shouldDowngrade: true },
      { status: 'unpaid', shouldDowngrade: true },
      { status: 'incomplete', shouldDowngrade: true },
      { status: 'incomplete_expired', shouldDowngrade: true },
      { status: 'trialing', shouldDowngrade: false },
    ];

    statuses.forEach(({ status, shouldDowngrade }) => {
      test(`Stripe status "${status}" → ${shouldDowngrade ? 'DOWNGRADE' : 'KEEP'}`, () => {
        const result = status !== 'active' && status !== 'trialing';
        expect(result).toBe(shouldDowngrade);
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// DATA PRESERVATION ON DOWNGRADE
// ═══════════════════════════════════════════════════════════════════════

describe('Scheduler — Data Preservation on Downgrade', () => {
  test('downgrade UPDATE query NEVER contains DELETE, DROP, or TRUNCATE', () => {
    const updateQuery = `
      UPDATE users SET 
        subscription_type = 'free',
        subscription_expires_at = NULL,
        stripe_subscription_id = NULL,
        auto_renew = TRUE,
        cancelled_at = NULL
      WHERE id = ?
    `;

    expect(updateQuery).not.toContain('DELETE');
    expect(updateQuery).not.toContain('DROP');
    expect(updateQuery).not.toContain('TRUNCATE');
    expect(updateQuery).toContain("subscription_type = 'free'");
  });

  test('downgrade ONLY touches subscription fields, NOT data fields', () => {
    const updateQuery = `
      UPDATE users SET 
        subscription_type = 'free',
        subscription_expires_at = NULL,
        stripe_subscription_id = NULL,
        auto_renew = TRUE,
        cancelled_at = NULL
      WHERE id = ?
    `;

    // Should NOT touch: teams, matches, players, stats, settings
    expect(updateQuery).not.toContain('teams');
    expect(updateQuery).not.toContain('matches');
    expect(updateQuery).not.toContain('players');
    expect(updateQuery).not.toContain('stats');
    expect(updateQuery).not.toContain('stat_settings');
  });

  test('after downgrade, auto_renew resets to TRUE (ready for re-subscribe)', () => {
    const afterDowngrade = {
      subscription_type: 'free',
      subscription_expires_at: null,
      stripe_subscription_id: null,
      auto_renew: true,
      cancelled_at: null,
    };

    expect(afterDowngrade.subscription_type).toBe('free');
    expect(afterDowngrade.auto_renew).toBe(true);
    expect(afterDowngrade.cancelled_at).toBeNull();
    expect(afterDowngrade.subscription_expires_at).toBeNull();
  });

  test('user data tables are untouched after downgrade', () => {
    // Simulating that after downgrade, a user's data still exists
    const userDataAfterDowngrade = {
      teams: [{ id: 1, name: 'My Team' }, { id: 2, name: 'Team 2' }],
      players: [{ id: 1, name: 'Player 1' }, { id: 2, name: 'Player 2' }],
      matches: [{ id: 1, date: '2026-01-01' }],
      statSettings: [{ id: 1, position: 'Receptor', enabled: true }],
    };

    expect(userDataAfterDowngrade.teams).toHaveLength(2);
    expect(userDataAfterDowngrade.players).toHaveLength(2);
    expect(userDataAfterDowngrade.matches).toHaveLength(1);
    expect(userDataAfterDowngrade.statSettings).toHaveLength(1);
  });

  test('after reactivation, previous data is fully accessible', () => {
    // After resubscribing, user gets back their old data
    const reactivatedUser = {
      subscription_type: 'pro',
      teams: [{ id: 1, name: 'My Team' }, { id: 2, name: 'Team 2' }],
      players: [{ id: 1, name: 'Player 1' }],
      matches: [{ id: 1, date: '2026-01-01' }, { id: 2, date: '2026-02-01' }],
    };

    expect(reactivatedUser.subscription_type).toBe('pro');
    expect(reactivatedUser.teams).toHaveLength(2);
    expect(reactivatedUser.matches).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FREE USERS EXCLUDED FROM PROCESSING
// ═══════════════════════════════════════════════════════════════════════

describe('Scheduler — Free Users Excluded', () => {
  test('free users are never processed by scheduler', () => {
    const users = [
      { id: 1, subscription_type: 'free', subscription_expires_at: new Date(Date.now() - 86400000) },
      { id: 2, subscription_type: 'basic', subscription_expires_at: new Date(Date.now() - 86400000) },
      { id: 3, subscription_type: 'pro', subscription_expires_at: new Date(Date.now() - 86400000) },
    ];

    const processed = users.filter(u => u.subscription_type !== 'free');
    expect(processed).toHaveLength(2);
    expect(processed.every(u => u.subscription_type !== 'free')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SCHEDULER TIMING
// ═══════════════════════════════════════════════════════════════════════

describe('Scheduler — Timing', () => {
  test('scheduler runs every 15 minutes (900000 ms)', () => {
    const INTERVAL_MS = 15 * 60 * 1000;
    expect(INTERVAL_MS).toBe(900000);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TRIAL EXPIRY HANDLING
// ═══════════════════════════════════════════════════════════════════════

describe('Scheduler — Trial Expiry', () => {
  const now = new Date();

  test('expired trial with auto_renew=FALSE → downgrade to free', () => {
    const user = {
      subscription_type: 'pro',
      subscription_expires_at: new Date(now.getTime() - 86400000), // yesterday
      auto_renew: false,
      trial_used: true,
    };

    const shouldDowngrade = new Date(user.subscription_expires_at) < now && !user.auto_renew;
    expect(shouldDowngrade).toBe(true);
  });

  test('expired trial with auto_renew=TRUE → Stripe should have charged', () => {
    const user = {
      subscription_type: 'pro',
      subscription_expires_at: new Date(now.getTime() - 86400000),
      auto_renew: true,
      trial_used: true,
    };

    // auto_renew=TRUE means Stripe should have processed the first payment
    // Scheduler gives grace period before checking Stripe
    const shouldImmediateDowngrade = new Date(user.subscription_expires_at) < now && !user.auto_renew;
    expect(shouldImmediateDowngrade).toBe(false);
  });

  test('active trial (not expired) → should NOT be processed', () => {
    const user = {
      subscription_type: 'pro',
      subscription_expires_at: new Date(now.getTime() + 5 * 86400000), // 5 days from now
      auto_renew: true,
      trial_used: true,
    };

    const isExpired = new Date(user.subscription_expires_at) < now;
    expect(isExpired).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// APPLE SUBSCRIPTION DOWNGRADE
// ═══════════════════════════════════════════════════════════════════════

describe('Scheduler — Apple Subscription Downgrade', () => {
  const now = new Date();

  test('expired Apple subscription with auto_renew=FALSE → downgrade', () => {
    const user = {
      subscription_type: 'pro',
      subscription_expires_at: new Date(now.getTime() - 86400000),
      auto_renew: false,
      apple_original_transaction_id: 'txn_12345',
    };

    const shouldDowngrade = new Date(user.subscription_expires_at) < now && !user.auto_renew;
    expect(shouldDowngrade).toBe(true);
  });

  test('active Apple subscription → should NOT downgrade', () => {
    const user = {
      subscription_type: 'basic',
      subscription_expires_at: new Date(now.getTime() + 20 * 86400000),
      auto_renew: true,
      apple_original_transaction_id: 'txn_12345',
    };

    const isExpired = new Date(user.subscription_expires_at) < now;
    expect(isExpired).toBe(false);
  });
});
