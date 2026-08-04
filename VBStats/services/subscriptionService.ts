/**
 * Subscription Service - Manages user subscription types and payment integration
 */

import { API_BASE_URL } from './api';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch, apiFetchJson } from './http';

// Stripe Publishable Key
export const STRIPE_PUBLISHABLE_KEY = 'pk_live_51SsPg4JAUMhTgnDDXmhaJVhotefqHTRXUalJRW5QHZLRWrAHDR9khiGkI6m54yTaWyVyaI7sSkDGxy8Gk52YmTv100ElaTBhuX';

// Subscription Types
export type SubscriptionType = 'free' | 'basic' | 'pro';

export interface SubscriptionPlan {
  id: SubscriptionType;
  name: string;
  price: number;
  priceString: string;
  features: string[];
  limitations?: string[];
  stripePriceId?: string;
  appleProductId?: string;
  recommended?: boolean;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Gratis',
    price: 0,
    priceString: '0 €/mes',
    features: [
      'Buscar estadísticas por código',
      'Ver informes compartidos',
      'Marcador de partido',
    ],
    limitations: [
      'Sin gestión de equipos',
      'Sin registro de estadísticas',
      'Sin exportación de informes',
    ],
  },
  {
    id: 'basic',
    name: 'Básico',
    price: 4.99,
    priceString: '4,99€/mes',
    features: [
      'Crear hasta 2 equipos',
      'Configuración básica de estadísticas',
      'Informes de estadísticas de partidos individuales',
      'Marcador de partido',
    ],
    limitations: [
      'Estadísticas avanzadas (Pro)',
      'Equipos ilimitados (Pro)',
      'Estadísticas de seguimiento y progreso del equipo (Pro)',
    ],
    stripePriceId: 'price_1SsWrGJAUMhTgnDDYlr1nUcQ',
    appleProductId: 'com.vbstats.basico.mes',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 9.99,
    priceString: '9,99€/mes',
    features: [
      'Equipos ilimitados',
      'Todas las estadísticas',
      'Configuración avanzada',
      'Estadísticas de seguimiento y progreso del equipo',
      'Marcador de partido',
      'Sin limitaciones',
    ],
    stripePriceId: 'price_1SsWsEJAUMhTgnDDKSO78qnD',
    appleProductId: 'com.vbstats.pro.mes',
    recommended: true,
  },
];

// Check if current platform uses Apple IAP (iOS) or Stripe (Android/Web)
export const isApplePlatform = (): boolean => Platform.OS === 'ios';
export const useAppleIAP = (): boolean => Platform.OS === 'ios';

// Basic settings categories - only these can be ENABLED in basic plan
export const BASIC_ENABLED_STATS = {
  categories: ['Recepción', 'Ataque', 'Bloqueo', 'Saque'],
  // Types that are enabled by default in basic
  enabledTypes: {
    'Recepción': ['Doble positivo', 'Positivo', 'Neutro', 'Error'],
    'Ataque': ['Positivo', 'Error'],
    'Bloqueo': ['Positivo'],
    'Saque': ['Punto directo', 'Error'],
  },
  // Categories completely disabled in basic
  disabledCategories: ['Defensa', 'Colocación'],
};

// Maximum teams for basic subscription
export const BASIC_MAX_TEAMS = 2;

// Trial configuration
export const TRIAL_DAYS = 7;

export interface TrialInfo {
  planType: SubscriptionType;
  endsAt: string;
  daysRemaining: number;
}

export interface TrialEligibility {
  eligible: boolean;
  deviceUsedTrial: boolean;
  userUsedTrial: boolean;
  currentTrial: TrialInfo | null;
  trialDays: number;
}

export interface UserSubscription {
  type: SubscriptionType;
  expiresAt?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  cancelAtPeriodEnd?: boolean;
  autoRenew?: boolean;
  cancelledAt?: string | null;
  trialUsed?: boolean;
  activeTrial?: TrialInfo | null;
  hasAppleSubscription?: boolean;
}

export const SUBSCRIPTIONS_URL = `${API_BASE_URL}/subscriptions`;

/**
 * Last plan the server confirmed, per user.
 *
 * Used only to survive a transient failure without visibly downgrading someone to
 * 'free'. It is never used to *grant* access on its own: every gated action still
 * revalidates against the server, and the server is the only thing that can raise
 * a plan.
 */
const SUBSCRIPTION_CACHE_KEY = '@VBStats:lastSubscription';

const readCachedSubscription = async (userId: number): Promise<UserSubscription | null> => {
  try {
    const raw = await AsyncStorage.getItem(`${SUBSCRIPTION_CACHE_KEY}:${userId}`);
    if (!raw) return null;
    const cached: UserSubscription = JSON.parse(raw);
    // An expired cached plan is worthless — fall through to 'free'.
    if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) return null;
    return cached;
  } catch {
    return null;
  }
};

const writeCachedSubscription = async (userId: number, data: UserSubscription): Promise<void> => {
  try {
    await AsyncStorage.setItem(`${SUBSCRIPTION_CACHE_KEY}:${userId}`, JSON.stringify(data));
  } catch {
    // Caching is best-effort.
  }
};

// Validate subscription from server (to prevent local tampering)
const validateSubscriptionFromServer = async (userId: number): Promise<SubscriptionType> => {
  try {
    const response = await apiFetch(`${SUBSCRIPTIONS_URL}/${userId}`);
    if (!response.ok) {
      return 'free';
    }
    const data = await response.json();
    
    // Check if subscription has expired
    if (data.expiresAt) {
      const expirationDate = new Date(data.expiresAt);
      if (expirationDate < new Date()) {
        console.log('⚠️ Subscription expired, returning free');
        return 'free';
      }
    }
    
    return data.type || 'free';
  } catch (error) {
    console.error('Error validating subscription:', error);
    return 'free';
  }
};

export const subscriptionService = {
  SUBSCRIPTIONS_URL,
  
  /**
   * Get the user's current subscription.
   *
   * On a *network* failure we return the last plan the server confirmed instead of
   * falling back to 'free'. Treating every failure as "free" meant a lost
   * connection — or any bug in the request — silently stripped a paying user of
   * their plan in the UI. Only an explicit answer from the server can downgrade.
   */
  getSubscription: async (userId: number): Promise<UserSubscription> => {
    try {
      const response = await apiFetch(`${SUBSCRIPTIONS_URL}/${userId}`);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // Session no longer valid: the caller will route back to login.
          return { type: 'free' };
        }
        // 5xx / 404 and friends: don't punish the user for a server hiccup.
        const cached = await readCachedSubscription(userId);
        return cached || { type: 'free' };
      }

      const data = await response.json();

      // Validate expiration client-side as well
      if (data.expiresAt) {
        const expirationDate = new Date(data.expiresAt);
        if (expirationDate < new Date() && data.type !== 'free') {
          console.log('⚠️ Subscription expired locally');
          return { type: 'free', expiresAt: data.expiresAt };
        }
      }

      await writeCachedSubscription(userId, data);
      return data;
    } catch (error) {
      console.error('Error fetching subscription:', error);
      const cached = await readCachedSubscription(userId);
      return cached || { type: 'free' };
    }
  },

  // Validate subscription with server (force re-check from backend)
  // Use this before critical operations to ensure subscription is valid
  validateSubscription: async (userId: number): Promise<SubscriptionType> => {
    return validateSubscriptionFromServer(userId);
  },

  // Check if a subscription type allows a specific feature with server validation
  validateFeatureAccess: async (userId: number, feature: string): Promise<boolean> => {
    const validatedType = await validateSubscriptionFromServer(userId);
    return subscriptionService.isFeatureAvailable(validatedType, feature);
  },

  // Update subscription type - NOTE: This will be rejected by server for paid upgrades
  // Only use for downgrade to free (cancellation). Upgrades must go through Stripe checkout
  updateSubscription: async (userId: number, subscriptionType: SubscriptionType): Promise<boolean> => {
    // Only allow downgrade to free via direct API call
    if (subscriptionType !== 'free') {
      console.warn('⚠️ Direct subscription upgrade not allowed. Use createCheckoutSession instead.');
      return false;
    }
    
    try {
      const response = await apiFetchJson(`${SUBSCRIPTIONS_URL}/${userId}`, 'PUT', {
        subscription_type: subscriptionType,
      });
      return response.ok;
    } catch (error) {
      console.error('Error updating subscription:', error);
      return false;
    }
  },

  // Create Stripe checkout session for subscription
  createCheckoutSession: async (userId: number, planId: SubscriptionType): Promise<{ sessionUrl?: string; error?: string }> => {
    try {
      let plan: SubscriptionPlan | undefined;
      for (let i = 0; i < SUBSCRIPTION_PLANS.length; i++) {
        if (SUBSCRIPTION_PLANS[i].id === planId) {
          plan = SUBSCRIPTION_PLANS[i];
          break;
        }
      }
      if (!plan || !plan.stripePriceId) {
        return { error: 'Plan no válido' };
      }

      const response = await apiFetchJson(`${SUBSCRIPTIONS_URL}/create-checkout`, 'POST', {
        priceId: plan.stripePriceId,
        platform: Platform.OS,
      });

      if (!response.ok) {
        const error = await response.json();
        return { error: error.message || 'Error al crear sesión de pago' };
      }

      const data = await response.json();
      return { sessionUrl: data.url };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      return { error: 'Error de conexión' };
    }
  },

  // Check if a feature is available for subscription type
  isFeatureAvailable: (subscriptionType: SubscriptionType, feature: string): boolean => {
    const arrayIncludes = (arr: string[], val: string): boolean => {
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] === val) return true;
      }
      return false;
    };
    
    switch (subscriptionType) {
      case 'pro':
        return true;
      case 'basic':
        // Basic has limited features
        const basicFeatures = ['teams_limited', 'basic_stats', 'scoreboard', 'summary_report'];
        return arrayIncludes(basicFeatures, feature);
      case 'free':
        // Free only has code search and scoreboard
        const freeFeatures = ['code_search', 'scoreboard', 'view_reports'];
        return arrayIncludes(freeFeatures, feature);
      default:
        return false;
    }
  },

  // Check if user can create more teams
  canCreateTeam: (subscriptionType: SubscriptionType, currentTeamCount: number): boolean => {
    if (subscriptionType === 'pro') return true;
    if (subscriptionType === 'basic') return currentTeamCount < BASIC_MAX_TEAMS;
    return false; // Free cannot create teams
  },

  // Check if a stat setting can be enabled in basic plan
  canEnableStatInBasic: (category: string, statType: string): boolean => {
    const arrayIncludes = (arr: string[], val: string): boolean => {
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] === val) return true;
      }
      return false;
    };
    
    if (arrayIncludes(BASIC_ENABLED_STATS.disabledCategories, category)) {
      return false;
    }
    const enabledTypes = BASIC_ENABLED_STATS.enabledTypes[category as keyof typeof BASIC_ENABLED_STATS.enabledTypes];
    if (!enabledTypes) return false;
    return arrayIncludes(enabledTypes, statType);
  },

  // Get plan by ID
  getPlan: (planId: SubscriptionType): SubscriptionPlan | undefined => {
    for (let i = 0; i < SUBSCRIPTION_PLANS.length; i++) {
      if (SUBSCRIPTION_PLANS[i].id === planId) {
        return SUBSCRIPTION_PLANS[i];
      }
    }
    return undefined;
  },

  // Generate match share code
  generateShareCode: (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  },

  // Search match by share code
  searchByCode: async (code: string): Promise<{ matchId?: number; error?: string }> => {
    try {
      const response = await apiFetch(`${API_BASE_URL}/matches/by-code/${code}`);
      if (!response.ok) {
        if (response.status === 404) {
          return { error: 'Código no encontrado' };
        }
        return { error: 'Error al buscar el partido' };
      }
      const data = await response.json();
      return { matchId: data.id };
    } catch (error) {
      console.error('Error searching by code:', error);
      return { error: 'Error de conexión' };
    }
  },

  // Cancel subscription
  cancelSubscription: async (userId: number): Promise<{ success: boolean; expiresAt?: string; cancelledAt?: string; error?: string }> => {
    try {
      const response = await apiFetchJson(`${SUBSCRIPTIONS_URL}/${userId}/cancel`, 'POST');

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || data.message || 'Error al cancelar la suscripción' };
      }

      return { 
        success: true, 
        expiresAt: data.expiresAt,
        cancelledAt: data.cancelledAt,
      };
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return { success: false, error: 'Error de conexión' };
    }
  },

  // Check trial eligibility
  checkTrialEligibility: async (userId: number, deviceId: string): Promise<TrialEligibility> => {
    try {
      const response = await apiFetchJson(`${SUBSCRIPTIONS_URL}/check-trial-eligibility`, 'POST', { deviceId });

      if (!response.ok) {
        return {
          eligible: false,
          deviceUsedTrial: false,
          userUsedTrial: false,
          currentTrial: null,
          trialDays: TRIAL_DAYS,
        };
      }

      return await response.json();
    } catch (error) {
      console.error('Error checking trial eligibility:', error);
      return {
        eligible: false,
        deviceUsedTrial: false,
        userUsedTrial: false,
        currentTrial: null,
        trialDays: TRIAL_DAYS,
      };
    }
  },

  // Start a free trial
  startTrial: async (userId: number, planType: SubscriptionType, deviceId: string): Promise<{ success: boolean; trialEndsAt?: string; error?: string }> => {
    try {
      const response = await apiFetchJson(`${SUBSCRIPTIONS_URL}/start-trial`, 'POST', { planType, deviceId });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'Error al iniciar la prueba gratuita' };
      }

      const data = await response.json();
      return { success: true, trialEndsAt: data.trialEndsAt };
    } catch (error) {
      console.error('Error starting trial:', error);
      return { success: false, error: 'Error de conexión' };
    }
  },

  // Create Stripe checkout session with optional trial
  createCheckoutSessionWithTrial: async (
    userId: number, 
    planId: SubscriptionType, 
    deviceId: string,
    withTrial: boolean = false
  ): Promise<{ sessionUrl?: string; sessionId?: string; reactivated?: boolean; type?: SubscriptionType; error?: string }> => {
    try {
      let plan: SubscriptionPlan | undefined;
      for (let i = 0; i < SUBSCRIPTION_PLANS.length; i++) {
        if (SUBSCRIPTION_PLANS[i].id === planId) {
          plan = SUBSCRIPTION_PLANS[i];
          break;
        }
      }
      if (!plan || !plan.stripePriceId) {
        return { error: 'Plan no válido' };
      }

      const response = await apiFetchJson(`${SUBSCRIPTIONS_URL}/create-checkout`, 'POST', {
        priceId: plan.stripePriceId,
        planType: planId,
        platform: Platform.OS,
        withTrial,
        deviceId,
      });

      if (!response.ok) {
        const error = await response.json();
        return { error: error.message || 'Error al crear sesión de pago' };
      }

      const data = await response.json();
      return { sessionUrl: data.url, sessionId: data.sessionId, reactivated: data.reactivated, type: data.type };
    } catch (error) {
      console.error('Error creating checkout session with trial:', error);
      return { error: 'Error de conexión' };
    }
  },

  // Verify checkout session directly with Stripe (handles webhook delays)
  verifyCheckoutSession: async (
    sessionId: string, 
    userId: number
  ): Promise<{ success: boolean; type?: SubscriptionType; isTrial?: boolean; message?: string; error?: string }> => {
    try {
      const response = await apiFetchJson(`${SUBSCRIPTIONS_URL}/verify-checkout-session`, 'POST', { sessionId });

      const data = await response.json();
      
      if (!response.ok) {
        return { 
          success: false, 
          error: data.error || 'Error al verificar el pago' 
        };
      }

      return data;
    } catch (error) {
      console.error('Error verifying checkout session:', error);
      return { success: false, error: 'Error de conexión' };
    }
  },

  // Get available upgrade plans based on current plan
  getAvailableUpgrades: (currentPlan: SubscriptionType): SubscriptionPlan[] => {
    const upgrades: SubscriptionPlan[] = [];
    for (let i = 0; i < SUBSCRIPTION_PLANS.length; i++) {
      const plan = SUBSCRIPTION_PLANS[i];
      if (currentPlan === 'free' && (plan.id === 'basic' || plan.id === 'pro')) {
        upgrades.push(plan);
      } else if (currentPlan === 'basic' && plan.id === 'pro') {
        upgrades.push(plan);
      }
      // If pro, no upgrades available
    }
    return upgrades;
  },
};

export default subscriptionService;
