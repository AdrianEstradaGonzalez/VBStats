/**
 * AdminPanelScreen - Main admin panel for superadmin user
 * Provides access to send notifications and manage users.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows, SAFE_AREA_TOP } from '../styles';
import { useTranslation } from 'react-i18next';

interface AdminPanelScreenProps {
  onOpenMenu: () => void;
  onNavigate: (screen: string) => void;
}

export default function AdminPanelScreen({ onOpenMenu, onNavigate }: AdminPanelScreenProps) {
  const { t } = useTranslation();

  const adminOptions = [
    {
      id: 'sendNotification',
      icon: 'bell-ring-outline',
      title: t('admin.sendNotification'),
      subtitle: t('admin.sendNotificationDesc'),
      color: '#f59e0b',
      screen: 'sendNotification',
    },
    {
      id: 'userManagement',
      icon: 'account-group-outline',
      title: t('admin.userManagement'),
      subtitle: t('admin.userManagementDesc'),
      color: '#3b82f6',
      screen: 'userManagement',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onOpenMenu} style={styles.menuButton}>
          <MaterialCommunityIcons name="menu" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.panelTitle')}</Text>
        <View style={styles.menuButton} />
      </View>

      <View style={styles.content}>
        {/* Admin badge */}
        <View style={styles.badgeContainer}>
          <MaterialCommunityIcons name="shield-crown-outline" size={48} color="#f59e0b" />
          <Text style={styles.badgeTitle}>Super Admin</Text>
          <Text style={styles.badgeSubtitle}>{t('admin.panelSubtitle')}</Text>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {adminOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.optionCard}
              onPress={() => onNavigate(option.screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconContainer, { backgroundColor: option.color + '20' }]}>
                <MaterialCommunityIcons name={option.icon} size={32} color={option.color} />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={Colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: SAFE_AREA_TOP + Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  badgeContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  badgeTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: '#f59e0b',
    marginTop: Spacing.sm,
  },
  badgeSubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  optionsContainer: {
    gap: Spacing.md,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  optionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextContainer: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  optionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  optionSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
