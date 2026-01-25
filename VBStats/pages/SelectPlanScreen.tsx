/**
 * Pantalla de selección de plan de suscripción
 * Diseño moderno y profesional con integración de pagos
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Platform,
  StatusBar,
  Image,
  Linking,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';
import { CustomAlert } from '../components';
import { 
  SUBSCRIPTION_PLANS, 
  SubscriptionType, 
  SubscriptionPlan,
  subscriptionService 
} from '../services/subscriptionService';
import GuideScreen from './GuideScreen';

// Safe area paddings para Android
const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;

interface SelectPlanScreenProps {
  onPlanSelected: (planType: SubscriptionType) => void;
  onBack: () => void;
  currentPlan?: SubscriptionType;
  userId?: number | null;
}

export default function SelectPlanScreen({ 
  onPlanSelected, 
  onBack,
  currentPlan,
  userId 
}: SelectPlanScreenProps) {
  // Default selected plan should be the next upgrade
  const defaultSelectedPlan = currentPlan === 'basic' ? 'pro' : 'basic';
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionType>(defaultSelectedPlan);
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentPending, setPaymentPending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showConfirmPlan, setShowConfirmPlan] = useState(false);

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    if (plan.id === 'free') {
      setSelectedPlan('free');
      setShowConfirmPlan(true);
      return;
    }

    setSelectedPlan(plan.id);
  };

  const performContinue = async () => {
    if (selectedPlan === 'free') {
      onPlanSelected('free');
      return;
    }

    if (!userId) {
      setErrorMessage('Por favor, completa el registro primero');
      setShowErrorAlert(true);
      return;
    }

    setIsLoading(true);
    try {
      const result = await subscriptionService.createCheckoutSession(userId, selectedPlan);
      
      if (result.error) {
        setErrorMessage(result.error);
        setShowErrorAlert(true);
        return;
      }

      if (result.sessionUrl) {
        // Open Stripe checkout in browser
        try {
          await Linking.openURL(result.sessionUrl);
          // Show the "I already paid" button
          setPaymentPending(true);
        } catch (linkError) {
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

  const handleContinue = () => {
    // Show confirmation before proceeding to payment/selection
    setShowConfirmPlan(true);
  };

  const handleVerifyPayment = async () => {
    if (!userId) return;

    setIsVerifying(true);
    try {
      const subscription = await subscriptionService.getSubscription(userId);
      
      if (subscription && subscription.type !== 'free') {
        // Payment was successful
        onPlanSelected(subscription.type);
      } else {
        setErrorMessage('No hemos detectado el pago todavía. Si acabas de pagar, espera unos segundos e inténtalo de nuevo.');
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
    const isSelected = selectedPlan === plan.id;
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
                Gratis
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
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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

        {/* Payment Methods */}
        {selectedPlan !== 'free' && (
          <View style={styles.paymentSection}>
            <Text style={styles.paymentTitle}>Métodos de pago seguros</Text>
            <View style={styles.paymentMethods}>
              <View style={styles.paymentMethod}>
                <MaterialCommunityIcons name="credit-card" size={24} color={Colors.textSecondary} />
                <Text style={styles.paymentMethodText}>Tarjeta</Text>
              </View>
              {Platform.OS === 'android' && (
                <View style={styles.paymentMethod}>
                  <MaterialCommunityIcons name="google" size={24} color={Colors.textSecondary} />
                  <Text style={styles.paymentMethodText}>Google Pay</Text>
                </View>
              )}
              {Platform.OS === 'ios' && (
                <View style={styles.paymentMethod}>
                  <MaterialCommunityIcons name="apple" size={24} color={Colors.textSecondary} />
                  <Text style={styles.paymentMethodText}>Apple Pay</Text>
                </View>
              )}
            </View>
            <Text style={styles.stripeNote}>
              Pagos procesados de forma segura por Stripe
            </Text>
          </View>
        )}

        {/* Continue Button */}
        {!paymentPending ? (
          <TouchableOpacity
            style={[styles.continueButton, isLoading && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.continueButtonText}>
                  {selectedPlan === 'free' ? 'Continuar gratis' : 'Continuar al pago'}
                </Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.paymentPendingContainer}>
            <Text style={styles.paymentPendingText}>
              ¿Ya has completado el pago?
            </Text>
            <TouchableOpacity
              style={[styles.continueButton, styles.verifyButton, isVerifying && styles.continueButtonDisabled]}
              onPress={handleVerifyPayment}
              disabled={isVerifying}
            >
              {isVerifying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
                  <Text style={styles.continueButtonText}>Ya he pagado</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.retryPaymentButton}
              onPress={() => setPaymentPending(false)}
            >
              <Text style={styles.retryPaymentText}>Volver a intentar el pago</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Terms */}
        <Text style={styles.termsText}>
          Al continuar, aceptas nuestros Términos de Servicio y Política de Privacidad.
          {selectedPlan !== 'free' && ' La suscripción se renovará automáticamente cada mes.'}
        </Text>
      </ScrollView>

      {/* Error Alert */}
      <CustomAlert
        visible={showConfirmPlan}
        title="Confirmar selección"
        message={(() => {
          const plan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan);
          if (!plan) return '¿Confirmas seleccionar este plan?';
          return `Vas a seleccionar el plan ${plan.name} ${plan.price > 0 ? `(${plan.price.toFixed(2).replace('.', ',')}€/mes)` : '(Gratis)'}.`;
        })()}
        buttons={[
          {
            text: 'Cancelar',
            onPress: () => setShowConfirmPlan(false),
            style: 'cancel',
          },
          {
            text: 'Confirmar',
            onPress: async () => {
              setShowConfirmPlan(false);
              await performContinue();
            },
            style: 'primary',
          },
        ]}
        onClose={() => setShowConfirmPlan(false)}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR_HEIGHT : 0,
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
    marginTop: Spacing.lg,
    lineHeight: 18,
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
});
