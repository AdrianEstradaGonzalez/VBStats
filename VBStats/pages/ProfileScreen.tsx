/**
 * Pantalla de Perfil de Usuario
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';
import { MenuIcon, UserIcon } from '../components/VectorIcons';
import { CustomAlert, CustomAlertButton } from '../components';
import { usersService } from '../services/api';
import { subscriptionService, SubscriptionType, TrialInfo, TRIAL_DAYS } from '../services/subscriptionService';

// Safe area paddings para Android
const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;

interface ProfileScreenProps {
  onOpenMenu?: () => void;
  onBack?: () => void;
  userId: number | null;
  userName: string;
  userEmail: string;
  subscriptionType?: SubscriptionType;
  subscriptionExpiresAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  autoRenew?: boolean;
  activeTrial?: TrialInfo | null;
  onUserUpdate?: (name: string, email: string) => void;
  onSubscriptionCancelled?: () => void;
}

export default function ProfileScreen({
  onOpenMenu,
  onBack,
  userId,
  userName,
  userEmail,
  subscriptionType = 'free',
  subscriptionExpiresAt,
  cancelAtPeriodEnd = false,
  autoRenew = true,
  activeTrial,
  onUserUpdate,
  onSubscriptionCancelled,
}: ProfileScreenProps) {
  // Estados para el formulario de cambio de contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Estados para mostrar/ocultar contraseñas
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Estados para focus de inputs
  const [currentPasswordFocused, setCurrentPasswordFocused] = useState(false);
  const [newPasswordFocused, setNewPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  
  // Estados para carga y alertas
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Estados para cancelación de suscripción
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelSuccessAlert, setShowCancelSuccessAlert] = useState(false);

  const handleCancelSubscription = async () => {
    if (!userId) return;
    
    setIsCancelling(true);
    setShowCancelConfirm(false);
    
    try {
      const result = await subscriptionService.cancelSubscription(userId);
      
      if (result.success) {
        setShowCancelSuccessAlert(true);
        if (onSubscriptionCancelled) {
          onSubscriptionCancelled();
        }
      } else {
        setErrorMessage(result.error || 'Error al cancelar la suscripción');
        setShowErrorAlert(true);
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      setErrorMessage('Error al cancelar la suscripción');
      setShowErrorAlert(true);
    } finally {
      setIsCancelling(false);
    }
  };

  const getSubscriptionName = (type: SubscriptionType): string => {
    if (type === 'basic') return 'Básico';
    if (type === 'pro') return 'Pro';
    return 'Gratuita';
  };

  const validatePasswords = (): string | null => {
    if (!currentPassword.trim()) {
      return 'Ingresa tu contraseña actual';
    }
    if (!newPassword.trim()) {
      return 'Ingresa la nueva contraseña';
    }
    if (newPassword.length < 6) {
      return 'La nueva contraseña debe tener al menos 6 caracteres';
    }
    if (newPassword !== confirmPassword) {
      return 'Las contraseñas no coinciden';
    }
    if (currentPassword === newPassword) {
      return 'La nueva contraseña debe ser diferente a la actual';
    }
    return null;
  };

  const handleChangePassword = async () => {
    const validationError = validatePasswords();
    if (validationError) {
      setErrorMessage(validationError);
      setShowErrorAlert(true);
      return;
    }

    if (!userId) {
      setErrorMessage('Error: Usuario no identificado');
      setShowErrorAlert(true);
      return;
    }

    setIsLoading(true);
    try {
      await usersService.changePassword(userId, currentPassword, newPassword);
      
      // Limpiar formulario
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setShowSuccessAlert(true);
    } catch (error: any) {
      console.error('Error changing password:', error);
      if (error.message?.includes('incorrect') || error.message?.includes('Invalid')) {
        setErrorMessage('La contraseña actual es incorrecta');
      } else {
        setErrorMessage(error.message || 'Error al cambiar la contraseña');
      }
      setShowErrorAlert(true);
    } finally {
      setIsLoading(false);
    }
  };

  const renderPasswordInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    showPassword: boolean,
    onToggleShow: () => void,
    isFocused: boolean,
    onFocus: () => void,
    onBlur: () => void,
    placeholder: string
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrapper, isFocused && styles.inputWrapperFocused]}>
        <MaterialCommunityIcons
          name="lock-outline"
          size={20}
          color={isFocused ? Colors.primary : Colors.textTertiary}
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          editable={!isLoading}
        />
        <TouchableOpacity
          onPress={onToggleShow}
          style={styles.eyeButton}
          disabled={isLoading}
        >
          <MaterialCommunityIcons
            name={showPassword ? 'eye-off' : 'eye'}
            size={22}
            color={Colors.textTertiary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={onOpenMenu}>
          <MenuIcon size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Sección de información del usuario */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <UserIcon size={50} color={Colors.primary} />
            </View>
          </View>
          
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.userEmail}>{userEmail}</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Sección de suscripción */}
        <View style={styles.subscriptionSection}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="credit-card-outline" size={24} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Mi Suscripción</Text>
          </View>
          
          <View style={styles.subscriptionInfo}>
            <Text style={styles.subscriptionLabel}>Plan actual:</Text>
            <View style={styles.subscriptionBadge}>
              <Text style={styles.subscriptionBadgeText}>
                {getSubscriptionName(subscriptionType)}
              </Text>
            </View>
          </View>

          {/* Renewal status info */}
          {subscriptionType !== 'free' && subscriptionExpiresAt && (
            <View style={styles.renewalInfoContainer}>
              {cancelAtPeriodEnd || !autoRenew ? (
                <>
                  <View style={styles.renewalInfoHeader}>
                    <MaterialCommunityIcons name="calendar-clock" size={20} color="#f59e0b" />
                    <Text style={styles.renewalInfoTitleWarning}>Suscripción cancelada</Text>
                  </View>
                  <Text style={styles.renewalInfoText}>
                    Tu plan {getSubscriptionName(subscriptionType)} estará activo hasta el{' '}
                    <Text style={styles.renewalDateHighlight}>
                      {new Date(subscriptionExpiresAt).toLocaleDateString('es-ES', { 
                        day: 'numeric', month: 'long', year: 'numeric' 
                      })}
                    </Text>.
                    {'\n'}Después cambiarás automáticamente al plan Gratuito.
                  </Text>
                  <Text style={styles.renewalSubText}>
                    Tus datos se conservarán y podrás volver a suscribirte en cualquier momento.
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.renewalInfoHeader}>
                    <MaterialCommunityIcons name="autorenew" size={20} color="#22c55e" />
                    <Text style={styles.renewalInfoTitleActive}>Renovación automática activa</Text>
                  </View>
                  <Text style={styles.renewalInfoText}>
                    Tu suscripción se renovará automáticamente el{' '}
                    <Text style={styles.renewalDateHighlight}>
                      {new Date(subscriptionExpiresAt).toLocaleDateString('es-ES', { 
                        day: 'numeric', month: 'long', year: 'numeric' 
                      })}
                    </Text>.
                  </Text>
                </>
              )}
            </View>
          )}
          
          {/* Trial Info */}
          {activeTrial && activeTrial.daysRemaining > 0 && (
            <View style={styles.trialInfoContainer}>
              <View style={styles.trialInfoHeader}>
                <MaterialCommunityIcons name="gift" size={20} color="#22c55e" />
                <Text style={styles.trialInfoTitle}>Prueba gratuita activa</Text>
              </View>
              <Text style={styles.trialInfoText}>
                Te quedan <Text style={styles.trialDaysHighlight}>{activeTrial.daysRemaining} días</Text> de prueba gratis del plan {getSubscriptionName(activeTrial.planType as SubscriptionType)}.
              </Text>
              <Text style={styles.trialWarningText}>
                Recuerda: Al finalizar la prueba se cobrará automáticamente. Cancela antes si no deseas continuar.
              </Text>
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Sección de cambio de contraseña */}
        <View style={styles.passwordSection}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="key-variant" size={24} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Cambiar Contraseña</Text>
          </View>
          
          <Text style={styles.sectionDescription}>
            Por seguridad, te recomendamos usar una contraseña única de al menos 6 caracteres.
          </Text>

          {renderPasswordInput(
            'Contraseña Actual',
            currentPassword,
            setCurrentPassword,
            showCurrentPassword,
            () => setShowCurrentPassword(!showCurrentPassword),
            currentPasswordFocused,
            () => setCurrentPasswordFocused(true),
            () => setCurrentPasswordFocused(false),
            '••••••••'
          )}

          {renderPasswordInput(
            'Nueva Contraseña',
            newPassword,
            setNewPassword,
            showNewPassword,
            () => setShowNewPassword(!showNewPassword),
            newPasswordFocused,
            () => setNewPasswordFocused(true),
            () => setNewPasswordFocused(false),
            'Mínimo 6 caracteres'
          )}

          {renderPasswordInput(
            'Confirmar Nueva Contraseña',
            confirmPassword,
            setConfirmPassword,
            showConfirmPassword,
            () => setShowConfirmPassword(!showConfirmPassword),
            confirmPasswordFocused,
            () => setConfirmPasswordFocused(true),
            () => setConfirmPasswordFocused(false),
            'Repite la nueva contraseña'
          )}

          <TouchableOpacity
            style={[styles.changePasswordButton, isLoading && styles.buttonDisabled]}
            onPress={handleChangePassword}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.changePasswordButtonText}>Cambiando...</Text>
              </View>
            ) : (
              <>
                <MaterialCommunityIcons name="lock-reset" size={20} color="#FFFFFF" />
                <Text style={styles.changePasswordButtonText}>Cambiar Contraseña</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Sección de cancelar suscripción - al final */}
        {subscriptionType !== 'free' && !(cancelAtPeriodEnd || !autoRenew) && (
          <>
            <View style={styles.divider} />
            <View style={styles.dangerZone}>
              <View style={styles.dangerZoneHeader}>
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color={Colors.textTertiary} />
                <Text style={styles.dangerZoneTitle}>Zona de gestión</Text>
              </View>
              <Text style={styles.dangerZoneDescription}>
                Si cancelas tu suscripción, mantendrás acceso a las funciones premium hasta el final del período de facturación actual. Después pasarás al plan Gratuito, pero todos tus datos se conservarán.
              </Text>
              <TouchableOpacity
                style={[styles.cancelSubscriptionButton, isCancelling && styles.buttonDisabled]}
                onPress={() => setShowCancelConfirm(true)}
                disabled={isCancelling}
                activeOpacity={0.7}
              >
                {isCancelling ? (
                  <ActivityIndicator size="small" color={Colors.textTertiary} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="cancel" size={18} color={Colors.textTertiary} />
                    <Text style={styles.cancelSubscriptionText}>Cancelar renovación automática</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Alerta de éxito */}
      <CustomAlert
        visible={showSuccessAlert}
        title="¡Contraseña Actualizada!"
        message="Tu contraseña ha sido cambiada exitosamente."
        buttons={[
          {
            text: 'Aceptar',
            onPress: () => setShowSuccessAlert(false),
            style: 'default',
          } as CustomAlertButton,
        ]}
        onClose={() => setShowSuccessAlert(false)}
        icon={<MaterialCommunityIcons name="check-circle" size={48} color="#22c55e" />}
      />

      {/* Alerta de error */}
      <CustomAlert
        visible={showErrorAlert}
        title="Error"
        message={errorMessage}
        buttons={[
          {
            text: 'Aceptar',
            onPress: () => setShowErrorAlert(false),
            style: 'default',
          } as CustomAlertButton,
        ]}
        onClose={() => setShowErrorAlert(false)}
        icon={<MaterialCommunityIcons name="alert-circle" size={48} color="#ef4444" />}
      />

      {/* Alerta de confirmación de cancelación */}
      <CustomAlert
        visible={showCancelConfirm}
        title="¿Cancelar Suscripción?"
        message={`Tu suscripción no se renovará y mantendrás acceso a las funciones del plan ${getSubscriptionName(subscriptionType)} hasta que finalice el período actual. Después cambiarás automáticamente al plan Gratuito. Tus datos (equipos, jugadores, partidos, estadísticas) se conservarán.`}
        buttons={[
          {
            text: 'No, mantener',
            onPress: () => setShowCancelConfirm(false),
            style: 'default',
          } as CustomAlertButton,
          {
            text: 'Sí, cancelar renovación',
            onPress: handleCancelSubscription,
            style: 'destructive',
          } as CustomAlertButton,
        ]}
        onClose={() => setShowCancelConfirm(false)}
        icon={<MaterialCommunityIcons name="alert" size={48} color="#f59e0b" />}
      />

      {/* Alerta de éxito de cancelación */}
      <CustomAlert
        visible={showCancelSuccessAlert}
        title="Renovación Cancelada"
        message="Tu suscripción no se renovará automáticamente. Podrás seguir usando las funciones premium hasta el final del período actual. Después, tu cuenta pasará al plan Gratuito pero conservarás todos tus datos."
        buttons={[
          {
            text: 'Entendido',
            onPress: () => setShowCancelSuccessAlert(false),
            style: 'default',
          } as CustomAlertButton,
        ]}
        onClose={() => setShowCancelSuccessAlert(false)}
        icon={<MaterialCommunityIcons name="check-circle" size={48} color="#22c55e" />}
      />
    </View>
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  avatarContainer: {
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.primary,
    ...Shadows.md,
  },
  userInfo: {
    alignItems: 'center',
  },
  userName: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  userEmail: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.lg,
  },
  passwordSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionDescription: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
  },
  inputWrapperFocused: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  eyeButton: {
    padding: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  changePasswordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.md,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  changePasswordButtonText: {
    color: '#FFFFFF',
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  subscriptionSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  subscriptionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  subscriptionLabel: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  subscriptionBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  subscriptionBadgeText: {
    color: '#FFFFFF',
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  trialInfoContainer: {
    backgroundColor: '#22c55e10',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#22c55e40',
  },
  trialInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  trialInfoTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#22c55e',
  },
  trialInfoText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  trialDaysHighlight: {
    fontWeight: '700',
    color: '#22c55e',
  },
  trialWarningText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  renewalInfoContainer: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  renewalInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  renewalInfoTitleWarning: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#f59e0b',
  },
  renewalInfoTitleActive: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#22c55e',
  },
  renewalInfoText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  renewalDateHighlight: {
    fontWeight: '700',
    color: Colors.primary,
  },
  renewalSubText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  dangerZone: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  dangerZoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  dangerZoneTitle: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  dangerZoneDescription: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  cancelSubscriptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
    gap: Spacing.xs,
  },
  cancelSubscriptionText: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
});
