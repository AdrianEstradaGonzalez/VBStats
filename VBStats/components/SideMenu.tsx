/**
 * Componente de menú lateral (Drawer)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';
import { 
  CloseIcon, 
  TeamIcon, 
  PlayIcon, 
  StatsIcon, 
  LogoutIcon,
  UserIcon,
  HomeIcon,
  SettingsIcon,
} from './VectorIcons';
import type { SubscriptionType } from '../services/subscriptionService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.8;

interface MenuItem {
  id: string;
  title: string;
  icon: React.ReactNode;
}

interface SideMenuProps {
  visible: boolean;
  onClose: () => void;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
  onUpgradePlan?: () => void;
  onCancelSubscription?: () => void;
  userName?: string;
  userEmail?: string;
  subscriptionType?: SubscriptionType;
  subscriptionCancelledPending?: boolean;
}

export default function SideMenu({
  visible,
  onClose,
  onNavigate,
  onLogout,
  onUpgradePlan,
  onCancelSubscription,
  userName = 'Usuario',
  userEmail = 'usuario@vbstats.com',
  subscriptionType = 'free',
  subscriptionCancelledPending = false,
}: SideMenuProps) {
  // Define menu items based on subscription type
  const getMenuItems = (): MenuItem[] => {
    const items: MenuItem[] = [];

    // Free account: home (mis partidos), scoreboard, and guide
    if (subscriptionType === 'free') {
      items.push(
        { id: 'home', title: 'Mis partidos', icon: <HomeIcon size={24} color={Colors.text} /> },
        { id: 'scoreboard', title: 'Marcador', icon: <MaterialCommunityIcons name="scoreboard" size={24} color={Colors.text} /> },
        { id: 'guide', title: 'Ayuda', icon: <MaterialCommunityIcons name="help-circle-outline" size={24} color={Colors.text} /> },
      );
      return items;
    }

    // Basic and Pro accounts
    items.push(
      { id: 'home', title: 'Inicio', icon: <HomeIcon size={24} color={Colors.text} /> },
      { id: 'teams', title: 'Mis Equipos', icon: <TeamIcon size={24} color={Colors.text} /> },
      { id: 'startMatch', title: 'Comenzar Partido', icon: <PlayIcon size={24} color={Colors.text} /> },
      { id: 'stats', title: 'Estadísticas', icon: <StatsIcon size={24} color={Colors.text} /> },
      { id: 'searchByCode', title: 'Mis partidos', icon: <MaterialCommunityIcons name="qrcode-scan" size={24} color={Colors.text} /> },
      { id: 'scoreboard', title: 'Marcador', icon: <MaterialCommunityIcons name="scoreboard" size={24} color={Colors.text} /> },
      { id: 'settings', title: 'Configuración', icon: <SettingsIcon size={24} color={Colors.text} /> },
      { id: 'guide', title: 'Ayuda', icon: <MaterialCommunityIcons name="help-circle-outline" size={24} color={Colors.text} /> },
    );

    return items;
  };

  const menuItems = getMenuItems();

  // Get subscription badge
  const getSubscriptionBadge = () => {
    switch (subscriptionType) {
      case 'pro':
        return { text: 'PRO', color: '#f59e0b' };
      case 'basic':
        return { text: 'BÁSICO', color: '#3b82f6' };
      default:
        return { text: 'GRATIS', color: Colors.textSecondary };
    }
  };

  const badge = getSubscriptionBadge();

  const handleNavigate = (screen: string) => {
    onClose();
    onNavigate(screen);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.overlayTouch} 
          activeOpacity={1} 
          onPress={onClose}
        />
        <Animated.View style={styles.drawer}>
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
          {/* Header del perfil */}
          <View style={styles.profileSection}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <CloseIcon size={20} color={Colors.text} />
            </TouchableOpacity>
            
            <View style={styles.profileImageContainer}>
              <View style={styles.profileImage}>
                <UserIcon size={40} color={Colors.primary} />
              </View>
            </View>
            
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.userEmail}>{userEmail}</Text>
            
            {/* Subscription Badge */}
            <View style={[styles.subscriptionBadge, { backgroundColor: badge.color + '20' }]}>
              <Text style={[styles.subscriptionBadgeText, { color: badge.color }]}>
                {badge.text}
              </Text>
            </View>
            
            <TouchableOpacity 
              style={styles.editProfileButton}
              onPress={() => handleNavigate('profile')}
            >
              <Text style={styles.editProfileText}>Ver perfil</Text>
            </TouchableOpacity>
          </View>

          {/* Divisor */}
          <View style={styles.divider} />

          {/* Menú principal */}
          <View style={styles.menuSection}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                onPress={() => handleNavigate(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.menuIconContainer}>
                  {item.icon}
                </View>
                <Text style={styles.menuItemText}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Spacer */}
          <View style={styles.spacer} />

          {/* Subscription Management Section - show if not pro OR if cancelled pending (to reactivate) */}
          {(subscriptionType !== 'pro' || subscriptionCancelledPending) && onUpgradePlan && (
            <View style={styles.subscriptionSection}>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={() => {
                  onClose();
                  onUpgradePlan();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.menuIconContainer}>
                  <MaterialCommunityIcons name={subscriptionCancelledPending ? "refresh" : "arrow-up-bold"} size={24} color="#f59e0b" />
                </View>
                <Text style={styles.upgradeText}>{subscriptionCancelledPending ? 'Reactivar/Cambiar Plan' : 'Mejorar Plan'}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#f59e0b" />
              </TouchableOpacity>
            </View>
          )}

          {/* Subscription pending cancellation notice */}
          {subscriptionType !== 'free' && subscriptionCancelledPending && (
            <View style={styles.cancelSection}>
              <View style={styles.divider} />
              <View style={styles.pendingCancelNotice}>
                <MaterialCommunityIcons name="clock-outline" size={20} color="#f59e0b" />
                <Text style={styles.pendingCancelText}>Suscripción cancelada (activa hasta fin de período)</Text>
              </View>
            </View>
          )}

          {/* Cerrar sesión */}
          <View style={styles.logoutSection}>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={onLogout}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconContainer}>
                <LogoutIcon size={24} color={Colors.error} />
              </View>
              <Text style={styles.logoutText}>Cerrar Sesión</Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flexDirection: 'row',
  },
  overlayTouch: {
    flex: 1,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: Colors.background,
    borderRightWidth: 2,
    borderRightColor: '#FFFFFF',
    ...Shadows.lg,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  profileSection: {
    padding: Spacing.lg,
    paddingTop: Spacing.xxl,
    backgroundColor: Colors.surface,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    padding: Spacing.sm,
    zIndex: 10,
  },
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  userName: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  userEmail: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  editProfileButton: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  editProfileText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  subscriptionBadge: {
    alignSelf: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  subscriptionBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  menuSection: {
    paddingVertical: Spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  menuIconContainer: {
    width: 40,
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: FontSizes.lg,
    color: Colors.text,
    fontWeight: '500',
    marginLeft: Spacing.md,
  },
  spacer: {
    flex: 1,
  },
  subscriptionSection: {
    paddingBottom: Spacing.sm,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
  },
  upgradeText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: '#f59e0b',
    fontWeight: '600',
    marginLeft: Spacing.md,
  },
  cancelSection: {
    paddingBottom: Spacing.sm,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  cancelText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginLeft: Spacing.md,
  },
  pendingCancelNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  pendingCancelText: {
    fontSize: FontSizes.sm,
    color: '#f59e0b',
    marginLeft: Spacing.sm,
    flex: 1,
  },
  logoutSection: {
    paddingBottom: Spacing.xl,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  logoutText: {
    fontSize: FontSizes.lg,
    color: Colors.error,
    fontWeight: '500',
    marginLeft: Spacing.md,
  },
});
