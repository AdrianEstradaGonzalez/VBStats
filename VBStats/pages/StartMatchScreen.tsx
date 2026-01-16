/**
 * Pantalla para comenzar un partido
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';
import { 
  MenuIcon, 
  PlayIcon, 
  TeamIcon, 
  VolleyballIcon,
  ChevronRightIcon,
} from '../components/VectorIcons';
import { Team, Player } from '../services/api';

// Safe area paddings para Android
const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;
const ANDROID_NAV_BAR_HEIGHT = 48;

interface StartMatchScreenProps {
  teams?: Team[];
  onBack?: () => void;
  onOpenMenu?: () => void;
  onStartMatch?: (team: Team) => void;
}

export default function StartMatchScreen({ 
  teams = [], 
  onBack, 
  onOpenMenu,
  onStartMatch,
}: StartMatchScreenProps) {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  const handleStartMatch = () => {
    if (selectedTeam) {
      onStartMatch?.(selectedTeam);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={onOpenMenu}>
          <MenuIcon size={28} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <PlayIcon size={24} color={Colors.primary} />
          <Text style={styles.headerTitle}>Comenzar Partido</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {teams.length === 0 ? (
          <View style={styles.emptyState}>
            <TeamIcon size={80} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>Sin equipos</Text>
            <Text style={styles.emptyText}>
              Primero debes crear un equipo en "Mis Equipos" para poder comenzar un partido
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Selecciona un equipo</Text>
            <Text style={styles.sectionSubtitle}>
              Elige el equipo para el cual llevarás las estadísticas
            </Text>

            {teams.map((team) => (
              <TouchableOpacity
                key={team.id}
                style={[
                  styles.teamCard,
                  selectedTeam?.id === team.id && styles.teamCardSelected,
                ]}
                onPress={() => setSelectedTeam(team)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.teamIconContainer,
                  selectedTeam?.id === team.id && styles.teamIconSelected,
                ]}>
                  <TeamIcon 
                    size={32} 
                    color={selectedTeam?.id === team.id ? Colors.textOnPrimary : Colors.primary} 
                  />
                </View>
                <View style={styles.teamInfo}>
                  <Text style={styles.teamName}>{team.name}</Text>
                  <Text style={styles.teamPlayers}>
                    {team.playerCount || (team.players || []).length} jugador{(team.playerCount || (team.players || []).length) !== 1 ? 'es' : ''}
                  </Text>
                </View>
                <View style={[
                  styles.radioOuter,
                  selectedTeam?.id === team.id && styles.radioOuterSelected,
                ]}>
                  {selectedTeam?.id === team.id && (
                    <View style={styles.radioInner} />
                  )}
                </View>
              </TouchableOpacity>
            ))}

            {selectedTeam && selectedTeam.players && selectedTeam.players.length > 0 && (
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedTitle}>Jugadores del equipo</Text>
                <View style={styles.playersPreview}>
                  {selectedTeam.players.slice(0, 6).map((player: Player) => (
                    <View key={player.id} style={styles.playerChip}>
                      <Text style={styles.playerChipNumber}>{player.number || '#'}</Text>
                      <Text style={styles.playerChipName}>{player.name.split(' ')[0]}</Text>
                    </View>
                  ))}
                  {selectedTeam.players.length > 6 && (
                    <View style={styles.playerChip}>
                      <Text style={styles.playerChipMore}>
                        +{selectedTeam.players.length - 6}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {selectedTeam && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartMatch}
            activeOpacity={0.8}
          >
            <VolleyballIcon size={24} color={Colors.textOnPrimary} />
            <Text style={styles.startButtonText}>Iniciar Partido</Text>
          </TouchableOpacity>
        </View>
      )}
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
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  headerRight: {
    width: 44,
  },
  scrollContent: {
    padding: Spacing.lg,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.lg,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...Shadows.sm,
  },
  teamCardSelected: {
    borderColor: Colors.primary,
  },
  teamIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  teamIconSelected: {
    backgroundColor: Colors.primary,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  teamPlayers: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  selectedInfo: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  selectedTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  playersPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  playerChipNumber: {
    fontSize: FontSizes.sm,
    fontWeight: '800',
    color: Colors.primary,
    marginRight: Spacing.xs,
  },
  playerChipName: {
    fontSize: FontSizes.sm,
    color: Colors.text,
  },
  playerChipMore: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.md,
  },
  startButtonText: {
    color: Colors.textOnPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    marginLeft: Spacing.sm,
  },
});
