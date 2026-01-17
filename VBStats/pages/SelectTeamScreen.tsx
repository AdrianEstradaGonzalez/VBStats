/**
 * Pantalla de selección de equipo para comenzar un partido
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';
import { MenuIcon, TeamIcon, ChevronRightIcon } from '../components/VectorIcons';
import { teamsService, playersService } from '../services/api';

// Safe area paddings para Android
const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;
const ANDROID_NAV_BAR_HEIGHT = 48;

interface SelectTeamScreenProps {
  onBack?: () => void;
  onOpenMenu?: () => void;
  onTeamSelected?: (teamId: number, teamName: string) => void;
  userId?: number | null;
}

interface TeamWithPlayers {
  id: number;
  name: string;
  player_count?: number;
  playerCount?: number;
}

export default function SelectTeamScreen({ 
  onBack, 
  onOpenMenu, 
  onTeamSelected,
  userId 
}: SelectTeamScreenProps) {
  const [teams, setTeams] = useState<TeamWithPlayers[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      loadTeams();
    }
  }, [userId]);

  const loadTeams = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const [userTeams, allPlayers] = await Promise.all([
        teamsService.getAll(userId),
        playersService.getAll()
      ]);
      
      // Add player count to each team
      const teamsWithCounts = userTeams.map(team => ({
        ...team,
        playerCount: allPlayers.filter(p => p.team_id === team.id).length
      }));
      
      setTeams(teamsWithCounts);
      console.log('SelectTeamScreen: Teams loaded with counts:', teamsWithCounts.map(t => `${t.name}: ${t.playerCount} jugadores`));
    } catch (error) {
      console.error('Error loading teams:', error);
      Alert.alert('Error', 'No se pudieron cargar los equipos');
    } finally {
      setLoading(false);
    }
  };

  const handleTeamSelect = (team: any) => {
    onTeamSelected?.(team.id, team.name);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={onOpenMenu}>
          <MenuIcon size={28} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <TeamIcon size={24} color={Colors.primary} />
          <Text style={styles.headerTitle}>Selecciona tu Equipo</Text>
        </View>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionDescription}>
            Selecciona el equipo con el que vas a jugar el partido
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Cargando equipos...</Text>
          </View>
        ) : teams.length === 0 ? (
          <View style={styles.emptyContainer}>
            <TeamIcon size={64} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No tienes equipos registrados</Text>
            <Text style={styles.emptySubtext}>
              Crea un equipo desde el menú "Mis Equipos"
            </Text>
          </View>
        ) : (
          teams.map((team) => (
            <TouchableOpacity
              key={team.id}
              style={styles.teamCard}
              onPress={() => handleTeamSelect(team)}
              activeOpacity={0.7}
            >
              <View style={styles.teamInfo}>
                <View style={styles.teamIconContainer}>
                  <TeamIcon size={28} color={Colors.primary} />
                </View>
                <View style={styles.teamTextContainer}>
                  <Text style={styles.teamName}>{team.name}</Text>
                  <Text style={styles.teamPlayers}>
                    {team.playerCount || team.player_count || 0} jugadores
                  </Text>
                </View>
              </View>
              <ChevronRightIcon size={24} color={Colors.textTertiary} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
  backButton: {
    padding: Spacing.sm,
  },
  backButtonText: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: '600',
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionDescription: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  loadingText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  teamIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  teamTextContainer: {
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
});
