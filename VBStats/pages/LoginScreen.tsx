/**
 * Pantalla de inicio de sesión
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
  Image,
  ActivityIndicator,
  Animated,
  StatusBar,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';

// Safe area paddings para Android
const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;
const ANDROID_NAV_BAR_HEIGHT = 48;

interface LoginScreenProps {
  onLogin: (email: string, password: string) => Promise<boolean>;
  onForgotPassword?: () => void;
  onSignUp?: () => void;
}

export default function LoginScreen({ onLogin, onForgotPassword, onSignUp }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Por favor, completa todos los campos');
      shakeError();
      return;
    }
    
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const success = await onLogin(email, password);
      if (!success) {
        setErrorMessage('Credenciales incorrectas. Verifica tu correo y contraseña.');
        shakeError();
      }
    } catch (error) {
      setErrorMessage('Error de conexión. Inténtalo de nuevo.');
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
          {/* Logo/Header Section */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/VBStats_logo_sinfondo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>VBStats</Text>
            <Text style={styles.subtitle}>Estadísticas de Voleibol</Text>
          </View>

          {/* Form Section */}
          <Animated.View style={[styles.formContainer, { transform: [{ translateX: shakeAnimation }] }]}>
            {/* Error Message */}
            {errorMessage && (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle" size={20} color="#FFFFFF" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Email Input */}
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
                    setErrorMessage(null);
                  }}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!isLoading}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Contraseña</Text>
              <View style={[styles.inputWrapper, passwordFocused && styles.inputWrapperFocused]}>
                <MaterialCommunityIcons 
                  name="lock-outline" 
                  size={20} 
                  color={passwordFocused ? Colors.primary : Colors.textTertiary} 
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textTertiary}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setErrorMessage(null);
                  }}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
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

            {/* Forgot Password */}
            {onForgotPassword && (
              <TouchableOpacity
                onPress={onForgotPassword}
                style={styles.forgotPasswordContainer}
                disabled={isLoading}
              >
                <Text style={styles.forgotPasswordText}>
                  ¿Olvidaste tu contraseña?
                </Text>
              </TouchableOpacity>
            )}

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.loginButtonText}>Iniciando sesión...</Text>
                </View>
              ) : (
                <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
              )}
            </TouchableOpacity>

            {/* Sign Up */}
            {onSignUp && (
              <TouchableOpacity
                style={[styles.signUpButton, isLoading && styles.signUpButtonDisabled]}
                onPress={onSignUp}
                activeOpacity={0.8}
                disabled={isLoading}
              >
                <Text style={styles.signUpButtonText}>Crear Cuenta</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
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
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 4,
    borderColor: Colors.primary,
    padding: 6,
    ...Shadows.lg,
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: FontSizes.xxxl,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  formContainer: {
    width: '100%',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  errorText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: FontSizes.sm,
    fontWeight: '600',
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
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.md,
  },
  forgotPasswordText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    minHeight: 52,
    ...Shadows.md,
  },
  loginButtonDisabled: {
    opacity: 0.8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loginButtonText: {
    color: Colors.textOnPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  signUpButton: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  signUpButtonText: {
    color: Colors.primary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  signUpButtonDisabled: {
    opacity: 0.6,
  },
});
