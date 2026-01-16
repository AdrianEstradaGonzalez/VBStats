/**
 * Estilos comunes y reutilizables
 */

import { StyleSheet } from 'react-native';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights, Shadows } from './theme';

export const commonStyles = StyleSheet.create({
  // Contenedores
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  contentContainer: {
    flex: 1,
    padding: Spacing.lg,
    backgroundColor: Colors.background,
  },
  
  // Tarjetas
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  cardLight: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  
  // Inputs
  input: {
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  inputFocused: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  inputError: {
    borderColor: Colors.error,
  },
  
  // Botones
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  buttonSecondary: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  buttonText: {
    color: Colors.textOnPrimary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  buttonTextSecondary: {
    color: Colors.primary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  buttonDisabled: {
    backgroundColor: Colors.border,
    opacity: 0.6,
  },
  
  // Textos
  title: {
    fontSize: FontSizes.xxxl,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  text: {
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  textSecondary: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  textSmall: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
  },
  textError: {
    fontSize: FontSizes.sm,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  textLink: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: FontWeights.medium,
  },
  
  // Layouts
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  column: {
    flexDirection: 'column',
  },
  
  // Separadores
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  
  // Espaciado
  mt_xs: { marginTop: Spacing.xs },
  mt_sm: { marginTop: Spacing.sm },
  mt_md: { marginTop: Spacing.md },
  mt_lg: { marginTop: Spacing.lg },
  mt_xl: { marginTop: Spacing.xl },
  
  mb_xs: { marginBottom: Spacing.xs },
  mb_sm: { marginBottom: Spacing.sm },
  mb_md: { marginBottom: Spacing.md },
  mb_lg: { marginBottom: Spacing.lg },
  mb_xl: { marginBottom: Spacing.xl },
  
  mx_xs: { marginHorizontal: Spacing.xs },
  mx_sm: { marginHorizontal: Spacing.sm },
  mx_md: { marginHorizontal: Spacing.md },
  mx_lg: { marginHorizontal: Spacing.lg },
  
  my_xs: { marginVertical: Spacing.xs },
  my_sm: { marginVertical: Spacing.sm },
  my_md: { marginVertical: Spacing.md },
  my_lg: { marginVertical: Spacing.lg },
  
  p_xs: { padding: Spacing.xs },
  p_sm: { padding: Spacing.sm },
  p_md: { padding: Spacing.md },
  p_lg: { padding: Spacing.lg },
  p_xl: { padding: Spacing.xl },
});

export default commonStyles;
