/**
 * Pantalla principal / Dashboard
 */

import React from 'react';
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
import { MenuIcon, TeamIcon, PlayIcon, StatsIcon, VolleyballIcon } from '../components/VectorIcons';

// Safe area paddings para Android
const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;

interface HomeScreenProps {
  userName?: string;
  userEmail?: string;
  onNavigate?: (screen: string) => void;
  onLogout?: () => void;
  onOpenMenu?: () => void;
}

export default function HomeScreen({ 
  userName = 'Usuario', 
  userEmail = 'usuario@vbstats.com',
  onNavigate,
  onLogout,
  onOpenMenu,
}: HomeScreenProps) {

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
    {
      id: 'searchByCode',
      title: 'Mis partidos',
      description: 'Consulta los partidos guardados y busca por código',
      icon: <MaterialCommunityIcons name="qrcode-scan" size={48} color={Colors.primary} />,
    },
  ];

  const handleNavigate = (screen: string) => {
    onNavigate?.(screen);
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
        <Text style={styles.welcomeText}>{"¡Hola, "}{userName}{"!"}</Text>

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
      </ScrollView>
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
