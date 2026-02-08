/**
 * Tests for Subscription Plans, Features, and Limits
 *
 * Verifies that each plan (free, basic, pro) has exactly the correct
 * features, limits, and restrictions.
 */

import {
  SUBSCRIPTION_PLANS,
  subscriptionService,
  BASIC_MAX_TEAMS,
  BASIC_ENABLED_STATS,
  TRIAL_DAYS,
  SubscriptionType,
} from '../../services/subscriptionService';

// ─── Plan definitions ────────────────────────────────────────────────

describe('Subscription Plans Definition', () => {
  test('there are exactly 3 plans: free, basic, pro', () => {
    expect(SUBSCRIPTION_PLANS).toHaveLength(3);
    const ids = SUBSCRIPTION_PLANS.map(p => p.id);
    expect(ids).toEqual(['free', 'basic', 'pro']);
  });

  test('free plan has price 0 and no stripe/apple IDs', () => {
    const free = SUBSCRIPTION_PLANS.find(p => p.id === 'free')!;
    expect(free.price).toBe(0);
    expect(free.stripePriceId).toBeUndefined();
    expect(free.appleProductId).toBeUndefined();
  });

  test('basic plan has correct price and payment IDs', () => {
    const basic = SUBSCRIPTION_PLANS.find(p => p.id === 'basic')!;
    expect(basic.price).toBe(4.99);
    expect(basic.stripePriceId).toBeDefined();
    expect(basic.appleProductId).toBe('com.vbstats.basico.mensual');
  });

  test('pro plan has correct price, payment IDs, and is recommended', () => {
    const pro = SUBSCRIPTION_PLANS.find(p => p.id === 'pro')!;
    expect(pro.price).toBe(9.99);
    expect(pro.stripePriceId).toBeDefined();
    expect(pro.appleProductId).toBe('com.vbstats.pro.mensual');
    expect(pro.recommended).toBe(true);
  });

  test('free plan lists limitations', () => {
    const free = SUBSCRIPTION_PLANS.find(p => p.id === 'free')!;
    expect(free.limitations).toBeDefined();
    expect(free.limitations!.length).toBeGreaterThan(0);
  });

  test('pro plan has no limitations listed', () => {
    const pro = SUBSCRIPTION_PLANS.find(p => p.id === 'pro')!;
    expect(pro.limitations).toBeUndefined();
  });
});

// ─── Feature access per plan ─────────────────────────────────────────

describe('Feature Access by Plan', () => {
  describe('free plan features', () => {
    test('has code_search', () => {
      expect(subscriptionService.isFeatureAvailable('free', 'code_search')).toBe(true);
    });
    test('has scoreboard', () => {
      expect(subscriptionService.isFeatureAvailable('free', 'scoreboard')).toBe(true);
    });
    test('has view_reports', () => {
      expect(subscriptionService.isFeatureAvailable('free', 'view_reports')).toBe(true);
    });
    test('does NOT have teams_limited', () => {
      expect(subscriptionService.isFeatureAvailable('free', 'teams_limited')).toBe(false);
    });
    test('does NOT have basic_stats', () => {
      expect(subscriptionService.isFeatureAvailable('free', 'basic_stats')).toBe(false);
    });
    test('does NOT have summary_report', () => {
      expect(subscriptionService.isFeatureAvailable('free', 'summary_report')).toBe(false);
    });
    test('does NOT have any unknown feature', () => {
      expect(subscriptionService.isFeatureAvailable('free', 'export_excel')).toBe(false);
    });
  });

  describe('basic plan features', () => {
    test('has teams_limited', () => {
      expect(subscriptionService.isFeatureAvailable('basic', 'teams_limited')).toBe(true);
    });
    test('has basic_stats', () => {
      expect(subscriptionService.isFeatureAvailable('basic', 'basic_stats')).toBe(true);
    });
    test('has scoreboard', () => {
      expect(subscriptionService.isFeatureAvailable('basic', 'scoreboard')).toBe(true);
    });
    test('has summary_report', () => {
      expect(subscriptionService.isFeatureAvailable('basic', 'summary_report')).toBe(true);
    });
    test('does NOT have export_excel', () => {
      expect(subscriptionService.isFeatureAvailable('basic', 'export_excel')).toBe(false);
    });
    test('does NOT have team_tracking', () => {
      expect(subscriptionService.isFeatureAvailable('basic', 'team_tracking')).toBe(false);
    });
  });

  describe('pro plan features', () => {
    test('has ALL arbitrarily-named features', () => {
      const features = [
        'code_search', 'scoreboard', 'view_reports',
        'teams_limited', 'basic_stats', 'summary_report',
        'export_excel', 'team_tracking', 'anything',
      ];
      features.forEach(f => {
        expect(subscriptionService.isFeatureAvailable('pro', f)).toBe(true);
      });
    });
  });

  test('invalid subscription type returns false', () => {
    expect(subscriptionService.isFeatureAvailable('invalid' as SubscriptionType, 'scoreboard')).toBe(false);
  });
});

// ─── Team creation limits ────────────────────────────────────────────

describe('Team Creation Limits', () => {
  test('BASIC_MAX_TEAMS is 2', () => {
    expect(BASIC_MAX_TEAMS).toBe(2);
  });

  test('free plan cannot create any teams', () => {
    expect(subscriptionService.canCreateTeam('free', 0)).toBe(false);
    expect(subscriptionService.canCreateTeam('free', 1)).toBe(false);
  });

  test('basic plan can create up to 2 teams', () => {
    expect(subscriptionService.canCreateTeam('basic', 0)).toBe(true);
    expect(subscriptionService.canCreateTeam('basic', 1)).toBe(true);
    expect(subscriptionService.canCreateTeam('basic', 2)).toBe(false);
    expect(subscriptionService.canCreateTeam('basic', 5)).toBe(false);
  });

  test('pro plan can create unlimited teams', () => {
    expect(subscriptionService.canCreateTeam('pro', 0)).toBe(true);
    expect(subscriptionService.canCreateTeam('pro', 10)).toBe(true);
    expect(subscriptionService.canCreateTeam('pro', 100)).toBe(true);
  });
});

// ─── Basic plan stat restrictions ────────────────────────────────────

describe('Basic Plan Stat Restrictions', () => {
  test('Defensa is fully disabled in basic', () => {
    expect(subscriptionService.canEnableStatInBasic('Defensa', 'Positivo')).toBe(false);
    expect(subscriptionService.canEnableStatInBasic('Defensa', 'Error')).toBe(false);
  });

  test('Colocación is fully disabled in basic', () => {
    expect(subscriptionService.canEnableStatInBasic('Colocación', 'Positivo')).toBe(false);
    expect(subscriptionService.canEnableStatInBasic('Colocación', 'Error')).toBe(false);
  });

  test('Recepción types are all enabled', () => {
    expect(subscriptionService.canEnableStatInBasic('Recepción', 'Doble positivo')).toBe(true);
    expect(subscriptionService.canEnableStatInBasic('Recepción', 'Positivo')).toBe(true);
    expect(subscriptionService.canEnableStatInBasic('Recepción', 'Neutro')).toBe(true);
    expect(subscriptionService.canEnableStatInBasic('Recepción', 'Error')).toBe(true);
  });

  test('Ataque only allows Positivo and Error in basic', () => {
    expect(subscriptionService.canEnableStatInBasic('Ataque', 'Positivo')).toBe(true);
    expect(subscriptionService.canEnableStatInBasic('Ataque', 'Error')).toBe(true);
    expect(subscriptionService.canEnableStatInBasic('Ataque', 'Neutro')).toBe(false);
  });

  test('Bloqueo only allows Positivo in basic', () => {
    expect(subscriptionService.canEnableStatInBasic('Bloqueo', 'Positivo')).toBe(true);
    expect(subscriptionService.canEnableStatInBasic('Bloqueo', 'Neutro')).toBe(false);
    expect(subscriptionService.canEnableStatInBasic('Bloqueo', 'Error')).toBe(false);
  });

  test('Saque only allows Punto directo and Error in basic', () => {
    expect(subscriptionService.canEnableStatInBasic('Saque', 'Punto directo')).toBe(true);
    expect(subscriptionService.canEnableStatInBasic('Saque', 'Error')).toBe(true);
    expect(subscriptionService.canEnableStatInBasic('Saque', 'Positivo')).toBe(false);
    expect(subscriptionService.canEnableStatInBasic('Saque', 'Neutro')).toBe(false);
  });

  test('disabled categories are Defensa and Colocación', () => {
    expect(BASIC_ENABLED_STATS.disabledCategories).toEqual(['Defensa', 'Colocación']);
  });
});

// ─── Available upgrades ──────────────────────────────────────────────

describe('Available Upgrades', () => {
  test('free user can upgrade to basic or pro', () => {
    const ids = subscriptionService.getAvailableUpgrades('free').map(u => u.id);
    expect(ids).toContain('basic');
    expect(ids).toContain('pro');
  });

  test('basic user can only upgrade to pro', () => {
    const ids = subscriptionService.getAvailableUpgrades('basic').map(u => u.id);
    expect(ids).toEqual(['pro']);
  });

  test('pro user has no available upgrades', () => {
    expect(subscriptionService.getAvailableUpgrades('pro')).toHaveLength(0);
  });
});

// ─── Plan lookup ─────────────────────────────────────────────────────

describe('Plan Lookup', () => {
  test('getPlan returns correct plan for valid ID', () => {
    expect(subscriptionService.getPlan('free')?.id).toBe('free');
    expect(subscriptionService.getPlan('basic')?.id).toBe('basic');
    expect(subscriptionService.getPlan('pro')?.id).toBe('pro');
  });

  test('getPlan returns undefined for invalid ID', () => {
    expect(subscriptionService.getPlan('invalid' as SubscriptionType)).toBeUndefined();
  });
});

// ─── Share code generation ───────────────────────────────────────────

describe('Share Code Generation', () => {
  test('generates 8-character code', () => {
    expect(subscriptionService.generateShareCode()).toHaveLength(8);
  });

  test('code only contains expected alphanumeric chars', () => {
    const validChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 50; i++) {
      const code = subscriptionService.generateShareCode();
      for (const ch of code) {
        expect(validChars).toContain(ch);
      }
    }
  });

  test('generates unique codes', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) codes.add(subscriptionService.generateShareCode());
    expect(codes.size).toBe(100);
  });
});

// ─── Trial config ────────────────────────────────────────────────────

describe('Trial Configuration', () => {
  test('trial duration is 7 days', () => {
    expect(TRIAL_DAYS).toBe(7);
  });
});
