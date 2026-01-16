/**
 * Pantalla principal / Dashboard
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  Platform,
} from 'react-native';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';
import { MenuIcon, TeamIcon, PlayIcon, StatsIcon, VolleyballIcon } from '../components/VectorIcons';
import SideMenu from '../components/SideMenu';

// Safe area paddings para Android
const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;
const ANDROID_NAV_BAR_HEIGHT = 48;

interface HomeScreenProps {
  userName?: string;
  userEmail?: string;
  onNavigate?: (screen: string) => void;
  onLogout?: () => void;
}

export default function HomeScreen({ 
  userName = 'Usuario', 
  userEmail = 'usuario@vbstats.com',
  onNavigate,
  onLogout,
}: HomeScreenProps) {
  const [menuVisible, setMenuVisible] = useState(false);

  const mainOptions = [
    { 
      id: 'startMatch', 
      title: 'Comenzar Partido', 
      description: 'Inicia las estadísticas de un partido',
      icon: <PlayIcon size={48} color={Colors.primary} />,
    },
    { 
      id: 'teams', 
      title: 'Mis Equipos', 
      description: 'Gestiona tus equipos y jugadores',
      icon: <TeamIcon size={48} color={Colors.primary} />,
    },
    { 
      id: 'stats', 
      title: 'Estadísticas', 
      description: 'Revisa el historial de partidos',
      icon: <StatsIcon size={48} color={Colors.primary} />,
    },
  ];

  const handleNavigate = (screen: string) => {
    onNavigate?.(screen);
  };

  const handleLogout = () => {
    setMenuVisible(false);
    onLogout?.();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => setMenuVisible(true)}
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
      <View style={styles.content}>
        <Text style={styles.welcomeText}>¡Hola, {userName}!</Text>

        {/* Opciones principales */}
        <View style={styles.optionsContainer}>
          {mainOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.optionCard}
              onPress={() => handleNavigate(option.id)}
              activeOpacity={0.7}
            >
              <View style={styles.optionIconContainer}>
                {option.icon}
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Menú lateral */}
      <SideMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        userName={userName}
        userEmail={userEmail}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR_HEIGHT : 0,
    paddingBottom: Platform.OS === 'android' ? ANDROID_NAV_BAR_HEIGHT : 0,
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
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  welcomeText: {
    fontSize: FontSizes.xxxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitleText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  optionsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
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
  optionTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  optionDescription: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
});
