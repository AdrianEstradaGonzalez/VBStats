/**
 * Pantalla principal / Dashboard
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  Platform,
  ScrollView,
} from 'react-native';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows, SAFE_AREA_TOP } from '../styles';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { MenuIcon, TeamIcon, PlayIcon, StatsIcon, VolleyballIcon } from '../components/VectorIcons';
import CustomAlert from '../components/CustomAlert';
import type { SubscriptionType } from '../services/subscriptionService';

// Safe area paddings para Android

interface HomeScreenProps {
  userName?: string;
  userEmail?: string;
  onNavigate?: (screen: string) => void;
  onLogout?: () => void;
  onOpenMenu?: () => void;
  subscriptionType?: SubscriptionType;
  onUpgradeToPro?: () => void;
}

export default function HomeScreen({
  userName = 'Usuario',
  userEmail = 'usuario@vbstats.com',
  onNavigate,
  onLogout,
  onOpenMenu,
  subscriptionType = 'free',
  onUpgradeToPro,
}: HomeScreenProps) {
  const { t } = useTranslation();
  const [showProAlert, setShowProAlert] = useState(false);
  const isProSubscription = subscriptionType === 'pro';

  const mainOptions = [
    {
      id: 'startMatch',
      title: t('home.startMatch'),
      description: t('home.startMatchDesc'),
      icon: <PlayIcon size={48} color={Colors.primary} />,
      proOnly: false,
    },
    {
      id: 'teams',
      title: t('home.myTeams'),
      description: t('home.myTeamsDesc'),
      icon: <TeamIcon size={48} color={Colors.primary} />,
      proOnly: false,
    },
    {
      id: 'stats',
      title: t('home.statistics'),
      description: t('home.statisticsDesc'),
      icon: <StatsIcon size={48} color={Colors.primary} />,
      proOnly: false,
    },
    {
      // Was buried inside Statistics; promoted to a first-class entry so it is
      // discoverable, and marked as a Pro feature when the plan doesn't include it.
      id: 'tracking',
      title: t('stats.teamTracking'),
      description: t('home.trackingDesc'),
      icon: (
        <MaterialCommunityIcons
          name="chart-timeline-variant"
          size={48}
          color={isProSubscription ? Colors.primary : Colors.textTertiary}
        />
      ),
      proOnly: true,
    },
    {
      id: 'searchByCode',
      title: t('home.myMatches'),
      description: t('home.myMatchesDesc'),
      icon: <MaterialCommunityIcons name="qrcode-scan" size={48} color={Colors.primary} />,
      proOnly: false,
    },
  ];

  const handleNavigate = (screen: string) => {
    onNavigate?.(screen);
  };

  const handleOptionPress = (option: { id: string; proOnly: boolean }) => {
    if (option.proOnly && !isProSubscription) {
      setShowProAlert(true);
      return;
    }
    handleNavigate(option.id);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={onOpenMenu}
          activeOpacity={0.7}
        >
          <MenuIcon size={28} color={Colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Image 
            source={require('../assets/logo_sinfondo.png')} 
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>VBStats</Text>
        </View>
        
        <View style={styles.headerRight} />
      </View>

      {/* Contenido principal */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Text style={styles.welcomeText}>{t('home.greeting', { name: userName })}</Text>

        {/* Demo period notice */}
        {new Date() < new Date('2026-10-01T00:00:00') && (
          <View style={styles.demoBanner}>
            <MaterialCommunityIcons name="information" size={22} color="#FFA726" />
            <View style={styles.demoBannerTextContainer}>
              <Text style={styles.demoBannerTitle}>{t('home.trialPeriod')}</Text>
              <Text style={styles.demoBannerText}>
                {t('home.trialDescription')}
              </Text>
            </View>
          </View>
        )}

        {/* Opciones principales */}
        <View style={styles.optionsContainer}>
          {mainOptions.map((option) => {
            const locked = option.proOnly && !isProSubscription;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.optionCard, locked && styles.optionCardLocked]}
                onPress={() => handleOptionPress(option)}
                activeOpacity={0.7}
              >
                <View style={styles.optionIconContainer}>
                  {option.icon}
                </View>
                <View style={styles.optionContent}>
                  <View style={styles.optionTitleRow}>
                    <Text style={[styles.optionTitle, locked && styles.optionTitleLocked]}>
                      {option.title}
                    </Text>
                    {locked && (
                      <View style={styles.proBadge}>
                        <MaterialCommunityIcons name="crown" size={12} color="#f59e0b" />
                        <Text style={styles.proBadgeText}>PRO</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.optionDescription, locked && styles.optionTitleLocked]}>
                    {option.description}
                  </Text>
                </View>
                {locked && (
                  <MaterialCommunityIcons name="lock" size={20} color={Colors.textTertiary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Pro feature gate — same wording as the alert this entry replaced in Stats */}
      <CustomAlert
        visible={showProAlert}
        icon={<MaterialCommunityIcons name="crown" size={48} color="#f59e0b" />}
        iconBackgroundColor="#f59e0b15"
        title={t('home.trackingProTitle')}
        message={t('home.trackingProMessage')}
        warning={t('home.trackingProWarning')}
        buttonLayout="column"
        buttons={[
          {
            text: t('home.trackingProCta'),
            icon: <MaterialCommunityIcons name="crown" size={18} color="#fff" />,
            onPress: () => {
              setShowProAlert(false);
              onUpgradeToPro?.();
            },
            style: 'primary',
          },
          {
            text: t('common.cancel'),
            onPress: () => setShowProAlert(false),
            style: 'cancel',
          },
        ]}
        onClose={() => setShowProAlert(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: SAFE_AREA_TOP,
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
  menuButton: {
    padding: Spacing.sm,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  headerRight: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  welcomeText: {
    fontSize: FontSizes.xxxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.lg,
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
    width: 70,
    height: 70,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  optionContent: {
    flex: 1,
  },
  optionCardLocked: {
    opacity: 0.6,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  optionTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    // Spacing below comes from optionTitleRow now, so the title itself adds none.
  },
  optionTitleLocked: {
    color: Colors.textTertiary,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f59e0b20',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proBadgeText: {
    fontSize: FontSizes.xs,
    color: '#f59e0b',
    fontWeight: '700',
  },
  optionDescription: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  demoBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFA72615',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#FFA72640',
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  demoBannerTextContainer: {
    flex: 1,
  },
  demoBannerTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: '#FFA726',
    marginBottom: 4,
  },
  demoBannerText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
