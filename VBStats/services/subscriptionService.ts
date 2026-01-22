/**
 * Subscription Service - Manages user subscription types and payment integration
 */

import { API_BASE_URL } from './api';
import { Platform } from 'react-native';

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
  recommended?: boolean;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Gratis',
    price: 0,
    priceString: 'Gratis',
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
    name: 'Básica',
    price: 4.99,
    priceString: '4,99€/mes',
    features: [
      'Crear hasta 2 equipos',
      'Configuración básica de estadísticas',
      'Informe resumido con código',
      'Marcador de partido',
    ],
    limitations: [
      'Estadísticas avanzadas (Pro)',
      'Equipos ilimitados (Pro)',
      'Informes completos (Pro)',
    ],
    stripePriceId: 'price_1SsS4aJAUMhTgnDDHPblpB1L',
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
      'Informes completos',
      'Marcador de partido',
      'Sin limitaciones',
    ],
    stripePriceId: 'price_1SsS8CJAUMhTgnDDPWo9z33Z',
    recommended: true,
  },
];

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

export interface UserSubscription {
  type: SubscriptionType;
  expiresAt?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export const SUBSCRIPTIONS_URL = `${API_BASE_URL}/subscriptions`;

export const subscriptionService = {
  SUBSCRIPTIONS_URL,
  
  // Get user's current subscription
  getSubscription: async (userId: number): Promise<UserSubscription> => {
    try {
      const response = await fetch(`${SUBSCRIPTIONS_URL}/${userId}`);
      if (!response.ok) {
        // Default to free if no subscription found
        return { type: 'free' };
      }
      return response.json();
    } catch (error) {
      console.error('Error fetching subscription:', error);
      return { type: 'free' };
    }
  },

  // Update subscription type (for free plan or after payment)
  updateSubscription: async (userId: number, subscriptionType: SubscriptionType): Promise<boolean> => {
    try {
      const response = await fetch(`${SUBSCRIPTIONS_URL}/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_type: subscriptionType }),
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

      const response = await fetch(`${SUBSCRIPTIONS_URL}/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          priceId: plan.stripePriceId,
          platform: Platform.OS,
        }),
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
      const response = await fetch(`${API_BASE_URL}/matches/by-code/${code}`);
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
  cancelSubscription: async (userId: number): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${SUBSCRIPTIONS_URL}/${userId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || 'Error al cancelar la suscripción' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error cancelling subscription:', error);
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
