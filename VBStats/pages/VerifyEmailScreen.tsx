/**
 * Pantalla de verificación de correo para el registro.
 * El usuario introduce el código de 8 caracteres enviado a su correo;
 * al verificarlo, la cuenta se crea en el backend.
 */

import React, { useState, useRef, useEffect } from 'react';
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
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows, SAFE_AREA_TOP } from '../styles';
import { usersService } from '../services/usersService';
import { User } from '../services/types';

const ANDROID_NAV_BAR_HEIGHT = 48;

interface VerifyEmailScreenProps {
  email: string;
  onBack: () => void;
  onVerified: (user: User) => void;
  onResend: () => Promise<void>;
}

export default function VerifyEmailScreen({ email, onBack, onVerified, onResend }: VerifyEmailScreenProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState(['', '', '', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [shakeAnimation] = useState(new Animated.Value(0));

  const inputRefs = useRef<(TextInput | null)[]>([]);

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    if (inputRefs.current[0]) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, []);

  const handleCodeChange = (value: string, index: number) => {
    const cleanValue = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    if (cleanValue.length <= 1) {
      const newCode = [...code];
      newCode[index] = cleanValue;
      setCode(newCode);
      setMessage(null);

      if (cleanValue && index < 7) {
        inputRefs.current[index + 1]?.focus();
      }
    } else if (cleanValue.length > 1) {
      const chars = cleanValue.slice(0, 8).split('');
      const newCode = [...code];
      chars.forEach((char, i) => {
        if (i < 8) newCode[i] = char;
      });
      setCode(newCode);
      inputRefs.current[Math.min(chars.length, 7)]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const codeString = code.join('');

    if (codeString.length !== 8) {
      setMessage({ type: 'error', text: t('verifyEmail.errors.codeRequired') });
      shakeError();
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const user = await usersService.verifyRegisterCode(email, codeString);
      setMessage({ type: 'success', text: t('verifyEmail.success') });
      setTimeout(() => onVerified(user), 800);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || t('verifyEmail.errors.codeInvalid') });
      shakeError();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setMessage(null);
    try {
      await onResend();
      setCode(['', '', '', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setMessage({ type: 'success', text: t('verifyEmail.resent') });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || t('verifyEmail.errors.resendError') });
      shakeError();
    } finally {
      setIsResending(false);
    }
  };

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

  return (
    <View style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={onBack} disabled={isLoading}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <Animated.View style={[styles.content, { transform: [{ translateX: shakeAnimation }] }]}>
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="email-check" size={48} color={Colors.primary} />
              </View>
              <Text style={styles.title}>{t('verifyEmail.title')}</Text>
              <Text style={styles.subtitle}>
                {t('verifyEmail.description')}{'\n'}
                <Text style={styles.emailHighlight}>{maskedEmail}</Text>
              </Text>
            </View>

            {message && (
              <View style={[
                styles.messageContainer,
                message.type === 'success' ? styles.successContainer : styles.errorContainer,
              ]}>
                <MaterialCommunityIcons
                  name={message.type === 'success' ? 'check-circle' : 'alert-circle'}
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.messageText}>{message.text}</Text>
              </View>
            )}

            <View style={styles.codeContainer}>
              {code.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { inputRefs.current[index] = ref; }}
                  style={[styles.codeInput, digit && styles.codeInputFilled]}
                  value={digit}
                  onChangeText={(value) => handleCodeChange(value, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="default"
                  autoCapitalize="characters"
                  maxLength={8}
                  editable={!isLoading}
                  selectTextOnFocus
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleVerify}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>{t('verifyEmail.verifying')}</Text>
                </View>
              ) : (
                <>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>{t('verifyEmail.verifyButton')}</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>{t('verifyEmail.didntReceive')} </Text>
              <TouchableOpacity onPress={handleResend} disabled={isLoading || isResending}>
                <Text style={styles.resendLink}>
                  {isResending ? t('verifyEmail.resending') : t('verifyEmail.resend')}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: SAFE_AREA_TOP,
    paddingBottom: Platform.OS === 'android' ? ANDROID_NAV_BAR_HEIGHT : 0,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  content: {
    flex: 1,
    paddingTop: Spacing.lg,
  },
  iconContainer: {
    alignItems: 'center',
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
  },
  emailHighlight: {
    color: Colors.primary,
    fontWeight: '600',
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
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  codeInput: {
    width: 38,
    height: 48,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    textAlign: 'center',
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    backgroundColor: Colors.backgroundLight,
  },
  codeInputFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight || '#EBF5FF',
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
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  resendLink: {
    color: Colors.primary,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
});
