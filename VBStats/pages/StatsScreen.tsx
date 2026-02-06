/**
 * Pantalla de estadísticas - Historial de partidos
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  StatusBar,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';
import { matchesService } from '../services/api';
import type { Match, Team } from '../services/types';
import CustomAlert from '../components/CustomAlert';
import MatchStatsScreen from './MatchStatsScreen';
import TeamTrackingScreen from './TeamTrackingScreen';
import { SubscriptionType } from '../services/subscriptionService';
import { 
  MenuIcon, 
  StatsIcon, 
  ChevronRightIcon,
  DeleteIcon,
} from '../components/VectorIcons';

// Safe area paddings para Android
const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;
const ANDROID_NAV_BAR_HEIGHT = 48;

interface MatchRecord {
  id: string;
  teamName: string;
  date: string;
  opponent?: string;
  result?: 'win' | 'loss';
  score?: string;
  stats: {
    serves: { success: number; total: number };
    receptions: { success: number; total: number };
    attacks: { success: number; total: number };
    blocks: number;
  };
}

interface StatsScreenProps {
  userId?: number | null;
  onBack?: () => void;
  onOpenMenu?: () => void;
  onViewMatch?: (match: Match) => void;
  subscriptionType?: SubscriptionType;
  onUpgradeToPro?: () => void;
  teams?: Team[];
  resetTrackingKey?: number;
}

export default function StatsScreen({ 
  userId,
  onBack, 
  onOpenMenu,
  onViewMatch,
  subscriptionType = 'pro',
  onUpgradeToPro,
  teams = [],
  resetTrackingKey = 0,
}: StatsScreenProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState<Match | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showTracking, setShowTracking] = useState(false);
  const [showProAlert, setShowProAlert] = useState(false);
  const [filterFromDate, setFilterFromDate] = useState<Date | null>(null);
  const [filterToDate, setFilterToDate] = useState<Date | null>(null);
  const [opponentQuery, setOpponentQuery] = useState('');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<number | 'all'>('all');

  const isProSubscription = subscriptionType === 'pro';

  useEffect(() => {
    setShowTracking(false);
    setSelectedMatch(null);
    setShowProAlert(false);
  }, [resetTrackingKey]);

  useEffect(() => {
    loadFinishedMatches();
  }, [userId]);

  const loadFinishedMatches = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const finishedMatches = await matchesService.getFinishedByUser(userId);
      setMatches(finishedMatches);
      console.log('Partidos finalizados cargados:', finishedMatches.length);
    } catch (error) {
      console.error('Error cargando partidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const day = date.getDate();
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const handleDeleteMatch = (match: Match) => {
    setMatchToDelete(match);
    setShowDeleteAlert(true);
  };

  const confirmDelete = async () => {
    if (!matchToDelete) return;
    
    try {
      await matchesService.delete(matchToDelete.id);
      setMatches(prev => prev.filter(m => m.id !== matchToDelete.id));
      console.log('Partido eliminado:', matchToDelete.id);
    } catch (error) {
      console.error('Error eliminando partido:', error);
    } finally {
      setShowDeleteAlert(false);
      setMatchToDelete(null);
    }
  };

  const handleViewMatch = (match: Match) => {
    setSelectedMatch(match);
    onViewMatch?.(match);
  };

  const handleTrackingPress = () => {
    if (isProSubscription) {
      setShowTracking(true);
    } else {
      setShowProAlert(true);
    }
  };

  const formatFilterDate = (value: Date | null) => {
    if (!value) return '';
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const matchesFiltered = matches
    .filter(match => {
      if (selectedTeamId !== 'all' && match.team_id !== selectedTeamId) return false;
      const opponent = (match.opponent || '').toLowerCase();
      const query = opponentQuery.trim().toLowerCase();
      if (query && !opponent.includes(query)) return false;

      const matchDate = match.date ? new Date(match.date) : null;
      const fromDate = filterFromDate ? new Date(filterFromDate.getFullYear(), filterFromDate.getMonth(), filterFromDate.getDate()) : null;
      const toDate = filterToDate ? new Date(filterToDate.getFullYear(), filterToDate.getMonth(), filterToDate.getDate(), 23, 59, 59, 999) : null;
      if (fromDate && (!matchDate || matchDate < fromDate)) return false;
      if (toDate && (!matchDate || matchDate > toDate)) {
        return false;
      }

      return true;
    })
    .slice()
    .sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;
      return bTime - aTime;
    });
  
  // If showing tracking screen
  if (showTracking && userId) {
    return (
      <TeamTrackingScreen
        userId={userId}
        teams={teams}
        onBack={() => setShowTracking(false)}
        onOpenMenu={onOpenMenu}
      />
    );
  }

  // If a match is selected, show the detailed stats screen
  if (selectedMatch) {
    return (
      <MatchStatsScreen 
        match={selectedMatch} 
        onBack={() => setSelectedMatch(null)} 
        onOpenMenu={onOpenMenu}
        subscriptionType={subscriptionType}
      />
    );
  }
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.menuButton} onPress={onOpenMenu}>
            <MenuIcon size={28} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <StatsIcon size={24} color={Colors.primary} />
            <Text style={styles.headerTitle}>Estadísticas</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Cargando partidos...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={onOpenMenu}>
          <MenuIcon size={28} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <StatsIcon size={24} color={Colors.primary} />
          <Text style={styles.headerTitle}>Estadísticas</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Botón de Seguimiento PRO */}
        <TouchableOpacity
          style={styles.trackingButton}
          onPress={handleTrackingPress}
          activeOpacity={0.8}
        >
          <View style={styles.trackingButtonContent}>
            <View style={styles.trackingIconContainer}>
              <MaterialCommunityIcons name="chart-timeline-variant" size={28} color="#fff" />
            </View>
            <View style={styles.trackingTextContainer}>
              <View style={styles.trackingTitleRow}>
                <Text style={styles.trackingTitle}>Seguimiento de Equipos</Text>
                {!isProSubscription && (
                  <View style={styles.proBadge}>
                    <MaterialCommunityIcons name="crown" size={12} color="#f59e0b" />
                    <Text style={styles.proBadgeText}>PRO</Text>
                  </View>
                )}
              </View>
              <Text style={styles.trackingSubtitle}>
                Analiza el progreso con gráficas comparativas
              </Text>
            </View>
            <ChevronRightIcon size={24} color="rgba(255,255,255,0.7)" />
          </View>
        </TouchableOpacity>

        {matches.length === 0 ? (
          <View style={styles.emptyState}>
            <StatsIcon size={80} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>Sin partidos</Text>
            <Text style={styles.emptyText}>
              Aún no has finalizado ningún partido
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Historial de Partidos</Text>
            <Text style={styles.sectionSubtitle}>
              {matchesFiltered.length} {matchesFiltered.length === 1 ? 'partido finalizado' : 'partidos finalizados'}
            </Text>

            <View style={styles.filterContainer}>
              <Text style={styles.filterLabel}>Filtrar por fechas</Text>
              <View style={styles.filterRow}>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowFromPicker(true)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="calendar" size={18} color={Colors.textTertiary} />
                  <Text style={filterFromDate ? styles.dateInputText : styles.dateInputPlaceholder}>
                    {filterFromDate ? formatFilterDate(filterFromDate) : 'Desde'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowToPicker(true)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="calendar" size={18} color={Colors.textTertiary} />
                  <Text style={filterToDate ? styles.dateInputText : styles.dateInputPlaceholder}>
                    {filterToDate ? formatFilterDate(filterToDate) : 'Hasta'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.filterLabel}>Equipo</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.teamFilterRow}
              >
                <TouchableOpacity
                  style={[
                    styles.teamFilterChip,
                    selectedTeamId === 'all' && styles.teamFilterChipActive,
                  ]}
                  onPress={() => setSelectedTeamId('all')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.teamFilterChipText,
                      selectedTeamId === 'all' && styles.teamFilterChipTextActive,
                    ]}
                  >
                    Todos
                  </Text>
                </TouchableOpacity>
                {teams.map(team => (
                  <TouchableOpacity
                    key={team.id}
                    style={[
                      styles.teamFilterChip,
                      selectedTeamId === team.id && styles.teamFilterChipActive,
                    ]}
                    onPress={() => setSelectedTeamId(team.id)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.teamFilterChipText,
                        selectedTeamId === team.id && styles.teamFilterChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {team.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.filterLabel}>Buscar por rival</Text>
              <View style={styles.searchRow}>
                <MaterialCommunityIcons name="magnify" size={18} color={Colors.textTertiary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Nombre del equipo rival"
                  placeholderTextColor={Colors.textTertiary}
                  value={opponentQuery}
                  onChangeText={setOpponentQuery}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {showFromPicker && (
              <DateTimePicker
                value={filterFromDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                onChange={(event, selectedDate) => {
                  if (Platform.OS !== 'ios') {
                    setShowFromPicker(false);
                  }
                  if (event.type === 'dismissed') return;
                  if (selectedDate) {
                    setFilterFromDate(selectedDate);
                  }
                }}
              />
            )}

            {showToPicker && (
              <DateTimePicker
                value={filterToDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                onChange={(event, selectedDate) => {
                  if (Platform.OS !== 'ios') {
                    setShowToPicker(false);
                  }
                  if (event.type === 'dismissed') return;
                  if (selectedDate) {
                    setFilterToDate(selectedDate);
                  }
                }}
              />
            )}

            {matchesFiltered.length === 0 ? (
              <View style={styles.emptyFilterState}>
                <Text style={styles.emptyFilterTitle}>Sin resultados</Text>
                <Text style={styles.emptyFilterText}>
                  Ajusta las fechas o el nombre del rival para ver partidos
                </Text>
              </View>
            ) : (
              matchesFiltered.map((match) => (
                <View key={match.id} style={styles.matchCard}>
                  <TouchableOpacity
                    style={styles.matchCardContent}
                    onPress={() => handleViewMatch(match)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.matchHeader}>
                      <View style={styles.matchDateContainer}>
                        <Text style={styles.matchDate}>{formatDate(match.date)}</Text>
                      </View>
                      <View style={styles.matchHeaderRight}>
                        <View style={styles.resultBadge}>
                          <Text style={styles.resultText}>
                            {match.total_sets || 0} {match.total_sets === 1 ? 'Set' : 'Sets'}
                          </Text>
                        </View>
                        <TouchableOpacity 
                          style={styles.deleteButton}
                          onPress={() => handleDeleteMatch(match)}
                          activeOpacity={0.7}
                        >
                          <DeleteIcon size={18} color={Colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.matchInfo}>
                      <View style={styles.matchTeams}>
                        <Text style={styles.teamName}>{match.team_name || 'Mi Equipo'}</Text>
                        {match.opponent && (
                          <>
                            <Text style={styles.vsText}>vs</Text>
                            <Text style={styles.opponentName}>{match.opponent}</Text>
                          </>
                        )}
                      </View>
                      {(match.score_home !== null && match.score_home !== undefined &&
                        match.score_away !== null && match.score_away !== undefined) && (
                        <View style={styles.matchScoreRow}>
                          <MaterialCommunityIcons name="scoreboard-outline" size={18} color={Colors.primary} />
                          <Text style={styles.matchScoreText}>
                            {match.score_home} - {match.score_away}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.matchFooter}>
                      <View style={styles.locationContainer}>
                        <MaterialCommunityIcons 
                          name={match.location === 'home' ? 'home' : 'airplane'} 
                          size={18} 
                          color={match.location === 'home' ? Colors.primary : Colors.textSecondary} 
                        />
                        <Text style={[styles.locationText, match.location === 'home' && styles.locationTextHome]}>
                          {match.location === 'home' ? 'Local' : 'Visitante'}
                        </Text>
                      </View>
                      <View style={styles.viewMore}>
                        <Text style={styles.viewMoreText}>Ver estadísticas</Text>
                        <ChevronRightIcon size={16} color={Colors.primary} />
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* CustomAlert for delete confirmation */}
      <CustomAlert
        visible={showDeleteAlert}
        title="Eliminar Partido"
        message={`¿Estás seguro de que deseas eliminar este partido${matchToDelete?.opponent ? ` contra ${matchToDelete.opponent}` : ''}? Se eliminarán todas las estadísticas asociadas. Esta acción no se puede deshacer.`}
        buttonLayout="column"
        buttons={[
          {
            text: 'Cancelar',
            onPress: () => {
              setShowDeleteAlert(false);
              setMatchToDelete(null);
            },
            style: 'cancel'
          },
          {
            text: 'Eliminar',
            onPress: confirmDelete,
            style: 'destructive'
          }
        ]}
      />

      {/* CustomAlert for PRO upgrade */}
      <CustomAlert
        visible={showProAlert}
        icon={<MaterialCommunityIcons name="crown" size={48} color="#f59e0b" />}
        iconBackgroundColor="#f59e0b15"
        title="Función VBStats Pro"
        message="El Seguimiento de Equipos es una función exclusiva de VBStats Pro que te permite analizar el progreso con gráficas detalladas."
        warning="Mejora tu plan para acceder a esta función y muchas más."
        buttonLayout="column"
        buttons={[
          {
            text: 'Obtener VBStats Pro',
            icon: <MaterialCommunityIcons name="crown" size={18} color="#fff" />,
            onPress: () => {
              setShowProAlert(false);
              onUpgradeToPro?.();
            },
            style: 'primary',
          },
          {
            text: 'Cancelar',
            onPress: () => setShowProAlert(false),
            style: 'cancel',
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR_HEIGHT : 0,
    paddingBottom: 0,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  scrollContent: {
    padding: Spacing.lg,
    flexGrow: 1,
  },
  trackingButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    ...Shadows.md,
  },
  trackingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  trackingIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  trackingTextContainer: {
    flex: 1,
  },
  trackingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  trackingTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  trackingSubtitle: {
    fontSize: FontSizes.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  proBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: '#f59e0b',
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
  filterContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  dateInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  dateInputText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    fontWeight: '600',
  },
  dateInputPlaceholder: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  teamFilterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  teamFilterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  teamFilterChipActive: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary,
  },
  teamFilterChipText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  teamFilterChipTextActive: {
    color: Colors.primary,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.sm,
    fontSize: FontSizes.sm,
    color: Colors.text,
  },
  emptyFilterState: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyFilterTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  emptyFilterText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  matchCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  matchCardContent: {
    padding: Spacing.lg,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  matchHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.error + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchDateContainer: {},
  matchDate: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  resultBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary,
  },
  resultText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  matchInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  matchTeams: {
    flex: 1,
  },
  matchScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  matchScoreText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
  teamName: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  vsText: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    marginVertical: Spacing.xs,
  },
  opponentName: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  matchFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  locationText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  locationTextHome: {
    color: Colors.primary,
    fontWeight: '600',
  },
  viewMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  viewMoreText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: '600',
    marginRight: Spacing.xs,
  },
});
