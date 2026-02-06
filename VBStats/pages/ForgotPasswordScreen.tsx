/**
 * Pantalla para solicitar recuperación de contraseña
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  StatusBar,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';
import { usersService } from '../services/usersService';

const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;
const ANDROID_NAV_BAR_HEIGHT = 48;

interface ForgotPasswordScreenProps {
  onBack: () => void;
  onCodeSent: (email: string) => void;
}

export default function ForgotPasswordScreen({ onBack, onCodeSent }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [shakeAnimation] = useState(new Animated.Value(0));

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    
    if (!trimmedEmail) {
      setMessage({ type: 'error', text: 'Por favor, ingresa tu correo electrónico' });
      shakeError();
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setMessage({ type: 'error', text: 'Por favor, ingresa un correo electrónico válido' });
      shakeError();
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      await usersService.forgotPassword(trimmedEmail);
      setMessage({ 
        type: 'success', 
        text: 'Si el correo existe, recibirás un código de recuperación. Revisa tu bandeja de entrada.' 
      });
      
      // Después de 2 segundos, navegar a la pantalla de ingreso de código
      setTimeout(() => {
        onCodeSent(trimmedEmail);
      }, 2000);
      
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.message || 'Error al enviar el correo. Inténtalo de nuevo.' 
      });
      shakeError();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          {/* Header con botón de retroceso */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={onBack}
              disabled={isLoading}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Icono y título */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="lock-reset" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.title}>¿Olvidaste tu contraseña?</Text>
            <Text style={styles.subtitle}>
              No te preocupes. Ingresa tu correo electrónico y te enviaremos un código para recuperar tu cuenta.
            </Text>
          </View>

          {/* Formulario */}
          <Animated.View style={[styles.formContainer, { transform: [{ translateX: shakeAnimation }] }]}>
            {/* Mensaje de estado */}
            {message && (
              <View style={[
                styles.messageContainer, 
                message.type === 'success' ? styles.successContainer : styles.errorContainer
              ]}>
                <MaterialCommunityIcons 
                  name={message.type === 'success' ? "check-circle" : "alert-circle"} 
                  size={20} 
                  color="#FFFFFF" 
                />
                <Text style={styles.messageText}>{message.text}</Text>
              </View>
            )}

            {/* Input de email */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Correo Electrónico</Text>
              <View style={[styles.inputWrapper, emailFocused && styles.inputWrapperFocused]}>
                <MaterialCommunityIcons 
                  name="email-outline" 
                  size={20} 
                  color={emailFocused ? Colors.primary : Colors.textTertiary} 
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="correo@ejemplo.com"
                  placeholderTextColor={Colors.textTertiary}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setMessage(null);
                  }}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!isLoading}
                  autoFocus
                />
              </View>
            </View>

            {/* Botón de enviar */}
            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>Enviando...</Text>
                </View>
              ) : (
                <>
                  <MaterialCommunityIcons name="email-send" size={20} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>Enviar Código</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Enlace para volver */}
            <TouchableOpacity
              style={styles.backLinkContainer}
              onPress={onBack}
              disabled={isLoading}
            >
              <MaterialCommunityIcons name="arrow-left" size={18} color={Colors.primary} />
              <Text style={styles.backLinkText}>Volver al inicio de sesión</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Información de seguridad */}
          <View style={styles.securityInfo}>
            <MaterialCommunityIcons name="shield-check" size={16} color={Colors.textTertiary} />
            <Text style={styles.securityText}>
              Por seguridad, el código expirará en 1 hora
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR_HEIGHT : 0,
    paddingBottom: Platform.OS === 'android' ? ANDROID_NAV_BAR_HEIGHT : 0,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primaryLight || '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  formContainer: {
    width: '100%',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  successContainer: {
    backgroundColor: '#22c55e',
  },
  errorContainer: {
    backgroundColor: '#ef4444',
  },
  messageText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: Spacing.lg,
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
  submitButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    minHeight: 52,
    gap: Spacing.sm,
    ...Shadows.md,
  },
  submitButtonDisabled: {
    opacity: 0.8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  submitButtonText: {
    color: Colors.textOnPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  backLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  backLinkText: {
    color: Colors.primary,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: 'auto',
    paddingBottom: Spacing.xl,
  },
  securityText: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
  },
});
