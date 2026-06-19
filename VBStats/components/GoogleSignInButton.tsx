/**
 * Botón reutilizable "Continuar con Google".
 * Incluye un separador opcional ("o") y el icono de Google.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes } from '../styles';

interface GoogleSignInButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  label: string;
  dividerText?: string;
}

export default function GoogleSignInButton({
  onPress,
  loading = false,
  disabled = false,
  label,
  dividerText,
}: GoogleSignInButtonProps) {
  return (
    <View>
      {dividerText ? (
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{dividerText}</Text>
          <View style={styles.dividerLine} />
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.button, (disabled || loading) && styles.buttonDisabled]}
        onPress={onPress}
        activeOpacity={0.8}
        disabled={disabled || loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <>
            <MaterialCommunityIcons name="google" size={22} color="#DB4437" style={styles.icon} />
            <Text style={styles.buttonText}>{label}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  button: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 52,
    gap: Spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  icon: {
    marginRight: Spacing.xs,
  },
  buttonText: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
});
