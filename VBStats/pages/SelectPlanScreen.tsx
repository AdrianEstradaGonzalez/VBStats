/**
 * Pantalla de selección de plan de suscripción
 * Diseño moderno y profesional con integración de pagos
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  StatusBar,
  Image,
  Linking,
  AppState,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows, SAFE_AREA_TOP } from '../styles';
import { CustomAlert } from '../components';
import { 
  SUBSCRIPTION_PLANS, 
  SubscriptionType, 
  SubscriptionPlan,
  subscriptionService,
  TRIAL_DAYS,
  TrialEligibility,
  useAppleIAP,
} from '../services/subscriptionService';
import { appleIAPService, AppleProduct } from '../services/appleIAPService';
import GuideScreen from './GuideScreen';

// Safe area paddings para Android
const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;

// Legal URLs - Replace with your actual URLs
const PRIVACY_POLICY_URL = 'https://bluedebug.com/vistas/vbstats-privacidad';
const TERMS_OF_SERVICE_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

interface SelectPlanScreenProps {
  onPlanSelected: (planType: SubscriptionType) => void;
  onEnsureUser?: () => Promise<number | null>;
  onBack: () => void;
  currentPlan?: SubscriptionType;
  userId?: number | null;
  cancelAtPeriodEnd?: boolean;
}

export default function SelectPlanScreen({ 
  onPlanSelected, 
  onEnsureUser,
  onBack,
  currentPlan,
  userId,
  cancelAtPeriodEnd = false,
}: SelectPlanScreenProps) {
  const isApple = useAppleIAP();
  // Default selected plan should be the next upgrade
  const defaultSelectedPlan = currentPlan === 'basic' ? 'pro' : 'basic';
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionType>(defaultSelectedPlan);
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showConfirmPlan, setShowConfirmPlan] = useState(false);
  const [trialEligibility, setTrialEligibility] = useState<TrialEligibility | null>(null);
  const [isTrialMode, setIsTrialMode] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');
  const [showTrialInfo, setShowTrialInfo] = useState(false);
  const [appleProducts, setAppleProducts] = useState<AppleProduct[]>([]);
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  const [showProAlert, setShowProAlert] = useState(false);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const checkoutOpenedRef = useRef(false);

  // Si el usuario ya es PRO (activo y renovando), mostrar alerta y no permitir continuar al pago
  // Pero si canceló (cancelAtPeriodEnd), permitir re-suscribirse
  const isAlreadyPro = currentPlan === 'pro' && !cancelAtPeriodEnd;

  useEffect(() => {
    if (isAlreadyPro) {
      setShowProAlert(true);
    }
  }, [isAlreadyPro]);

  // Initialize Apple IAP for iOS
  useEffect(() => {
    if (isApple) {
      const initAppleIAP = async () => {
        await appleIAPService.initialize();
        const products = await appleIAPService.getProducts();
        setAppleProducts(products);
      };
      initAppleIAP();

      // Cleanup on unmount
      return () => {
        appleIAPService.endConnection();
      };
    }
  }, [isApple]);

  // Generate or get device ID for trial tracking
  useEffect(() => {
    const getOrCreateDeviceId = async () => {
      try {
        let storedDeviceId = await AsyncStorage.getItem('vbstats_device_id');
        if (!storedDeviceId) {
          // Generate a unique device ID
          storedDeviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
          await AsyncStorage.setItem('vbstats_device_id', storedDeviceId);
        }
        setDeviceId(storedDeviceId);
      } catch (error) {
        console.error('Error getting device ID:', error);
        // Fallback device ID
        setDeviceId('device_' + Date.now());
      }
    };
    getOrCreateDeviceId();
  }, []);

  // Check trial eligibility when userId and deviceId are available
  useEffect(() => {
    const checkEligibility = async () => {
      if (userId && deviceId) {
        const eligibility = await subscriptionService.checkTrialEligibility(userId, deviceId);
        setTrialEligibility(eligibility);
      }
    };
    checkEligibility();
  }, [userId, deviceId]);

  // Handle Stripe checkout deep links (success/cancel)
  useEffect(() => {
    const handlePaymentUrl = async (url: string) => {
      if (!url || !userId || isApple) return;

      const isSuccess = url.includes('payment-success');
      const isCancelled = url.includes('payment-cancelled');

      if (!isSuccess && !isCancelled) return;

      if (isCancelled) {
        setErrorMessage('El pago fue cancelado o no se completó. Inténtalo de nuevo.');
        setShowErrorAlert(true);
        return;
      }

      const sessionMatch = /session_id=([^&]+)/.exec(url);
      const sessionIdFromUrl = sessionMatch ? decodeURIComponent(sessionMatch[1]) : null;

      if (!sessionIdFromUrl) {
        setErrorMessage('No pudimos validar el pago. Inténtalo de nuevo.');
        setShowErrorAlert(true);
        return;
      }

      await handleVerifyPayment(sessionIdFromUrl);
    };

    const handleUrlEvent = ({ url }: { url: string }) => {
      handlePaymentUrl(url);
    };

    const subscription = Linking.addEventListener('url', handleUrlEvent);

    const checkInitialUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        await handlePaymentUrl(initialUrl);
      }
    };

    checkInitialUrl();

    return () => {
      subscription.remove();
    };
  }, [userId, isApple]);

  // Auto-verify payment when user returns to the app from Stripe browser
  useEffect(() => {
    const appStateListener = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active' && checkoutOpenedRef.current && userId) {
        // User returned to the app after opening Stripe checkout
        console.log('📱 App became active after checkout, verifying payment...');
        checkoutOpenedRef.current = false;
        
        // Give a brief delay for any deep link to fire first
        await new Promise<void>(resolve => setTimeout(() => resolve(), 1500));
        
        // If we have a session ID, verify it directly
        if (checkoutSessionId) {
          await handleVerifyPayment(checkoutSessionId);
        } else {
          // Fallback: check subscription status from server (which now syncs with Stripe)
          try {
            const subscription = await subscriptionService.getSubscription(userId);
            if (subscription && subscription.type !== 'free') {
              onPlanSelected(subscription.type);
            }
          } catch (error) {
            console.error('Error checking subscription after return:', error);
          }
        }
      }
    });

    return () => {
      appStateListener.remove();
    };
  }, [userId, checkoutSessionId]);

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    if (plan.id === 'free') {
      setSelectedPlan('free');
      setIsTrialMode(false);
      setShowConfirmPlan(true);
      return;
    }

    setSelectedPlan(plan.id);
    setIsTrialMode(false);
  };

  const handleSelectTrial = () => {
    setSelectedPlan('pro');
    setIsTrialMode(true);
  };

  const performContinue = async () => {
    if (selectedPlan === 'free') {
      onPlanSelected('free');
      return;
    }

    let effectiveUserId = userId;
    if (!effectiveUserId && onEnsureUser) {
      effectiveUserId = await onEnsureUser();
    }

    if (!effectiveUserId) {
      setErrorMessage('No se pudo crear tu cuenta. Revisa los datos e inténtalo de nuevo.');
      setShowErrorAlert(true);
      return;
    }

    setIsLoading(true);
    try {
      // Check if we're on iOS - use Apple IAP
      if (isApple) {
        await performApplePurchase(effectiveUserId);
        return;
      }

      // Android/other platforms - use Stripe
      // SIEMPRE usar Stripe checkout, incluso para trials
      // Esto asegura que el método de pago esté configurado y se cobre automáticamente al finalizar el trial
      const result = await subscriptionService.createCheckoutSessionWithTrial(
        effectiveUserId, 
        selectedPlan, 
        deviceId,
        selectedPlan === 'pro' && isTrialMode && (userId ? !!trialEligibility?.eligible : true)
      );
      
      if (result.error) {
        setErrorMessage(result.error);
        setShowErrorAlert(true);
        return;
      }

      // If the server reactivated an existing subscription, no need for checkout
      if (result.reactivated && result.type) {
        onPlanSelected(result.type as SubscriptionType);
        return;
      }

      if (result.sessionUrl) {
        // Save session ID for verification
        if (result.sessionId) {
          setCheckoutSessionId(result.sessionId);
        }
        // Mark that we opened checkout (for AppState listener)
        checkoutOpenedRef.current = true;
        // Open Stripe checkout in browser
        try {
          await Linking.openURL(result.sessionUrl);
        } catch (linkError) {
          checkoutOpenedRef.current = false;
          console.error('Error opening URL:', linkError);
          setErrorMessage('No se pudo abrir el navegador para el pago. Copia este enlace: ' + result.sessionUrl);
          setShowErrorAlert(true);
        }
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      setErrorMessage('Error al procesar el pago. Inténtalo de nuevo.');
      setShowErrorAlert(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Apple IAP purchase (iOS only)
  const performApplePurchase = async (targetUserId?: number | null) => {
    const effectiveUserId = targetUserId ?? userId;
    if (!effectiveUserId) return;

    const plan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan);
    if (!plan || !plan.appleProductId) {
      setErrorMessage('Plan no disponible para compra');
      setShowErrorAlert(true);
      setIsLoading(false);
      return;
    }

    try {
      let availableProducts = appleProducts;
      if (availableProducts.length === 0) {
        availableProducts = await appleIAPService.getProducts();
        setAppleProducts(availableProducts);
      }

      if (availableProducts.length === 0) {
        setErrorMessage('No se pudieron cargar los productos de App Store. Inténtalo de nuevo.');
        setShowErrorAlert(true);
        return;
      }

      const hasProduct = availableProducts.some(product => product.productId === plan.appleProductId);
      if (!hasProduct) {
        setErrorMessage('El producto no está disponible en App Store. Inténtalo de nuevo más tarde.');
        setShowErrorAlert(true);
        return;
      }

      const result = await appleIAPService.purchaseSubscription(plan.appleProductId, effectiveUserId);
      
      if (result.success) {
        // Purchase successful, navigate to app
        onPlanSelected(selectedPlan);
      } else {
        if (result.error !== 'Compra cancelada por el usuario') {
          setErrorMessage(result.error || 'Error al procesar la compra');
          setShowErrorAlert(true);
        }
      }
    } catch (error: any) {
      console.error('Apple purchase error:', error);
      setErrorMessage('Error al procesar la compra con Apple. Inténtalo de nuevo.');
      setShowErrorAlert(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Restore Apple purchases (iOS only)
  const handleRestorePurchases = async () => {
    if (!userId || !isApple) return;

    setIsRestoringPurchases(true);
    try {
      const result = await appleIAPService.restorePurchases(userId);
      
      if (result.success && result.restoredProductId) {
        const restoredType = appleIAPService.productIdToSubscriptionType(result.restoredProductId);
        onPlanSelected(restoredType);
      } else {
        setErrorMessage(result.error || 'No se encontraron compras para restaurar');
        setShowErrorAlert(true);
      }
    } catch (error) {
      console.error('Error restoring purchases:', error);
      setErrorMessage('Error al restaurar compras. Inténtalo de nuevo.');
      setShowErrorAlert(true);
    } finally {
      setIsRestoringPurchases(false);
    }
  };

  const handleContinue = () => {
    // Show confirmation before proceeding to payment/selection
    setShowConfirmPlan(true);
  };

  const handleVerifyPayment = async (sessionIdOverride?: string) => {
    if (!userId) return;

    setIsVerifying(true);
    try {
      // First, try to verify using the checkout session ID (most reliable)
      const sessionIdToVerify = sessionIdOverride || checkoutSessionId;
      if (sessionIdToVerify) {
        const verifyResult = await subscriptionService.verifyCheckoutSession(sessionIdToVerify, userId);
        
        if (verifyResult.success && verifyResult.type && verifyResult.type !== 'free') {
          // Payment verified successfully via session
          onPlanSelected(verifyResult.type);
          return;
        }
        
        // If session verification failed with a specific error, show it
        if (verifyResult.error) {
          setErrorMessage(verifyResult.error);
          setShowErrorAlert(true);
          return;
        }
        
        // If session not complete yet, show appropriate message
        if (!verifyResult.success && verifyResult.message) {
          setErrorMessage(verifyResult.message);
          setShowErrorAlert(true);
          return;
        }
      }
      
      // Fallback: check subscription status directly (for webhook-processed payments)
      const subscription = await subscriptionService.getSubscription(userId);
      
      if (subscription && subscription.type !== 'free') {
        // Payment was successful
        onPlanSelected(subscription.type);
      } else {
        setErrorMessage('No hemos detectado el pago todavía. Si acabas de completar el proceso de pago, espera unos segundos e inténtalo de nuevo.');
        setShowErrorAlert(true);
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      setErrorMessage('Error al verificar el pago. Inténtalo de nuevo.');
      setShowErrorAlert(true);
    } finally {
      setIsVerifying(false);
    }
  };
  const getFeatureIcon = (feature: string, isLimitation: boolean = false) => {
    if (isLimitation) {
      return <MaterialCommunityIcons name="close" size={16} color={Colors.textTertiary} />;
    }
    return <MaterialCommunityIcons name="check" size={16} color="#22c55e" />;
  };

  const renderPlanCard = (plan: SubscriptionPlan) => {
    const isSelected = selectedPlan === plan.id && !(plan.id === 'pro' && isTrialMode);
    const isPro = plan.id === 'pro';

    return (
      <TouchableOpacity
        key={plan.id}
        style={[
          styles.planCard,
          isSelected && styles.planCardSelected,
          isPro && styles.planCardPro,
        ]}
        onPress={() => handleSelectPlan(plan)}
        activeOpacity={0.8}
      >
        {plan.recommended && (
          <View style={styles.recommendedBadge}>
            <MaterialCommunityIcons name="star" size={12} color="#fff" />
            <Text style={styles.recommendedText}>Recomendado</Text>
          </View>
        )}

        <View style={styles.planHeader}>
          <Text style={[styles.planName, isSelected && styles.planNameSelected]}>
            {plan.name}
          </Text>
          <View style={styles.priceContainer}>
            {plan.price > 0 ? (
              <>
                <Text style={[styles.priceAmount, isSelected && styles.priceAmountSelected]}>
                  {plan.price.toFixed(2).replace('.', ',')}€
                </Text>
                <Text style={[styles.pricePeriod, isSelected && styles.pricePeriodSelected]}>
                  /mes
                </Text>
              </>
            ) : (
              <Text style={[styles.priceAmount, isSelected && styles.priceAmountSelected]}>
                0€
              </Text>
            )}
          </View>
        </View>

        <View style={styles.featuresContainer}>
          {plan.features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              {getFeatureIcon(feature)}
              <Text style={[styles.featureText, isSelected && styles.featureTextSelected]}>
                {feature}
              </Text>
            </View>
          ))}
          {plan.limitations?.map((limitation, index) => (
            <View key={`lim-${index}`} style={styles.featureRow}>
              {getFeatureIcon(limitation, true)}
              <Text style={styles.limitationText}>{limitation}</Text>
            </View>
          ))}
        </View>

        {isSelected && (
          <View style={styles.selectedIndicator}>
            <MaterialCommunityIcons name="check-circle" size={24} color={Colors.primary} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // If showing guide, render GuideScreen
  if (showGuide) {
    return (
      <GuideScreen
        onBack={() => setShowGuide(false)}
        initialTab="roles"
        onlyRoles={true}
        subscriptionType={currentPlan ?? 'free'}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/VBStats_logo_sinfondo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Elige tu plan</Text>
          <Text style={styles.subtitle}>
            Selecciona el plan que mejor se adapte a tus necesidades
          </Text>
          <TouchableOpacity
            style={styles.viewDetailsButton}
            onPress={() => setShowGuide(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="information-outline" size={16} color={Colors.primary} />
            <Text style={styles.viewDetailsText}>Ver qué incluye cada plan</Text>
          </TouchableOpacity>
        </View>

        {/* Plans - filtered based on current plan */}
        <View style={styles.plansContainer}>
          {SUBSCRIPTION_PLANS.filter(plan => {
            // If no current plan (new registration), show all plans including free
            if (!currentPlan || currentPlan === undefined) {
              return true; // Show all plans: free, basic, pro
            }
            // Show only upgrade options for existing users
            if (currentPlan === 'free') {
              return plan.id === 'basic' || plan.id === 'pro';
            } else if (currentPlan === 'basic') {
              return plan.id === 'pro';
            }
            // If pro, show nothing (shouldn't reach this screen)
            return false;
          }).map(renderPlanCard)}
        </View>

        {/* Trial Card - Clear separate option when eligible */}
        {(userId ? !!trialEligibility?.eligible : true) && (
          <TouchableOpacity
            style={[
              styles.trialCard,
              isTrialMode && styles.trialCardSelected,
            ]}
            onPress={handleSelectTrial}
            activeOpacity={0.8}
          >
            <View style={styles.trialCardBadge}>
              <MaterialCommunityIcons name="gift" size={14} color="#fff" />
              <Text style={styles.trialCardBadgeText}>PRUEBA GRATUITA</Text>
            </View>
            <View style={styles.trialCardHeader}>
              <Text style={[styles.trialCardTitle, isTrialMode && styles.trialCardTitleSelected]}>
                Prueba PRO - {TRIAL_DAYS} días gratis
              </Text>
              <Text style={styles.trialCardSubtitle}>
                Después: {SUBSCRIPTION_PLANS.find(p => p.id === 'pro')?.priceString || '9,99€/mes'}
              </Text>
            </View>
            <View style={styles.trialCardFeatures}>
              <View style={styles.featureRow}>
                <MaterialCommunityIcons name="check" size={16} color="#22c55e" />
                <Text style={styles.featureText}>Todas las funciones PRO durante {TRIAL_DAYS} días</Text>
              </View>
              <View style={styles.featureRow}>
                <MaterialCommunityIcons name="check" size={16} color="#22c55e" />
                <Text style={styles.featureText}>Sin cargo durante la prueba</Text>
              </View>
              <View style={styles.featureRow}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#e67e22" />
                <Text style={[styles.featureText, { color: '#e67e22', fontWeight: '600' }]}>
                  Al acabar la prueba se cobra {SUBSCRIPTION_PLANS.find(p => p.id === 'pro')?.priceString || '9,99€/mes'} automáticamente
                </Text>
              </View>
              <View style={styles.featureRow}>
                <MaterialCommunityIcons name="information-outline" size={16} color={Colors.textSecondary} />
                <Text style={[styles.featureText, { color: Colors.textSecondary }]}>
                  Si cancelas, tu cuenta pasará al Plan Gratis
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.trialInfoButton}
              onPress={() => setShowTrialInfo(true)}
            >
              <MaterialCommunityIcons name="information-outline" size={16} color={Colors.primary} />
              <Text style={styles.trialInfoButtonText}>Más información sobre la prueba</Text>
            </TouchableOpacity>
            {isTrialMode && (
              <View style={styles.selectedIndicator}>
                <MaterialCommunityIcons name="check-circle" size={24} color="#22c55e" />
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Cancellation Info for paid plans */}
        {(selectedPlan !== 'free' || isTrialMode) && (
          <View style={styles.cancellationInfo}>
            <MaterialCommunityIcons name="information-outline" size={18} color="#5D4037" />
            <Text style={styles.cancellationInfoText}>
              Si cancelas cualquier suscripción, al finalizar el período vigente tu cuenta pasará automáticamente al Plan Gratis con funciones básicas.
            </Text>
          </View>
        )}

        {/* Payment Methods - Siempre mostrar para planes de pago */}
        {selectedPlan !== 'free' && (
          <View style={styles.paymentSection}>
            <Text style={styles.paymentTitle}>
              {isApple ? 'Pago seguro en App Store' : 'Métodos de pago seguros'}
            </Text>
            <View style={styles.paymentMethods}>
              {isApple ? (
                // iOS: Apple In-App Purchase
                <>
                  <View style={styles.paymentMethod}>
                    <MaterialCommunityIcons name="apple" size={24} color={Colors.textSecondary} />
                    <Text style={styles.paymentMethodText}>App Store</Text>
                  </View>
                </>
              ) : (
                // Android: Stripe
                <>
                  <View style={styles.paymentMethod}>
                    <MaterialCommunityIcons name="credit-card" size={24} color={Colors.textSecondary} />
                    <Text style={styles.paymentMethodText}>Tarjeta</Text>
                  </View>
                  <View style={styles.paymentMethod}>
                    <MaterialCommunityIcons name="google" size={24} color={Colors.textSecondary} />
                    <Text style={styles.paymentMethodText}>Google Pay</Text>
                  </View>
                </>
              )}
            </View>
            <Text style={styles.stripeNote}>
              {isApple 
                ? 'Pagos procesados de forma segura por App Store' 
                : 'Pagos procesados de forma segura por Stripe'}
            </Text>
          </View>
        )}

        {/* Continue Button */}
        <>
          <TouchableOpacity
            style={[styles.continueButton, (isLoading || isAlreadyPro || isVerifying) && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={isLoading || isAlreadyPro || isVerifying}
          >
            {isLoading || isVerifying ? (
              <ActivityIndicator color="#fff" />
            ) : isAlreadyPro ? (
              <>
                <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
                <Text style={styles.continueButtonText}>Ya tienes PRO</Text>
              </>
            ) : (
              <>
                <Text style={styles.continueButtonText}>
                  {selectedPlan === 'free' 
                    ? 'Continuar con Plan Gratis' 
                    : isTrialMode
                      ? `Iniciar ${TRIAL_DAYS} días gratis`
                      : isApple
                        ? 'Suscribirse'
                        : 'Continuar al pago'}
                </Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
          
          {/* Restore Purchases Button (iOS only) */}
          {isApple && (
            <TouchableOpacity
              style={styles.restorePurchasesButton}
              onPress={handleRestorePurchases}
              disabled={isRestoringPurchases}
            >
              {isRestoringPurchases ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.restorePurchasesText}>Restaurar compras anteriores</Text>
              )}
            </TouchableOpacity>
          )}
        </>

        {/* Terms */}
        <View style={styles.termsContainer}>
          <Text style={styles.termsText}>
            Al continuar, aceptas nuestros{' '}
            <Text 
              style={styles.termsLink} 
              onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
            >
              Términos de Servicio
            </Text>
            {' '}y{' '}
            <Text 
              style={styles.termsLink} 
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            >
              Política de Privacidad
            </Text>
            .
          </Text>
          <Text style={styles.termsText}>
            {isApple && selectedPlan !== 'free' ? (
              `El pago se cargará a tu cuenta de Apple ID al confirmar la compra. La suscripción se renueva automáticamente cada mes. Puedes cancelar en cualquier momento desde Ajustes > Apple ID > Suscripciones. Al cancelar, tu cuenta pasará al Plan Gratis.`
            ) : (
              isTrialMode
                ? `La prueba gratuita dura ${TRIAL_DAYS} días. Después, se cobrará ${SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan)?.priceString || ''} automáticamente cada mes. Si cancelas (antes o después de la prueba), tu cuenta pasará al Plan Gratis.`
                : selectedPlan !== 'free' 
                  ? 'La suscripción se renovará automáticamente cada mes. Al cancelar, tu cuenta pasará al Plan Gratis.'
                  : ''
            )}
          </Text>
        </View>
      </ScrollView>

      {/* Confirmation Alert */}
      <CustomAlert
        visible={showConfirmPlan}
        buttonLayout="column"
        title={isTrialMode 
          ? `Prueba gratuita PRO - ${TRIAL_DAYS} días` 
          : selectedPlan === 'free'
            ? 'Plan Gratis'
            : `Plan ${SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan)?.name || ''}`}
        message={(() => {
          const plan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan);
          if (!plan) return '¿Confirmas seleccionar este plan?';
          
          if (isTrialMode) {
            return isApple
              ? `Vas a iniciar una prueba gratuita de ${TRIAL_DAYS} días del Plan PRO.\n\n• Durante ${TRIAL_DAYS} días: acceso completo a funciones PRO sin cargo.\n• Después de la prueba: se cobra ${plan.priceString} automáticamente cada mes.\n• Si cancelas antes de que termine la prueba, no se te cobrará nada.\n• Al cancelar, tu cuenta pasará al Plan Gratis.\n\nPuedes cancelar desde Ajustes > Apple ID > Suscripciones.`
              : `Vas a iniciar una prueba gratuita de ${TRIAL_DAYS} días del Plan PRO.\n\n• Durante ${TRIAL_DAYS} días: acceso completo a funciones PRO sin cargo.\n• Después de la prueba: se cobra ${plan.priceString} automáticamente cada mes.\n• Si cancelas antes de que termine la prueba, no se te cobrará nada.\n• Al cancelar, tu cuenta pasará al Plan Gratis.\n\nSe te pedirá un método de pago para confirmar.`;
          }
          
          if (plan.id === 'free') {
            return 'Tu cuenta será una cuenta con el Plan Gratis y funciones básicas.\n\nPodrás cambiar de plan en cualquier momento desde tu perfil.';
          }
          
          return `Vas a suscribirte al Plan ${plan.name} por ${plan.priceString}.\n\n• La suscripción se renueva automáticamente cada mes.\n• Si cancelas, al terminar el período pagado tu cuenta pasará al Plan Gratis.\n\n${isApple ? 'Puedes cancelar desde Ajustes > Apple ID > Suscripciones.' : 'Puedes cancelar desde tu perfil.'}`;
        })()}
        buttons={[
          {
            text: 'Cancelar',
            onPress: () => setShowConfirmPlan(false),
            style: 'cancel',
          },
          {
            text: isTrialMode 
              ? `Iniciar ${TRIAL_DAYS} días gratis`
              : selectedPlan === 'free'
                ? 'Continuar con Plan Gratis'
                : 'Confirmar suscripción',
            onPress: async () => {
              setShowConfirmPlan(false);
              await performContinue();
            },
            style: 'primary',
          },
        ]}
        onClose={() => setShowConfirmPlan(false)}
      />
      
      {/* Trial Info Alert */}
      <CustomAlert
        visible={showTrialInfo}
        title={`Prueba gratuita de ${TRIAL_DAYS} días`}
        message={`¿Cómo funciona la prueba gratuita?\n\n1. ${isApple ? 'Confirma con tu Apple ID' : 'Introduce tu método de pago (tarjeta)'}\n2. Disfruta de todas las funciones PRO durante ${TRIAL_DAYS} días sin cargo\n3. Si te gusta, no hagas nada - la suscripción PRO se activa automáticamente a ${SUBSCRIPTION_PLANS.find(p => p.id === 'pro')?.priceString || '9,99€/mes'}\n4. Si no te convence, cancela antes de que termine la prueba y no se te cobrará nada\n\nAl cancelar (antes o después de la prueba), tu cuenta pasará al Plan Gratis con funciones básicas.\n\nPuedes cancelar desde ${isApple ? 'Ajustes > Apple ID > Suscripciones' : 'Perfil > Gestionar suscripción'}.\n\nSolo puedes usar una prueba gratuita por dispositivo y cuenta.`}
        buttons={[
          {
            text: 'Entendido',
            onPress: () => setShowTrialInfo(false),
            style: 'primary',
          },
        ]}
        onClose={() => setShowTrialInfo(false)}
      />
      
      <CustomAlert
        visible={showErrorAlert}
        title="Error"
        message={errorMessage}
        type="error"
        buttons={[
          {
            text: 'Entendido',
            onPress: () => setShowErrorAlert(false),
            style: 'primary',
          },
        ]}
        onClose={() => setShowErrorAlert(false)}
      />

      {/* Alerta para usuarios PRO */}
      <CustomAlert
        visible={showProAlert}
        icon={<MaterialCommunityIcons name="crown" size={48} color="#f59e0b" />}
        iconBackgroundColor="#f59e0b15"
        title="¡Ya tienes VBStats Pro!"
        message="Actualmente disfrutas de todas las funciones del plan PRO. No necesitas realizar ningún pago adicional."
        buttons={[
          {
            text: 'Volver',
            onPress: () => {
              setShowProAlert(false);
              onBack();
            },
            style: 'primary',
          },
        ]}
        onClose={() => {
          setShowProAlert(false);
          onBack();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: SAFE_AREA_TOP,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    padding: 6,
  },
  logo: {
    width: 40,
    height: 40,
  },
  headerRight: {
    width: 40,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSizes.xxxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
    gap: Spacing.xs,
  },
  viewDetailsText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  plansContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  planCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    ...Shadows.md,
  },
  planCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  planCardPro: {
    borderColor: Colors.accent,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    right: Spacing.md,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recommendedText: {
    color: '#fff',
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  planHeader: {
    marginBottom: Spacing.md,
  },
  planName: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  planNameSelected: {
    color: Colors.primary,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: Colors.text,
  },
  priceAmountSelected: {
    color: Colors.primary,
  },
  pricePeriod: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  pricePeriodSelected: {
    color: Colors.primary,
  },
  featuresContainer: {
    gap: Spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  featureText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    flex: 1,
  },
  featureTextSelected: {
    color: Colors.text,
  },
  limitationText: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    flex: 1,
    textDecorationLine: 'line-through',
  },
  selectedIndicator: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
  },
  paymentSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  paymentTitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  paymentMethods: {
    flexDirection: 'row',
    gap: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  paymentMethod: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  paymentMethodText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  stripeNote: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  continueButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Shadows.md,
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  termsText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  termsContainer: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  termsLink: {
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  paymentPendingContainer: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  paymentPendingText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  verifyButton: {
    backgroundColor: '#22c55e',
  },
  retryPaymentButton: {
    paddingVertical: Spacing.sm,
  },
  retryPaymentText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  // Trial styles
  trialSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 2,
    borderColor: '#22c55e',
    ...Shadows.sm,
  },
  trialToggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  trialToggleContent: {
    flex: 1,
  },
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
    marginBottom: Spacing.xs,
    gap: 4,
  },
  trialBadgeText: {
    color: '#fff',
    fontSize: FontSizes.xs,
    fontWeight: '700',
  },
  trialToggleText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  trialToggleSubtext: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  trialInfoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    gap: 4,
  },
  trialInfoButtonText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
  },
  trialNotAvailable: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  trialNotAvailableText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  restorePurchasesButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restorePurchasesText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  // Free Trial Banner styles (prominent at top)
  freeTrialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    borderWidth: 2,
    borderColor: '#22c55e',
    ...Shadows.md,
  },
  freeTrialBannerSelected: {
    backgroundColor: '#22c55e' + '15',
    borderColor: '#22c55e',
  },
  freeTrialBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  freeTrialBannerContent: {
    flex: 1,
  },
  freeTrialBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 2,
  },
  freeTrialBannerTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
  freeTrialBannerSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  // Trial card styles (new design - separate card, no toggle)
  trialCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: '#22c55e',
    position: 'relative',
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  trialCardSelected: {
    backgroundColor: '#22c55e' + '10',
    borderWidth: 3,
  },
  trialCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
    gap: 4,
  },
  trialCardBadgeText: {
    color: '#fff',
    fontSize: FontSizes.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  trialCardHeader: {
    marginBottom: Spacing.md,
  },
  trialCardTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  trialCardTitleSelected: {
    color: '#16a34a',
  },
  trialCardSubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  trialCardFeatures: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cancellationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E1',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  cancellationInfoText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: '#5D4037',
    lineHeight: 20,
  },
});
