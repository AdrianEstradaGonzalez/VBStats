/**
 * Pantalla de Marcador de Voleibol
 * Marcador al mejor de 5 sets con semáforos para sets ganados
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';
import { CustomAlert } from '../components';
import { MenuIcon } from '../components/VectorIcons';

// Safe area paddings para Android
const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;
const ANDROID_NAV_BAR_HEIGHT = 48;

interface ScoreboardScreenProps {
  onOpenMenu?: () => void;
  onBack?: () => void;
}

interface TeamScore {
  name: string;
  points: number;
  setsWon: number;
}

interface SetResult {
  setNumber: number;
  home: number;
  away: number;
}

const POINTS_TO_WIN = 25;
const TIEBREAK_POINTS = 15;
const MIN_DIFFERENCE = 2;
const DEFAULT_MODE = 'bestOf5' as const;
type MatchMode = 'bestOf5' | 'bestOf3';

export default function ScoreboardScreen({ 
  onOpenMenu,
  onBack 
}: ScoreboardScreenProps) {
  const [homeTeam, setHomeTeam] = React.useState<TeamScore>({ name: 'Local', points: 0, setsWon: 0 });
  const [awayTeam, setAwayTeam] = React.useState<TeamScore>({ name: 'Visitante', points: 0, setsWon: 0 });
  const [currentSet, setCurrentSet] = React.useState(1);
  const [isMatchOver, setIsMatchOver] = React.useState(false);
  const [showResetAlert, setShowResetAlert] = React.useState(false);
  const [showWinnerAlert, setShowWinnerAlert] = React.useState(false);
  const [winner, setWinner] = React.useState<'home' | 'away' | null>(null);
  const [matchMode, setMatchMode] = React.useState<MatchMode>(DEFAULT_MODE);
  const [setResults, setSetResults] = React.useState<SetResult[]>([]);
  const [previousState, setPreviousState] = React.useState<{
    homeTeam: TeamScore;
    awayTeam: TeamScore;
    currentSet: number;
    setResults: SetResult[];
  } | null>(null);
  const [showUndoOption, setShowUndoOption] = React.useState(false);
  const undoTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const setsToWin = matchMode === 'bestOf5' ? 3 : 2;
  const maxSets = matchMode === 'bestOf5' ? 5 : 3;
  const isTiebreak = matchMode === 'bestOf5' && currentSet === maxSets;
  const targetPoints = isTiebreak ? TIEBREAK_POINTS : POINTS_TO_WIN;

  const checkSetWinner = (home: number, away: number): 'home' | 'away' | null => {
    const difference = Math.abs(home - away);
    
    if (home >= targetPoints && difference >= MIN_DIFFERENCE && home > away) {
      return 'home';
    }
    if (away >= targetPoints && difference >= MIN_DIFFERENCE && away > home) {
      return 'away';
    }
    return null;
  };

  const addPoint = (team: 'home' | 'away') => {
    if (isMatchOver) return;

    let newHome = homeTeam.points;
    let newAway = awayTeam.points;

    if (team === 'home') {
      newHome += 1;
    } else {
      newAway += 1;
    }

    setHomeTeam((prev: TeamScore) => ({ ...prev, points: newHome }));
    setAwayTeam((prev: TeamScore) => ({ ...prev, points: newAway }));

    // Check for set winner
    const setWinner = checkSetWinner(newHome, newAway);
    if (setWinner) {
      handleSetWin(setWinner, newHome, newAway);
    }
  };

  const removePoint = (team: 'home' | 'away') => {
    if (isMatchOver) return;

    if (team === 'home' && homeTeam.points > 0) {
      setHomeTeam((prev: TeamScore) => ({ ...prev, points: prev.points - 1 }));
    } else if (team === 'away' && awayTeam.points > 0) {
      setAwayTeam((prev: TeamScore) => ({ ...prev, points: prev.points - 1 }));
    }
  };

  const handleSetWin = (
    winningTeam: 'home' | 'away',
    finalHomePoints: number,
    finalAwayPoints: number
  ) => {
    // Save state before making changes (for undo functionality)
    setPreviousState({
      homeTeam: { ...homeTeam },
      awayTeam: { ...awayTeam },
      currentSet,
      setResults: [...setResults],
    });

    const finishedSet: SetResult = {
      setNumber: currentSet,
      home: finalHomePoints,
      away: finalAwayPoints,
    };
    setSetResults((prev) => [...prev, finishedSet]);

    const newHomeSets = winningTeam === 'home' ? homeTeam.setsWon + 1 : homeTeam.setsWon;
    const newAwaySets = winningTeam === 'away' ? awayTeam.setsWon + 1 : awayTeam.setsWon;

    setHomeTeam((prev: TeamScore) => ({ 
      ...prev, 
      setsWon: newHomeSets,
      points: 0 
    }));
    setAwayTeam((prev: TeamScore) => ({ 
      ...prev, 
      setsWon: newAwaySets,
      points: 0 
    }));

    // Check for match winner
    if (newHomeSets === setsToWin) {
      setWinner('home');
      setIsMatchOver(true);
      setShowWinnerAlert(true);
    } else if (newAwaySets === setsToWin) {
      setWinner('away');
      setIsMatchOver(true);
      setShowWinnerAlert(true);
    } else {
      setCurrentSet((prev: number) => prev + 1);
      // Show undo option for 5 seconds
      setShowUndoOption(true);
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
      undoTimerRef.current = setTimeout(() => {
        setShowUndoOption(false);
        setPreviousState(null);
      }, 5000);
    }
  };

  const undoSetWin = () => {
    if (previousState) {
      setHomeTeam(previousState.homeTeam);
      setAwayTeam(previousState.awayTeam);
      setCurrentSet(previousState.currentSet);
      setSetResults(previousState.setResults);
      setPreviousState(null);
      setShowUndoOption(false);
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    }
  };

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const resetMatch = () => {
    setHomeTeam({ name: 'Local', points: 0, setsWon: 0 });
    setAwayTeam({ name: 'Visitante', points: 0, setsWon: 0 });
    setCurrentSet(1);
    setIsMatchOver(false);
    setWinner(null);
    setShowResetAlert(false);
    setSetResults([]);
    setPreviousState(null);
    setShowUndoOption(false);
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
  };

  const renderSetResults = () => {
    if (setResults.length === 0) return null;

    return (
      <View style={styles.setResults}
        >
        <Text style={styles.setResultsTitle}>Resultado por set</Text>
        <View style={styles.setResultsList}>
          {setResults.map((set) => (
            <View key={set.setNumber} style={styles.setResultItem}>
              <Text style={styles.setResultLabel}>Set {set.setNumber}</Text>
              <Text style={styles.setResultScore}>
                {set.home} - {set.away}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderSetIndicators = (setsWon: number) => {
    const indicators = [];
    for (let i = 0; i < setsToWin; i++) {
      indicators.push(
        <View 
          key={i}
          style={[
            styles.setIndicator,
            i < setsWon && styles.setIndicatorWon
          ]}
        />
      );
    }
    return (
      <View style={styles.setIndicators}>
        {indicators}
      </View>
    );
  };

  const renderTeamScore = (team: TeamScore, teamType: 'home' | 'away') => {
    const isHome = teamType === 'home';
    const teamColor = isHome ? '#3b82f6' : '#ef4444';

    return (
      <View style={[styles.teamSection, { backgroundColor: teamColor + '10' }]}>
        {/* Team Name */}
        <Text style={[styles.teamName, { color: teamColor }]}>
          {team.name}
        </Text>

        {/* Set Indicators (Traffic Lights) */}
        {renderSetIndicators(team.setsWon)}

        {/* Points */}
        <View style={styles.pointsContainer}>
          <TouchableOpacity 
            style={[styles.pointButton, styles.minusButton]}
            onPress={() => removePoint(teamType)}
            disabled={isMatchOver || team.points === 0}
          >
            <MaterialCommunityIcons name="minus" size={32} color={Colors.text} />
          </TouchableOpacity>

          <Text style={[styles.points, { color: teamColor }]}>
            {team.points}
          </Text>

          <TouchableOpacity 
            style={[styles.pointButton, styles.plusButton, { backgroundColor: teamColor }]}
            onPress={() => addPoint(teamType)}
            disabled={isMatchOver}
          >
            <MaterialCommunityIcons name="plus" size={32} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={onOpenMenu}>
          <MenuIcon size={28} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <MaterialCommunityIcons name="scoreboard" size={24} color={Colors.primary} />
          <Text style={styles.headerTitle}>Marcador</Text>
        </View>
        <TouchableOpacity 
          style={styles.resetButton}
          onPress={() => setShowResetAlert(true)}
        >
          <MaterialCommunityIcons name="refresh" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Match Mode Toggle */}
      <View style={styles.modeToggleContainer}>
        <TouchableOpacity
          style={[
            styles.modeToggleButton,
            matchMode === 'bestOf5' && styles.modeToggleButtonActive,
          ]}
          onPress={() => {
            if (matchMode !== 'bestOf5') {
              setMatchMode('bestOf5');
              resetMatch();
            }
          }}
        >
          <Text
            style={[
              styles.modeToggleText,
              matchMode === 'bestOf5' && styles.modeToggleTextActive,
            ]}
          >
            Mejor de 5
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.modeToggleButton,
            matchMode === 'bestOf3' && styles.modeToggleButtonActive,
          ]}
          onPress={() => {
            if (matchMode !== 'bestOf3') {
              setMatchMode('bestOf3');
              resetMatch();
            }
          }}
        >
          <Text
            style={[
              styles.modeToggleText,
              matchMode === 'bestOf3' && styles.modeToggleTextActive,
            ]}
          >
            Mejor de 3
          </Text>
        </TouchableOpacity>
      </View>

      {/* Undo Banner */}
      {showUndoOption && (
        <View style={styles.undoBanner}>
          <View style={styles.undoContent}>
            <MaterialCommunityIcons name="check-circle" size={20} color="#22c55e" />
            <Text style={styles.undoText}>Set finalizado</Text>
          </View>
          <TouchableOpacity 
            style={styles.undoButton}
            onPress={undoSetWin}
          >
            <MaterialCommunityIcons name="undo" size={20} color={Colors.primary} />
            <Text style={styles.undoButtonText}>Deshacer</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Set Info */}
        <View style={styles.setInfo}>
          <View style={styles.setInfoBadge}>
            <Text style={styles.setInfoText}>
              {isMatchOver ? 'Partido Finalizado' : `Set ${currentSet}`}
            </Text>
            {isTiebreak && !isMatchOver && (
              <Text style={styles.tiebreakText}>Tiebreak (a {TIEBREAK_POINTS})</Text>
            )}
          </View>
        </View>

        {/* Score Display */}
        <View style={styles.scoreContainer}>
          {renderTeamScore(homeTeam, 'home')}
          
          <View style={styles.divider}>
            <Text style={styles.vsText}>VS</Text>
          </View>

          {renderTeamScore(awayTeam, 'away')}
        </View>

        {/* Match Score Summary */}
        <View style={styles.matchScore}>
          <Text style={styles.matchScoreText}>
            Sets: {homeTeam.setsWon} - {awayTeam.setsWon}
          </Text>
        </View>

        {/* Set Results */}
        {renderSetResults()}

        {/* Instructions */}
        {!isMatchOver && (
          <View style={styles.instructions}>
            <MaterialCommunityIcons name="gesture-tap" size={20} color={Colors.textSecondary} />
            <Text style={styles.instructionsText}>
              Toca + para sumar punto, - para restar
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Reset Confirmation Alert */}
      <CustomAlert
        visible={showResetAlert}
        title="Reiniciar Partido"
        message="¿Estás seguro de que quieres reiniciar el marcador? Se perderán todos los datos del partido actual."
        type="warning"
        icon={<MaterialCommunityIcons name="refresh" size={32} color={Colors.warning} />}
        buttons={[
          {
            text: 'Cancelar',
            onPress: () => setShowResetAlert(false),
            style: 'cancel',
          },
          {
            text: 'Reiniciar',
            onPress: resetMatch,
            style: 'destructive',
          },
        ]}
        onClose={() => setShowResetAlert(false)}
      />

      {/* Winner Alert */}
      <CustomAlert
        visible={showWinnerAlert}
        title="¡Partido Finalizado!"
        message={`${winner === 'home' ? homeTeam.name : awayTeam.name} gana el partido ${homeTeam.setsWon} - ${awayTeam.setsWon}.

      Resultado por set:
      ${setResults.map((set) => `Set ${set.setNumber}: ${set.home} - ${set.away}`).join('\n')}`}
        type="success"
        icon={<MaterialCommunityIcons name="trophy" size={48} color="#f59e0b" />}
        buttons={[
          {
            text: 'Nuevo Partido',
            onPress: () => {
              setShowWinnerAlert(false);
              resetMatch();
            },
            style: 'primary',
          },
          {
            text: 'Cerrar',
            onPress: () => setShowWinnerAlert(false),
            style: 'cancel',
          },
        ]}
        onClose={() => setShowWinnerAlert(false)}
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
  modeToggleContainer: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeToggleButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  modeToggleButtonActive: {
    backgroundColor: Colors.primary,
  },
  modeToggleText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  modeToggleTextActive: {
    color: Colors.textOnPrimary,
  },
  menuButton: {
    padding: Spacing.sm,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  resetButton: {
    padding: Spacing.sm,
  },
  setInfo: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  setInfoBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    ...Shadows.sm,
  },
  setInfoText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  tiebreakText: {
    fontSize: FontSizes.sm,
    color: Colors.accent,
    marginTop: Spacing.xs,
  },
  scoreContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
    minHeight: 280,
  },
  teamSection: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    margin: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 280,
    ...Shadows.md,
  },
  teamName: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    textAlign: 'center',
    flexShrink: 0,
  },
  setIndicators: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  setIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.border,
    borderWidth: 2,
    borderColor: Colors.textTertiary,
  },
  setIndicatorWon: {
    backgroundColor: '#22c55e',
    borderColor: '#16a34a',
  },
  pointsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    flex: 1,
    minHeight: 200,
  },
  points: {
    fontSize: 64,
    fontWeight: '800',
    lineHeight: 72,
    textAlign: 'center',
    includeFontPadding: false,
    minWidth: 80,
  },
  pointButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  plusButton: {
    backgroundColor: Colors.primary,
  },
  minusButton: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  divider: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  vsText: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: Colors.textTertiary,
  },
  matchScore: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },
  matchScoreText: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  setResults: {
    marginHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  setResultsTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  setResultsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  setResultItem: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 110,
    alignItems: 'center',
  },
  setResultLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  setResultScore: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  instructionsText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  undoBanner: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  undoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  undoText: {
    fontSize: FontSizes.md,
    color: Colors.text,
    fontWeight: '600',
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  undoButtonText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: '700',
  },
});
