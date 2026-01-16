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
} from 'react-native';
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
  userName?: string;
  userEmail?: string;
}

export default function SideMenu({
  visible,
  onClose,
  onNavigate,
  onLogout,
  userName = 'Usuario',
  userEmail = 'usuario@vbstats.com',
}: SideMenuProps) {
  const menuItems: MenuItem[] = [
    { id: 'home', title: 'Inicio', icon: <HomeIcon size={24} color={Colors.text} /> },
    { id: 'teams', title: 'Mis Equipos', icon: <TeamIcon size={24} color={Colors.text} /> },
    { id: 'startMatch', title: 'Comenzar Partido', icon: <PlayIcon size={24} color={Colors.text} /> },
    { id: 'stats', title: 'Estadísticas', icon: <StatsIcon size={24} color={Colors.text} /> },
    { id: 'settings', title: 'Configuración', icon: <SettingsIcon size={24} color={Colors.text} /> },
  ];

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
    ...Shadows.lg,
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
