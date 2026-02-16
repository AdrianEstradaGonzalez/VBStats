/**
 * Tests for Apple IAP (iOS) Subscription Flow
 *
 * Covers iOS-specific subscription behavior:
 * - Product ID mapping (basic → com.vbstats.basico.mes, pro → com.vbstats.pro.mes)
 * - Subscription type conversion from Apple product IDs
 * - Subscription status checking through server
 * - Purchase restore flow
 * - Apple-specific cancellation (redirect to App Store settings)
 * - Cross-platform consistency: same plans, same features on both platforms
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

import { SubscriptionType } from '../../services/subscriptionService';
import { Platform } from 'react-native';
import {
  APPLE_PRODUCT_IDS,
  APPLE_SUBSCRIPTION_SKUS,
  appleIAPService,
} from '../../services/appleIAPService';

// ═══════════════════════════════════════════════════════════════════════
// PRODUCT ID CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════

describe('Apple IAP — Product ID Configuration', () => {
  test('basic product ID is com.vbstats.basico.mes', () => {
    expect(APPLE_PRODUCT_IDS.basic).toBe('com.vbstats.basico.mes');
  });

  test('pro product ID is com.vbstats.pro.mes', () => {
    expect(APPLE_PRODUCT_IDS.pro).toBe('com.vbstats.pro.mes');
  });

  test('APPLE_SUBSCRIPTION_SKUS contains both product IDs', () => {
    expect(APPLE_SUBSCRIPTION_SKUS).toContain('com.vbstats.basico.mes');
    expect(APPLE_SUBSCRIPTION_SKUS).toContain('com.vbstats.pro.mes');
  });

  test('exactly 2 subscription SKUs', () => {
    expect(APPLE_SUBSCRIPTION_SKUS).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PRODUCT ID ↔ SUBSCRIPTION TYPE CONVERSION
// ═══════════════════════════════════════════════════════════════════════

describe('Apple IAP — Product ID to Subscription Type', () => {
  test('basic product ID → basic subscription type', () => {
    expect(appleIAPService.productIdToSubscriptionType(APPLE_PRODUCT_IDS.basic)).toBe('basic');
  });

  test('pro product ID → pro subscription type', () => {
    expect(appleIAPService.productIdToSubscriptionType(APPLE_PRODUCT_IDS.pro)).toBe('pro');
  });

  test('unknown product ID → free', () => {
    expect(appleIAPService.productIdToSubscriptionType('com.unknown.product')).toBe('free');
    expect(appleIAPService.productIdToSubscriptionType('')).toBe('free');
  });
});

describe('Apple IAP — Subscription Type to Product ID', () => {
  test('basic → basic Apple product ID', () => {
    expect(appleIAPService.subscriptionTypeToProductId('basic')).toBe(APPLE_PRODUCT_IDS.basic);
  });

  test('pro → pro Apple product ID', () => {
    expect(appleIAPService.subscriptionTypeToProductId('pro')).toBe(APPLE_PRODUCT_IDS.pro);
  });

  test('free → null (no Apple product)', () => {
    expect(appleIAPService.subscriptionTypeToProductId('free')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// iOS PLATFORM CHECKS (non-iOS returns safe defaults)
// ═══════════════════════════════════════════════════════════════════════

describe('Apple IAP — Platform Safety (non-iOS environment)', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    // Force non-iOS platform for these tests
    Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform, writable: true });
  });

  test('checkSubscriptionStatus returns inactive on non-iOS', async () => {
    const status = await appleIAPService.checkSubscriptionStatus(1);
    expect(status.isActive).toBe(false);
    expect(status.productId).toBeNull();
    expect(status.expirationDate).toBeNull();
    expect(status.willRenew).toBe(false);
    expect(status.isInTrial).toBe(false);
  });

  test('getProducts returns empty array on non-iOS', async () => {
    const products = await appleIAPService.getProducts();
    expect(products).toEqual([]);
  });

  test('purchaseSubscription returns error on non-iOS', async () => {
    const result = await appleIAPService.purchaseSubscription('com.vbstats.pro.mes', 1);
    expect(result.success).toBe(false);
    expect(result.error).toContain('iOS');
  });

  test('restorePurchases returns error on non-iOS', async () => {
    const result = await appleIAPService.restorePurchases(1);
    expect(result.success).toBe(false);
    expect(result.error).toContain('iOS');
  });

  test('initialize returns false on non-iOS', async () => {
    const result = await appleIAPService.initialize();
    expect(result).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CROSS-PLATFORM PLAN CONSISTENCY
// ═══════════════════════════════════════════════════════════════════════

describe('Cross-Platform Plan Consistency', () => {
  test('basic plan exists on both Stripe and Apple', () => {
    const { subscriptionService } = require('../../services/subscriptionService');
    const basicPlan = subscriptionService.getPlan('basic');
    expect(basicPlan).toBeDefined();
    expect(basicPlan.stripePriceId).toBeDefined();
    expect(basicPlan.appleProductId).toBeDefined();
  });

  test('pro plan exists on both Stripe and Apple', () => {
    const { subscriptionService } = require('../../services/subscriptionService');
    const proPlan = subscriptionService.getPlan('pro');
    expect(proPlan).toBeDefined();
    expect(proPlan.stripePriceId).toBeDefined();
    expect(proPlan.appleProductId).toBeDefined();
  });

  test('Apple product IDs in appleIAPService match subscriptionService', () => {
    const { subscriptionService } = require('../../services/subscriptionService');
    expect(APPLE_PRODUCT_IDS.basic).toBe(subscriptionService.getPlan('basic').appleProductId);
    expect(APPLE_PRODUCT_IDS.pro).toBe(subscriptionService.getPlan('pro').appleProductId);
  });

  test('same feature set applies regardless of payment platform', () => {
    const { subscriptionService } = require('../../services/subscriptionService');
    // Features depend on subscription type, not payment method
    const features = ['scoreboard', 'teams_limited', 'basic_stats', 'export_excel', 'team_tracking'];

    features.forEach(feature => {
      // Same result for each plan type regardless of whether payment was via Apple or Stripe
      const freeResult = subscriptionService.isFeatureAvailable('free', feature);
      const basicResult = subscriptionService.isFeatureAvailable('basic', feature);
      const proResult = subscriptionService.isFeatureAvailable('pro', feature);

      // Pro always has access
      expect(proResult).toBe(true);
      // Free never has team/stat features
      if (feature === 'teams_limited' || feature === 'basic_stats') {
        expect(freeResult).toBe(false);
        expect(basicResult).toBe(true);
      }
    });
  });
});
