/**
 * Pantalla para resetear la contraseña con el código recibido
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
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';
import { usersService } from '../services/usersService';

const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;
const ANDROID_NAV_BAR_HEIGHT = 48;

interface ResetPasswordScreenProps {
  email: string;
  onBack: () => void;
  onSuccess: () => void;
}

type Step = 'verify' | 'reset';

export default function ResetPasswordScreen({ email, onBack, onSuccess }: ResetPasswordScreenProps) {
  const [step, setStep] = useState<Step>('verify');
  const [code, setCode] = useState(['', '', '', '', '', '', '', '']);
  const [fullToken, setFullToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

  // Auto-focus primer input al montar
  useEffect(() => {
    if (inputRefs.current[0]) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, []);

  const handleCodeChange = (value: string, index: number) => {
    // Solo permitir letras y números
    const cleanValue = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    if (cleanValue.length <= 1) {
      const newCode = [...code];
      newCode[index] = cleanValue;
      setCode(newCode);
      setMessage(null);
      
      // Mover al siguiente input
      if (cleanValue && index < 7) {
        inputRefs.current[index + 1]?.focus();
      }
    } else if (cleanValue.length > 1) {
      // Pegado de código completo
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

  const handleVerifyCode = async () => {
    const codeString = code.join('');
    
    if (codeString.length !== 8) {
      setMessage({ type: 'error', text: 'Por favor, ingresa el código completo de 8 caracteres' });
      shakeError();
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await usersService.verifyResetToken(codeString);
      
      if (result.valid && result.fullToken) {
        setFullToken(result.fullToken);
        setMessage({ type: 'success', text: '¡Código verificado! Ahora establece tu nueva contraseña.' });
        setTimeout(() => {
          setStep('reset');
          setMessage(null);
        }, 1500);
      }
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.message || 'Código inválido o expirado. Solicita uno nuevo.' 
      });
      shakeError();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'Por favor, completa ambos campos' });
      shakeError();
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres' });
      shakeError();
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Las contraseñas no coinciden' });
      shakeError();
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      await usersService.resetPassword(fullToken, newPassword);
      setMessage({ type: 'success', text: '¡Contraseña actualizada correctamente!' });
      
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.message || 'Error al restablecer la contraseña. Inténtalo de nuevo.' 
      });
      shakeError();
    } finally {
      setIsLoading(false);
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
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={onBack}
              disabled={isLoading}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.text} />
            </TouchableOpacity>
            
            {/* Indicador de pasos */}
            <View style={styles.stepsContainer}>
              <View style={[styles.stepDot, styles.stepDotActive]} />
              <View style={[styles.stepLine, step === 'reset' && styles.stepLineActive]} />
              <View style={[styles.stepDot, step === 'reset' && styles.stepDotActive]} />
            </View>
          </View>

          {/* Contenido según el paso */}
          {step === 'verify' ? (
            <Animated.View style={[styles.content, { transform: [{ translateX: shakeAnimation }] }]}>
              <View style={styles.iconContainer}>
                <View style={styles.iconCircle}>
                  <MaterialCommunityIcons name="email-check" size={48} color={Colors.primary} />
                </View>
                <Text style={styles.title}>Verificar Código</Text>
                <Text style={styles.subtitle}>
                  Ingresa el código de 8 caracteres que enviamos a{'\n'}
                  <Text style={styles.emailHighlight}>{maskedEmail}</Text>
                </Text>
              </View>

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

              {/* Inputs del código */}
              <View style={styles.codeContainer}>
                {code.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => { inputRefs.current[index] = ref; }}
                    style={[
                      styles.codeInput,
                      digit && styles.codeInputFilled
                    ]}
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

              {/* Botón verificar */}
              <TouchableOpacity
                style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                onPress={handleVerifyCode}
                activeOpacity={0.8}
                disabled={isLoading}
              >
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>Verificando...</Text>
                  </View>
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>Verificar Código</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Reenviar código */}
              <View style={styles.resendContainer}>
                <Text style={styles.resendText}>¿No recibiste el código? </Text>
                <TouchableOpacity onPress={onBack} disabled={isLoading}>
                  <Text style={styles.resendLink}>Solicitar nuevo</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          ) : (
            <Animated.View style={[styles.content, { transform: [{ translateX: shakeAnimation }] }]}>
              <View style={styles.iconContainer}>
                <View style={styles.iconCircle}>
                  <MaterialCommunityIcons name="lock-check" size={48} color={Colors.primary} />
                </View>
                <Text style={styles.title}>Nueva Contraseña</Text>
                <Text style={styles.subtitle}>
                  Crea una contraseña segura para tu cuenta
                </Text>
              </View>

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

              {/* Nueva contraseña */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Nueva Contraseña</Text>
                <View style={styles.inputWrapper}>
                  <MaterialCommunityIcons 
                    name="lock-outline" 
                    size={20} 
                    color={Colors.textTertiary} 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor={Colors.textTertiary}
                    value={newPassword}
                    onChangeText={(text) => {
                      setNewPassword(text);
                      setMessage(null);
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                  <TouchableOpacity 
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    disabled={isLoading}
                  >
                    <MaterialCommunityIcons 
                      name={showPassword ? "eye-off" : "eye"} 
                      size={22} 
                      color={Colors.textTertiary} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirmar contraseña */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirmar Contraseña</Text>
                <View style={styles.inputWrapper}>
                  <MaterialCommunityIcons 
                    name="lock-check" 
                    size={20} 
                    color={Colors.textTertiary} 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Repite tu contraseña"
                    placeholderTextColor={Colors.textTertiary}
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      setMessage(null);
                    }}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                  <TouchableOpacity 
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}
                    disabled={isLoading}
                  >
                    <MaterialCommunityIcons 
                      name={showConfirmPassword ? "eye-off" : "eye"} 
                      size={22} 
                      color={Colors.textTertiary} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Indicadores de seguridad */}
              <View style={styles.securityChecks}>
                <View style={styles.securityCheck}>
                  <MaterialCommunityIcons 
                    name={newPassword.length >= 6 ? "check-circle" : "circle-outline"} 
                    size={16} 
                    color={newPassword.length >= 6 ? '#22c55e' : Colors.textTertiary} 
                  />
                  <Text style={[
                    styles.securityCheckText,
                    newPassword.length >= 6 && styles.securityCheckTextValid
                  ]}>
                    Al menos 6 caracteres
                  </Text>
                </View>
                <View style={styles.securityCheck}>
                  <MaterialCommunityIcons 
                    name={newPassword && newPassword === confirmPassword ? "check-circle" : "circle-outline"} 
                    size={16} 
                    color={newPassword && newPassword === confirmPassword ? '#22c55e' : Colors.textTertiary} 
                  />
                  <Text style={[
                    styles.securityCheckText,
                    newPassword && newPassword === confirmPassword && styles.securityCheckTextValid
                  ]}>
                    Las contraseñas coinciden
                  </Text>
                </View>
              </View>

              {/* Botón guardar */}
              <TouchableOpacity
                style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                onPress={handleResetPassword}
                activeOpacity={0.8}
                disabled={isLoading}
              >
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>Guardando...</Text>
                  </View>
                ) : (
                  <>
                    <MaterialCommunityIcons name="content-save" size={20} color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>Guardar Contraseña</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>
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
  stepsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 40, // Para compensar el botón back
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.xs,
  },
  stepLineActive: {
    backgroundColor: Colors.primary,
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
  securityChecks: {
    marginBottom: Spacing.lg,
  },
  securityCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  securityCheckText: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
  },
  securityCheckTextValid: {
    color: '#22c55e',
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
