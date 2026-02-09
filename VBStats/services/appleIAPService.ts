/**
 * Apple In-App Purchase Service
 * Handles iOS subscriptions through Apple's StoreKit/In-App Purchase system
 * 
 * Product IDs configured in App Store Connect:
 * - com.vbstats.basico.mensual (Plan BASICO - 4.99€/mes)
 * - com.vbstats.pro.mensual (Plan PRO - 9.99€/mes)
 */

import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  fetchProducts,
  getAvailablePurchases,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  showManageSubscriptionsIOS,
  getReceiptIOS,
} from 'react-native-iap';
import type { Purchase, PurchaseError, EventSubscription } from 'react-native-iap';
import { API_BASE_URL } from './api';
import { SubscriptionType } from './subscriptionService';

// Apple Product IDs (configured in App Store Connect)
export const APPLE_PRODUCT_IDS = {
  basic: 'com.vbstats.basico.mensual',
  pro: 'com.vbstats.pro.mensual',
};

// All subscription product IDs
export const APPLE_SUBSCRIPTION_SKUS = [
  APPLE_PRODUCT_IDS.basic,
  APPLE_PRODUCT_IDS.pro,
];

export interface AppleProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  localizedPrice: string;
  currency: string;
}

export interface ApplePurchase {
  productId: string;
  transactionId: string;
  transactionDate: number;
  transactionReceipt: string;
  originalTransactionIdentifierIOS?: string;
}

export interface AppleSubscriptionStatus {
  isActive: boolean;
  productId: string | null;
  expirationDate: string | null;
  willRenew: boolean;
  isInTrial: boolean;
}

class AppleIAPService {
  private isInitialized: boolean = false;
  private purchaseUpdateSubscription: EventSubscription | null = null;
  private purchaseErrorSubscription: EventSubscription | null = null;

  /**
   * Initialize the IAP connection
   * Must be called before any other IAP operations
   */
  async initialize(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      console.log('Apple IAP is only available on iOS');
      return false;
    }

    if (this.isInitialized) {
      return true;
    }

    try {
      const result = await initConnection();
      console.log('✅ Apple IAP connection initialized:', result);
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Error initializing Apple IAP:', error);
      return false;
    }
  }

  /**
   * End the IAP connection
   * Should be called when the app is closing or IAP is no longer needed
   */
  async endConnection(): Promise<void> {
    if (Platform.OS !== 'ios') return;

    try {
      await endConnection();
      this.isInitialized = false;
      console.log('Apple IAP connection ended');
    } catch (error) {
      console.error('Error ending Apple IAP connection:', error);
    }
  }

  /**
   * Get available subscription products from App Store
   */
  async getProducts(): Promise<AppleProduct[]> {
    if (Platform.OS !== 'ios') {
      return [];
    }

    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Use fetchProducts with type 'subs' for auto-renewable subscription products
      console.log('📦 Fetching subscription products with SKUs:', APPLE_SUBSCRIPTION_SKUS);
      const products = await fetchProducts({ skus: APPLE_SUBSCRIPTION_SKUS, type: 'subs' });
      console.log('📦 Available Apple products:', JSON.stringify(products));
      
      if (!products || products.length === 0) {
        console.warn('⚠️ No products returned from App Store. Check Product IDs and App Store Connect configuration.');
        return [];
      }
      
      // Map products to our interface - use type any to handle different product types
      return products.map((product: any) => ({
        productId: product.productId || product.id || '',
        title: product.title || product.name || '',
        description: product.description || '',
        price: String(product.price || ''),
        localizedPrice: product.localizedPrice || product.priceString || String(product.price || ''),
        currency: product.currency || '',
      }));
    } catch (error) {
      console.error('❌ Error fetching Apple subscription products:', error);
      return [];
    }
  }

  /**
   * Request a subscription purchase
   * @param productId - The Apple product ID (e.g., 'com.vbstats.pro.mensual')
   * @param userId - The user ID in our system
   */
  async purchaseSubscription(productId: string, userId: number): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }> {
    if (Platform.OS !== 'ios') {
      return { success: false, error: 'Apple IAP is only available on iOS' };
    }

    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise(async (resolve) => {
      let purchaseListener: EventSubscription | null = null;
      let errorListener: EventSubscription | null = null;

      // Set up temporary listeners for this purchase
      purchaseListener = purchaseUpdatedListener(async (purchase: Purchase) => {
        console.log('✅ Apple purchase completed:', purchase);

        try {
          // Get the receipt for verification
          const receipt = await getReceiptIOS();

          // Verify the purchase with our server
          const verificationResult = await this.verifyPurchaseWithServer(
            {
              productId: purchase.productId,
              transactionId: purchase.transactionId || undefined,
              transactionReceipt: receipt,
              originalTransactionIdentifierIOS: (purchase as any).originalTransactionIdentifierIOS,
            },
            userId
          );

          if (verificationResult.success) {
            // Finish the transaction after successful verification
            await finishTransaction({ purchase, isConsumable: false });
            
            // Clean up listeners
            purchaseListener?.remove();
            errorListener?.remove();
            
            resolve({
              success: true,
              transactionId: purchase.transactionId || undefined,
            });
          } else {
            purchaseListener?.remove();
            errorListener?.remove();
            
            resolve({
              success: false,
              error: verificationResult.error || 'Error al verificar la compra',
            });
          }
        } catch (error: any) {
          console.error('Error processing purchase:', error);
          purchaseListener?.remove();
          errorListener?.remove();
          
          resolve({
            success: false,
            error: error.message || 'Error al procesar la compra',
          });
        }
      });

      errorListener = purchaseErrorListener((error: PurchaseError) => {
        console.error('❌ Apple purchase error:', error);
        
        purchaseListener?.remove();
        errorListener?.remove();

        // Handle specific error codes - check code as string for compatibility
        const errorCode = String(error.code || '');
        if (errorCode.includes('CANCEL') || errorCode.includes('cancel')) {
          resolve({ success: false, error: 'Compra cancelada por el usuario' });
          return;
        }
        if (errorCode.includes('OWNED') || errorCode.includes('owned')) {
          resolve({ success: false, error: 'Ya tienes esta suscripción activa' });
          return;
        }
        if (errorCode.includes('NETWORK') || errorCode.includes('network')) {
          resolve({ success: false, error: 'Error de conexión. Verifica tu conexión a internet.' });
          return;
        }
        
        resolve({ 
          success: false, 
          error: error.message || 'Error al procesar la compra' 
        });
      });

      try {
        console.log('🛒 Starting Apple purchase for:', productId);
        
        // Request the purchase - this will trigger the listeners
        // For iOS subscriptions in react-native-iap v14.x, use 'apple' key (recommended)
        await requestPurchase({ 
          request: { 
            apple: { 
              sku: productId,
              andDangerouslyFinishTransactionAutomatically: false,
            } 
          }, 
          type: 'subs' 
        });
      } catch (error: any) {
        console.error('❌ Error requesting purchase:', error);
        
        purchaseListener?.remove();
        errorListener?.remove();
        
        resolve({
          success: false,
          error: error.message || 'Error al iniciar la compra',
        });
      }
    });
  }

  /**
   * Verify the purchase receipt with our backend server
   * The server will validate with Apple and update the user's subscription
   */
  private async verifyPurchaseWithServer(
    purchase: {
      productId: string;
      transactionId?: string;
      transactionReceipt: string;
      originalTransactionIdentifierIOS?: string;
    },
    userId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/subscriptions/apple/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          productId: purchase.productId,
          transactionId: purchase.transactionId,
          receipt: purchase.transactionReceipt,
          originalTransactionId: purchase.originalTransactionIdentifierIOS,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || 'Error de verificación' };
      }

      const data = await response.json();
      return { success: data.success };
    } catch (error) {
      console.error('Error verifying purchase with server:', error);
      return { success: false, error: 'Error de conexión al servidor' };
    }
  }

  /**
   * Restore previous purchases
   * Used when user reinstalls the app or logs in on a new device
   */
  async restorePurchases(userId: number): Promise<{
    success: boolean;
    restoredProductId?: string;
    error?: string;
  }> {
    if (Platform.OS !== 'ios') {
      return { success: false, error: 'Apple IAP is only available on iOS' };
    }

    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('🔄 Restoring Apple purchases...');
      const purchases = await getAvailablePurchases();
      
      if (!purchases || purchases.length === 0) {
        return { success: false, error: 'No se encontraron compras para restaurar' };
      }

      console.log('📦 Found purchases to restore:', purchases.length);

      // Find the most recent valid subscription
      let latestPurchase: Purchase | null = null;
      let latestDate = 0;

      for (const purchase of purchases) {
        if (APPLE_SUBSCRIPTION_SKUS.includes(purchase.productId)) {
          const purchaseDate = purchase.transactionDate || 0;
          if (purchaseDate > latestDate) {
            latestDate = purchaseDate;
            latestPurchase = purchase;
          }
        }
      }

      if (!latestPurchase) {
        return { success: false, error: 'No se encontraron suscripciones activas' };
      }

      // Get receipt for verification
      const receipt = await getReceiptIOS();

      // Verify with server
      const verificationResult = await this.verifyPurchaseWithServer(
        {
          productId: latestPurchase.productId,
          transactionId: latestPurchase.transactionId || undefined,
          transactionReceipt: receipt,
          originalTransactionIdentifierIOS: (latestPurchase as any).originalTransactionIdentifierIOS,
        },
        userId
      );

      if (verificationResult.success) {
        return {
          success: true,
          restoredProductId: latestPurchase.productId,
        };
      } else {
        return {
          success: false,
          error: verificationResult.error || 'Error al restaurar la suscripción',
        };
      }
    } catch (error: any) {
      console.error('❌ Error restoring purchases:', error);
      return { 
        success: false, 
        error: error.message || 'Error al restaurar compras' 
      };
    }
  }

  /**
   * Check current subscription status
   * Queries Apple for the current subscription status
   */
  async checkSubscriptionStatus(userId: number): Promise<AppleSubscriptionStatus> {
    if (Platform.OS !== 'ios') {
      return {
        isActive: false,
        productId: null,
        expirationDate: null,
        willRenew: false,
        isInTrial: false,
      };
    }

    try {
      // Get status from our server (which validates with Apple)
      const response = await fetch(`${API_BASE_URL}/subscriptions/apple/status/${userId}`);
      
      if (!response.ok) {
        return {
          isActive: false,
          productId: null,
          expirationDate: null,
          willRenew: false,
          isInTrial: false,
        };
      }

      return await response.json();
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return {
        isActive: false,
        productId: null,
        expirationDate: null,
        willRenew: false,
        isInTrial: false,
      };
    }
  }

  /**
   * Convert Apple product ID to our subscription type
   */
  productIdToSubscriptionType(productId: string): SubscriptionType {
    if (productId === APPLE_PRODUCT_IDS.basic) {
      return 'basic';
    }
    if (productId === APPLE_PRODUCT_IDS.pro) {
      return 'pro';
    }
    return 'free';
  }

  /**
   * Convert our subscription type to Apple product ID
   */
  subscriptionTypeToProductId(type: SubscriptionType): string | null {
    if (type === 'basic') {
      return APPLE_PRODUCT_IDS.basic;
    }
    if (type === 'pro') {
      return APPLE_PRODUCT_IDS.pro;
    }
    return null;
  }

  /**
   * Set up purchase listeners for handling purchases made outside the app
   * (e.g., from App Store promotion, Family Sharing, etc.)
   */
  setupPurchaseListeners(onPurchaseCompleted: (purchase: Purchase) => void): void {
    if (Platform.OS !== 'ios') return;

    // Remove existing listeners
    this.removePurchaseListeners();

    // Set up new listeners
    this.purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: Purchase) => {
        console.log('📥 Purchase update received:', purchase);
        onPurchaseCompleted(purchase);
      }
    );

    this.purchaseErrorSubscription = purchaseErrorListener(
      (error: PurchaseError) => {
        console.error('❌ Purchase error:', error);
      }
    );
  }

  /**
   * Remove purchase listeners
   */
  removePurchaseListeners(): void {
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
      this.purchaseUpdateSubscription = null;
    }
    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
      this.purchaseErrorSubscription = null;
    }
  }

  /**
   * Open the subscription management page in App Store
   * Users can cancel or modify their subscription here
   */
  async openSubscriptionManagement(): Promise<void> {
    if (Platform.OS !== 'ios') return;

    try {
      // Use the native method to show subscription management
      await showManageSubscriptionsIOS();
    } catch (error) {
      console.error('Error opening subscription management:', error);
      // Fallback: open settings app
      const { Linking } = require('react-native');
      await Linking.openURL('https://apps.apple.com/account/subscriptions');
    }
  }
}

export const appleIAPService = new AppleIAPService();
export default appleIAPService;
