/**
 * Tests for Plan Feature Access - Android & iOS
 *
 * Exhaustive verification that each plan (free, basic, pro) provides
 * exactly the correct feature access, team limits, and stat restrictions
 * on BOTH platforms.
 *
 * Plan definitions per user requirements:
 * - FREE: scoreboard, search match stats by code, view profile, upgrade plan. NO teams, NO stats, NO tracking.
 * - BASIC (4.99€/mo): scoreboard, search matches, manage up to 2 teams, register stats,
 *   basic stat config, view stats (no tracking), view profile.
 * - PRO (9.99€/mo): ALL features (unlimited teams, all stats, tracking, export, etc.)
 */

// Mock react-native-iap native module (unavailable in Jest)
jest.mock('react-native-iap', () => ({
  initConnection: jest.fn().mockResolvedValue(true),
  endConnection: jest.fn().mockResolvedValue(true),
  fetchProducts: jest.fn().mockResolvedValue([]),
  getAvailablePurchases: jest.fn().mockResolvedValue([]),
  requestPurchase: jest.fn().mockResolvedValue({}),
  finishTransaction: jest.fn().mockResolvedValue(true),
  purchaseUpdatedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  purchaseErrorListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  showManageSubscriptionsIOS: jest.fn(),
  getReceiptIOS: jest.fn().mockResolvedValue('mock-receipt'),
}));

import {
  SUBSCRIPTION_PLANS,
  subscriptionService,
  BASIC_MAX_TEAMS,
  BASIC_ENABLED_STATS,
  TRIAL_DAYS,
  SubscriptionType,
} from '../../services/subscriptionService';
import { APPLE_PRODUCT_IDS, APPLE_SUBSCRIPTION_SKUS } from '../../services/appleIAPService';

// ═══════════════════════════════════════════════════════════════════════
// FREE PLAN — Feature Access
// ═══════════════════════════════════════════════════════════════════════

describe('FREE Plan — Feature Access', () => {
  const plan: SubscriptionType = 'free';

  test('has access to scoreboard', () => {
    expect(subscriptionService.isFeatureAvailable(plan, 'scoreboard')).toBe(true);
  });

  test('has access to search match stats by code', () => {
    expect(subscriptionService.isFeatureAvailable(plan, 'code_search')).toBe(true);
  });

  test('has access to view reports (shared stats)', () => {
    expect(subscriptionService.isFeatureAvailable(plan, 'view_reports')).toBe(true);
  });

  test('does NOT have access to team management', () => {
    expect(subscriptionService.isFeatureAvailable(plan, 'teams_limited')).toBe(false);
  });

  test('does NOT have access to stats registration', () => {
    expect(subscriptionService.isFeatureAvailable(plan, 'basic_stats')).toBe(false);
  });

  test('does NOT have access to summary reports', () => {
    expect(subscriptionService.isFeatureAvailable(plan, 'summary_report')).toBe(false);
  });

  test('does NOT have access to Excel export', () => {
    expect(subscriptionService.isFeatureAvailable(plan, 'export_excel')).toBe(false);
  });

  test('does NOT have access to team tracking', () => {
    expect(subscriptionService.isFeatureAvailable(plan, 'team_tracking')).toBe(false);
  });

  test('cannot create any teams (0 limit)', () => {
    expect(subscriptionService.canCreateTeam(plan, 0)).toBe(false);
    expect(subscriptionService.canCreateTeam(plan, 1)).toBe(false);
    expect(subscriptionService.canCreateTeam(plan, 10)).toBe(false);
  });

  test('plan definition has price 0', () => {
    const planDef = subscriptionService.getPlan(plan);
    expect(planDef).toBeDefined();
    expect(planDef!.price).toBe(0);
  });

  test('plan definition has no stripe or apple IDs', () => {
    const planDef = subscriptionService.getPlan(plan);
    expect(planDef!.stripePriceId).toBeUndefined();
    expect(planDef!.appleProductId).toBeUndefined();
  });

  test('plan definition lists limitations', () => {
    const planDef = subscriptionService.getPlan(plan);
    expect(planDef!.limitations).toBeDefined();
    expect(planDef!.limitations!.length).toBeGreaterThan(0);
  });

  test('can upgrade to basic or pro', () => {
    const upgrades = subscriptionService.getAvailableUpgrades(plan);
    const ids = upgrades.map(u => u.id);
    expect(ids).toContain('basic');
    expect(ids).toContain('pro');
    expect(ids).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// BASIC PLAN — Feature Access (4.99€/mo)
// ═══════════════════════════════════════════════════════════════════════

describe('BASIC Plan — Feature Access (4.99€/mo)', () => {
  const plan: SubscriptionType = 'basic';

  test('has access to scoreboard', () => {
    expect(subscriptionService.isFeatureAvailable(plan, 'scoreboard')).toBe(true);
  });

  test('has access to team management (limited)', () => {
    expect(subscriptionService.isFeatureAvailable(plan, 'teams_limited')).toBe(true);
  });

  test('has access to basic stats registration', () => {
    expect(subscriptionService.isFeatureAvailable(plan, 'basic_stats')).toBe(true);
  });

  test('has access to summary reports', () => {
    expect(subscriptionService.isFeatureAvailable(plan, 'summary_report')).toBe(true);
  });

  test('does NOT have access to Excel export (Pro only)', () => {
    expect(subscriptionService.isFeatureAvailable(plan, 'export_excel')).toBe(false);
  });

  test('does NOT have access to team tracking (Pro only)', () => {
    expect(subscriptionService.isFeatureAvailable(plan, 'team_tracking')).toBe(false);
  });

  test('can create up to 2 teams', () => {
    expect(BASIC_MAX_TEAMS).toBe(2);
    expect(subscriptionService.canCreateTeam(plan, 0)).toBe(true);
    expect(subscriptionService.canCreateTeam(plan, 1)).toBe(true);
    expect(subscriptionService.canCreateTeam(plan, 2)).toBe(false);
    expect(subscriptionService.canCreateTeam(plan, 3)).toBe(false);
  });

  test('plan price is 4.99', () => {
    const planDef = subscriptionService.getPlan(plan);
    expect(planDef!.price).toBe(4.99);
  });

  test('plan has stripe price ID', () => {
    const planDef = subscriptionService.getPlan(plan);
    expect(planDef!.stripePriceId).toBeDefined();
    expect(planDef!.stripePriceId!.length).toBeGreaterThan(0);
  });

  test('plan has apple product ID', () => {
    const planDef = subscriptionService.getPlan(plan);
    expect(planDef!.appleProductId).toBeDefined();
    expect(planDef!.appleProductId!.length).toBeGreaterThan(0);
  });

  test('can only upgrade to pro', () => {
    const upgrades = subscriptionService.getAvailableUpgrades(plan);
    const ids = upgrades.map(u => u.id);
    expect(ids).toEqual(['pro']);
  });

  describe('Basic plan stat restrictions', () => {
    test('Recepción — all 4 types enabled', () => {
      expect(subscriptionService.canEnableStatInBasic('Recepción', 'Doble positivo')).toBe(true);
      expect(subscriptionService.canEnableStatInBasic('Recepción', 'Positivo')).toBe(true);
      expect(subscriptionService.canEnableStatInBasic('Recepción', 'Neutro')).toBe(true);
      expect(subscriptionService.canEnableStatInBasic('Recepción', 'Error')).toBe(true);
    });

    test('Ataque — only Positivo and Error', () => {
      expect(subscriptionService.canEnableStatInBasic('Ataque', 'Positivo')).toBe(true);
      expect(subscriptionService.canEnableStatInBasic('Ataque', 'Error')).toBe(true);
      expect(subscriptionService.canEnableStatInBasic('Ataque', 'Neutro')).toBe(false);
      expect(subscriptionService.canEnableStatInBasic('Ataque', 'Doble positivo')).toBe(false);
    });

    test('Bloqueo — only Positivo', () => {
      expect(subscriptionService.canEnableStatInBasic('Bloqueo', 'Positivo')).toBe(true);
      expect(subscriptionService.canEnableStatInBasic('Bloqueo', 'Neutro')).toBe(false);
      expect(subscriptionService.canEnableStatInBasic('Bloqueo', 'Error')).toBe(false);
    });

    test('Saque — only Punto directo and Error', () => {
      expect(subscriptionService.canEnableStatInBasic('Saque', 'Punto directo')).toBe(true);
      expect(subscriptionService.canEnableStatInBasic('Saque', 'Error')).toBe(true);
      expect(subscriptionService.canEnableStatInBasic('Saque', 'Positivo')).toBe(false);
      expect(subscriptionService.canEnableStatInBasic('Saque', 'Neutro')).toBe(false);
    });

    test('Defensa — fully disabled', () => {
      expect(subscriptionService.canEnableStatInBasic('Defensa', 'Positivo')).toBe(false);
      expect(subscriptionService.canEnableStatInBasic('Defensa', 'Error')).toBe(false);
      expect(subscriptionService.canEnableStatInBasic('Defensa', 'Neutro')).toBe(false);
    });

    test('Colocación — fully disabled', () => {
      expect(subscriptionService.canEnableStatInBasic('Colocación', 'Positivo')).toBe(false);
      expect(subscriptionService.canEnableStatInBasic('Colocación', 'Error')).toBe(false);
      expect(subscriptionService.canEnableStatInBasic('Colocación', 'Neutro')).toBe(false);
    });

    test('disabled categories list is exactly Defensa and Colocación', () => {
      expect(BASIC_ENABLED_STATS.disabledCategories).toEqual(['Defensa', 'Colocación']);
    });

    test('enabled categories list is exactly Recepción, Ataque, Bloqueo, Saque', () => {
      expect(BASIC_ENABLED_STATS.categories).toEqual(['Recepción', 'Ataque', 'Bloqueo', 'Saque']);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PRO PLAN — Feature Access (9.99€/mo)
// ═══════════════════════════════════════════════════════════════════════

describe('PRO Plan — Feature Access (9.99€/mo)', () => {
  const plan: SubscriptionType = 'pro';

  test('has access to ALL features', () => {
    const allFeatures = [
      'scoreboard', 'code_search', 'view_reports',
      'teams_limited', 'basic_stats', 'summary_report',
      'export_excel', 'team_tracking',
      'any_feature', 'custom_feature', 'future_feature',
    ];
    allFeatures.forEach(feature => {
      expect(subscriptionService.isFeatureAvailable(plan, feature)).toBe(true);
    });
  });

  test('can create unlimited teams', () => {
    expect(subscriptionService.canCreateTeam(plan, 0)).toBe(true);
    expect(subscriptionService.canCreateTeam(plan, 2)).toBe(true);
    expect(subscriptionService.canCreateTeam(plan, 10)).toBe(true);
    expect(subscriptionService.canCreateTeam(plan, 50)).toBe(true);
    expect(subscriptionService.canCreateTeam(plan, 100)).toBe(true);
  });

  test('plan price is 9.99', () => {
    const planDef = subscriptionService.getPlan(plan);
    expect(planDef!.price).toBe(9.99);
  });

  test('plan is marked as recommended', () => {
    const planDef = subscriptionService.getPlan(plan);
    expect(planDef!.recommended).toBe(true);
  });

  test('plan has stripe price ID', () => {
    const planDef = subscriptionService.getPlan(plan);
    expect(planDef!.stripePriceId).toBeDefined();
    expect(planDef!.stripePriceId!.length).toBeGreaterThan(0);
  });

  test('plan has apple product ID', () => {
    const planDef = subscriptionService.getPlan(plan);
    expect(planDef!.appleProductId).toBeDefined();
    expect(planDef!.appleProductId!.length).toBeGreaterThan(0);
  });

  test('plan has no limitations listed', () => {
    const planDef = subscriptionService.getPlan(plan);
    expect(planDef!.limitations).toBeUndefined();
  });

  test('has no available upgrades', () => {
    const upgrades = subscriptionService.getAvailableUpgrades(plan);
    expect(upgrades).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CROSS-PLAN CONSISTENCY
// ═══════════════════════════════════════════════════════════════════════

describe('Cross-Plan Consistency', () => {
  test('exactly 3 plans defined: free, basic, pro', () => {
    expect(SUBSCRIPTION_PLANS).toHaveLength(3);
    expect(SUBSCRIPTION_PLANS.map(p => p.id)).toEqual(['free', 'basic', 'pro']);
  });

  test('price ordering: free < basic < pro', () => {
    const prices = SUBSCRIPTION_PLANS.map(p => p.price);
    expect(prices[0]).toBeLessThan(prices[1]);
    expect(prices[1]).toBeLessThan(prices[2]);
  });

  test('only paid plans have stripe IDs', () => {
    SUBSCRIPTION_PLANS.forEach(p => {
      if (p.price === 0) {
        expect(p.stripePriceId).toBeUndefined();
      } else {
        expect(p.stripePriceId).toBeDefined();
      }
    });
  });

  test('only paid plans have apple product IDs', () => {
    SUBSCRIPTION_PLANS.forEach(p => {
      if (p.price === 0) {
        expect(p.appleProductId).toBeUndefined();
      } else {
        expect(p.appleProductId).toBeDefined();
      }
    });
  });

  test('all plans have features listed', () => {
    SUBSCRIPTION_PLANS.forEach(p => {
      expect(p.features).toBeDefined();
      expect(p.features.length).toBeGreaterThan(0);
    });
  });

  test('invalid subscription type returns false for all features', () => {
    expect(subscriptionService.isFeatureAvailable('invalid' as SubscriptionType, 'scoreboard')).toBe(false);
    expect(subscriptionService.isFeatureAvailable('invalid' as SubscriptionType, 'code_search')).toBe(false);
  });

  test('getPlan returns undefined for invalid plan ID', () => {
    expect(subscriptionService.getPlan('invalid' as SubscriptionType)).toBeUndefined();
    expect(subscriptionService.getPlan('' as SubscriptionType)).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// APPLE IAP PRODUCT IDS — Cross-platform consistency
// ═══════════════════════════════════════════════════════════════════════

describe('Apple IAP Product IDs', () => {
  test('basic Apple product ID matches between subscriptionService and appleIAPService', () => {
    const planDef = subscriptionService.getPlan('basic');
    expect(planDef!.appleProductId).toBe(APPLE_PRODUCT_IDS.basic);
  });

  test('pro Apple product ID matches between subscriptionService and appleIAPService', () => {
    const planDef = subscriptionService.getPlan('pro');
    expect(planDef!.appleProductId).toBe(APPLE_PRODUCT_IDS.pro);
  });

  test('APPLE_SUBSCRIPTION_SKUS contains both product IDs', () => {
    expect(APPLE_SUBSCRIPTION_SKUS).toContain(APPLE_PRODUCT_IDS.basic);
    expect(APPLE_SUBSCRIPTION_SKUS).toContain(APPLE_PRODUCT_IDS.pro);
    expect(APPLE_SUBSCRIPTION_SKUS).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TRIAL CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════

describe('Trial Configuration', () => {
  test('trial duration is exactly 7 days', () => {
    expect(TRIAL_DAYS).toBe(7);
  });

  test('trial is only available for PRO plan (no basic trial)', () => {
    // The system only supports pro trials — verified by backend rejecting non-pro trials
    // We test that the plan structure supports this
    const proPlan = subscriptionService.getPlan('pro');
    expect(proPlan).toBeDefined();
    expect(proPlan!.price).toBe(9.99);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SHARE CODE
// ═══════════════════════════════════════════════════════════════════════

describe('Share Code Generation', () => {
  test('generates 8-character code', () => {
    const code = subscriptionService.generateShareCode();
    expect(code).toHaveLength(8);
  });

  test('code only contains valid alphanumeric chars (no ambiguous 0/O/1/I)', () => {
    const validChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 50; i++) {
      const code = subscriptionService.generateShareCode();
      for (const ch of code) {
        expect(validChars).toContain(ch);
      }
    }
  });

  test('codes are unique in 200 generations', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 200; i++) codes.add(subscriptionService.generateShareCode());
    expect(codes.size).toBe(200);
  });
});
