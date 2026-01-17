/**
 * Pantalla para comenzar un partido
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';
import { 
  MenuIcon, 
  PlayIcon, 
  TeamIcon, 
  VolleyballIcon,
  ChevronRightIcon,
  DeleteIcon,
} from '../components/VectorIcons';
import { Team, Player, Match, matchesService } from '../services/api';

// Safe area paddings para Android
const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;
const ANDROID_NAV_BAR_HEIGHT = 48;

interface StartMatchScreenProps {
  teams?: Team[];
  onBack?: () => void;
  onOpenMenu?: () => void;
  onStartMatch?: (team: Team) => void;
  onContinueMatch?: (match: Match) => void;
  userId?: number | null;
}

export default function StartMatchScreen({ 
  teams = [], 
  onBack, 
  onOpenMenu,
  onStartMatch,
  onContinueMatch,
  userId,
}: StartMatchScreenProps) {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [ongoingMatch, setOngoingMatch] = useState<Match | null>(null);
  const [loadingOngoing, setLoadingOngoing] = useState(true);

  // Check for ongoing matches when component mounts
  useEffect(() => {
    const checkOngoingMatch = async () => {
      if (!userId) {
        setLoadingOngoing(false);
        return;
      }
      
      try {
        const matches = await matchesService.getAll({ user_id: userId, status: 'in_progress' });
        if (matches.length > 0) {
          // Get the most recent ongoing match
          const mostRecent = matches.sort((a, b) => 
            new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
          )[0];
          setOngoingMatch(mostRecent);
        }
      } catch (error) {
        console.error('Error checking ongoing matches:', error);
      } finally {
        setLoadingOngoing(false);
      }
    };
    
    checkOngoingMatch();
  }, [userId]);

  const handleFinishOngoingMatch = async () => {
    if (!ongoingMatch) return;
    
    try {
      await matchesService.finishMatch(ongoingMatch.id, ongoingMatch.total_sets || 0);
      // Also delete any saved match state
      try {
        await matchesService.deleteMatchState(ongoingMatch.id);
      } catch (stateError) {
        // Ignore if no state exists
        console.log('No state to delete');
      }
      setOngoingMatch(null);
    } catch (error) {
      console.error('Error finishing match:', error);
    }
  };

  const formatMatchDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day} ${monthNames[date.getMonth()]} - ${hours}:${minutes}`;
  };

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
        {/* Ongoing Match Banner */}
        {loadingOngoing ? (
          <View style={styles.loadingOngoing}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : ongoingMatch && (
          <View style={styles.ongoingMatchContainer}>
            <View style={styles.ongoingMatchHeader}>
              <View style={styles.ongoingMatchLive}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>PARTIDO EN CURSO</Text>
              </View>
            </View>
            
            <View style={styles.ongoingMatchInfo}>
              <View style={styles.ongoingMatchTeams}>
                <Text style={styles.ongoingMatchTeamName}>{ongoingMatch.team_name || 'Tu equipo'}</Text>
                {ongoingMatch.opponent && (
                  <>
                    <Text style={styles.ongoingMatchVs}>vs</Text>
                    <Text style={styles.ongoingMatchOpponent}>{ongoingMatch.opponent}</Text>
                  </>
                )}
              </View>
              <View style={styles.ongoingMatchMeta}>
                <MaterialCommunityIcons 
                  name={ongoingMatch.location === 'home' ? 'home' : 'airplane'} 
                  size={14} 
                  color="rgba(255,255,255,0.7)" 
                />
                <Text style={styles.ongoingMatchMetaText}>
                  {ongoingMatch.location === 'home' ? 'Local' : 'Visitante'}
                </Text>
                <Text style={styles.ongoingMatchMetaDot}>•</Text>
                <Text style={styles.ongoingMatchMetaText}>
                  Set {ongoingMatch.total_sets || 1}
                </Text>
                {ongoingMatch.date && (
                  <>
                    <Text style={styles.ongoingMatchMetaDot}>•</Text>
                    <Text style={styles.ongoingMatchMetaText}>
                      {formatMatchDate(ongoingMatch.date)}
                    </Text>
                  </>
                )}
              </View>
            </View>

            <View style={styles.ongoingMatchActions}>
              <TouchableOpacity
                style={styles.continueMatchButton}
                onPress={() => onContinueMatch?.(ongoingMatch)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="play" size={20} color="#FFFFFF" />
                <Text style={styles.continueMatchButtonText}>Continuar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.finishMatchButton}
                onPress={handleFinishOngoingMatch}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="flag-checkered" size={18} color={Colors.error} />
                <Text style={styles.finishMatchButtonText}>Finalizar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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
  // Ongoing Match Styles
  loadingOngoing: {
    padding: Spacing.md,
    alignItems: 'center',
  },
  ongoingMatchContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  ongoingMatchHeader: {
    marginBottom: Spacing.md,
  },
  ongoingMatchLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
  },
  liveText: {
    fontSize: FontSizes.xs,
    fontWeight: '800',
    color: '#22c55e',
    letterSpacing: 1,
  },
  ongoingMatchInfo: {
    marginBottom: Spacing.lg,
  },
  ongoingMatchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  ongoingMatchTeamName: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ongoingMatchVs: {
    fontSize: FontSizes.md,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  },
  ongoingMatchOpponent: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ongoingMatchMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  ongoingMatchMetaText: {
    fontSize: FontSizes.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  ongoingMatchMetaDot: {
    fontSize: FontSizes.sm,
    color: 'rgba(255,255,255,0.4)',
  },
  ongoingMatchActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  continueMatchButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  continueMatchButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  finishMatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  finishMatchButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.error,
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
