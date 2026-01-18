/**
 * Componente de alerta customizada reutilizable
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';

export interface CustomAlertButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive' | 'primary';
  icon?: React.ReactNode;
}

interface CustomAlertProps {
  visible: boolean;
  icon?: React.ReactNode;
  iconBackgroundColor?: string;
  title: string;
  message: string;
  warning?: string;
  buttons: CustomAlertButton[];
  onClose?: () => void;
  type?: 'default' | 'success' | 'error' | 'warning';
  /** Layout de botones: 'row' para horizontal, 'column' para vertical */
  buttonLayout?: 'row' | 'column';
}

export default function CustomAlert({
  visible,
  icon,
  iconBackgroundColor = Colors.error + '15',
  title,
  message,
  warning,
  buttons,
  onClose,
  type = 'default',
  buttonLayout = 'row',
}: CustomAlertProps) {
  const getButtonStyle = (style: CustomAlertButton['style'], isColumn: boolean) => {
    const baseStyle = (() => {
      switch (style) {
        case 'destructive':
          return styles.destructiveOutlined;
        case 'primary':
          return styles.primaryButton;
        case 'cancel':
          return styles.cancelButton;
        default:
          return styles.defaultButton;
      }
    })();
    return isColumn ? [baseStyle, styles.columnButton] : baseStyle;
  };

  const getButtonTextStyle = (style: CustomAlertButton['style']) => {
    switch (style) {
      case 'destructive':
        return styles.destructiveOutlinedText;
      case 'primary':
        return styles.primaryButtonText;
      case 'cancel':
        return styles.cancelButtonText;
      default:
        return styles.defaultButtonText;
    }
  };

  const isColumn = buttonLayout === 'column';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.confirmModalContent}>
          {/* Modern Header with Logo and App Name */}
          <View style={styles.header}>
            <View style={styles.logoWrapper}>
              <Image
                source={require('../assets/VBStats_logo_sinfondo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appName}>VBStats</Text>
          </View>
          
          {/* Content Area - White Background */}
          <View style={styles.contentArea}>
            {icon && (
              <View style={[styles.confirmIconContainer, { backgroundColor: iconBackgroundColor }]}>
                {icon}
              </View>
            )}
            
            <Text style={styles.confirmTitle}>{title}</Text>
            <Text style={styles.confirmMessage}>{message}</Text>
            
            {warning && (
              <Text style={styles.confirmWarning}>{warning}</Text>
            )}
            
            <View style={[styles.confirmButtons, isColumn && styles.confirmButtonsColumn]}>
              {buttons.map((button, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    getButtonStyle(button.style, isColumn),
                    !isColumn && buttons.length === 1 && { flex: 1 },
                  ]}
                  onPress={button.onPress}
                  activeOpacity={0.8}
                >
                  <View style={styles.buttonContent}>
                    {button.icon && <View style={styles.buttonIcon}>{button.icon}</View>}
                    <Text style={getButtonTextStyle(button.style)}>{button.text}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  confirmModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  logo: {
    width: 28,
    height: 28,
  },
  logoWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  appName: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textOnPrimary,
    letterSpacing: 0.5,
  },
  contentArea: {
    backgroundColor: '#ffffff',
    padding: Spacing.xl,
    alignItems: 'center',
  },
  confirmIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  confirmTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: FontSizes.md,
    color: '#4a4a4a',
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: 22,
  },
  confirmWarning: {
    fontSize: FontSizes.sm,
    color: '#d32f2f',
    backgroundColor: '#ffebee',
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 20,
    fontWeight: '600',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  confirmButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: Spacing.md,
  },
  confirmButtonsColumn: {
    flexDirection: 'column',
    gap: Spacing.sm,
  },
  columnButton: {
    flex: 0,
    width: '100%',
    paddingVertical: Spacing.md + 2,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: '#424242',
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  defaultButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  defaultButtonText: {
    color: Colors.textOnPrimary,
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  destructiveOutlined: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.error,
  },
  destructiveOutlinedText: {
    color: Colors.error,
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  deleteConfirmButton: {
    flex: 1,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Shadows.md,
  },
  deleteConfirmButtonText: {
    color: Colors.textOnPrimary,
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  primaryButtonText: {
    color: Colors.textOnPrimary,
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  buttonIcon: {
    marginRight: Spacing.xs,
  },
});
