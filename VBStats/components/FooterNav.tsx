/**
 * Barra de navegación inferior (Footer)
 * Respeta safe areas en todos los dispositivos
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, FontSizes, Shadows } from '../styles';
import type { SubscriptionType } from '../services/subscriptionService';

const FOOTER_TAB_HEIGHT = 58;
// Bottom safe area: on Android use nav bar height, on iOS approximate notch-device safe area
const ANDROID_NAV_BAR_HEIGHT = 48;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// Heuristic for iOS devices with home indicator (iPhone X+): screen height > 800
const IOS_BOTTOM_INSET = Platform.OS === 'ios' && SCREEN_HEIGHT >= 812 ? 34 : 0;
const BOTTOM_SAFE_AREA = Platform.OS === 'android' ? ANDROID_NAV_BAR_HEIGHT : IOS_BOTTOM_INSET;

export const FOOTER_TOTAL_HEIGHT = FOOTER_TAB_HEIGHT + BOTTOM_SAFE_AREA;

interface FooterTab {
  id: string;
  label: string;
  icon: string;
}

interface FooterNavProps {
  currentScreen: string;
  subscriptionType: SubscriptionType;
  onNavigate: (screen: string) => void;
}

export default function FooterNav({ currentScreen, subscriptionType, onNavigate }: FooterNavProps) {
  const getTabs = (): FooterTab[] => {
    if (subscriptionType === 'free') {
      return [
        { id: 'home', label: 'Mis partidos', icon: 'home' },
        { id: 'scoreboard', label: 'Marcador', icon: 'scoreboard-outline' },
      ];
    }

    return [
      { id: 'home', label: 'Inicio', icon: 'home' },
      { id: 'teams', label: 'Equipos', icon: 'account-group' },
      { id: 'startMatch', label: 'Partido', icon: 'play-circle' },
      { id: 'stats', label: 'Estadísticas', icon: 'chart-bar' },
      { id: 'scoreboard', label: 'Marcador', icon: 'scoreboard-outline' },
    ];
  };

  const isActive = (tabId: string): boolean => {
    switch (tabId) {
      case 'home':
        return subscriptionType === 'free'
          ? ['home', 'searchByCode'].includes(currentScreen)
          : currentScreen === 'home';
      case 'startMatch':
        return ['startMatch', 'startMatchFlow'].includes(currentScreen);
      case 'stats':
        return currentScreen === 'stats';
      case 'teams':
        return currentScreen === 'teams';
      case 'scoreboard':
        return currentScreen === 'scoreboard';
      case 'searchByCode':
        return currentScreen === 'searchByCode';
      default:
        return currentScreen === tabId;
    }
  };

  const tabs = getTabs();

  return (
    <View style={styles.container}>
      <View style={styles.topBorder} />
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const active = isActive(tab.id);
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tab}
              onPress={() => onNavigate(tab.id)}
              activeOpacity={0.7}
            >
              {active && <View style={styles.activeIndicator} />}
              <View style={[styles.iconWrapper, active && styles.iconWrapperActive]}>
                <MaterialCommunityIcons
                  name={active ? tab.icon.replace('-outline', '') : tab.icon}
                  size={24}
                  color={active ? Colors.primary : Colors.textSecondary}
                />
              </View>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {/* Bottom safe area spacer */}
      <View style={styles.bottomSafeArea} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.backgroundLight,
    ...Shadows.lg,
    // Ensure shadow renders above content on iOS
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  topBorder: {
    height: 1,
    backgroundColor: Colors.border,
  },
  tabBar: {
    flexDirection: 'row',
    height: FOOTER_TAB_HEIGHT,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: -1,
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  iconWrapperActive: {
    // Subtle glow effect for active tab
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  bottomSafeArea: {
    height: BOTTOM_SAFE_AREA,
    backgroundColor: Colors.backgroundLight,
  },
});
