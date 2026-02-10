/**
 * Pantalla de búsqueda de partido por código
 * Vista moderna para cuentas gratuitas
 * Incluye historial de partidos buscados previamente
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  StatusBar,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  FlatList,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows, SAFE_AREA_TOP } from '../styles';
import { CustomAlert } from '../components';
import { MenuIcon, VolleyballIcon } from '../components/VectorIcons';
import { subscriptionService } from '../services/subscriptionService';
import { matchesService } from '../services/api';
import type { Match } from '../services/types';
import { savedMatchesService, SavedMatch } from '../services/savedMatchesService';

// Safe area paddings para Android
const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;
const ANDROID_NAV_BAR_HEIGHT = 48;

interface SearchByCodeScreenProps {
  onOpenMenu?: () => void;
  onMatchFound?: (match: Match) => void;
  userId?: number | null;
}

export default function SearchByCodeScreen({ 
  onOpenMenu,
  onMatchFound,
  userId
}: SearchByCodeScreenProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [foundMatch, setFoundMatch] = useState<Match | null>(null);
  const [savedMatches, setSavedMatches] = useState<SavedMatch[]>([]);
  const [loadingSavedMatches, setLoadingSavedMatches] = useState(true);
  const [deleteCandidate, setDeleteCandidate] = useState<SavedMatch | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load saved matches on mount
  useEffect(() => {
    loadSavedMatches();
  }, [userId]);

  const loadSavedMatches = async () => {
    setLoadingSavedMatches(true);
    try {
      const matches = await savedMatchesService.getSavedMatches(userId);
      setSavedMatches(matches);
    } catch (error) {
      console.error('Error loading saved matches:', error);
    } finally {
      setLoadingSavedMatches(false);
    }
  };

  const formatCode = (text: string): string => {
    // Convert to uppercase and remove invalid characters
    return text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  };

  const handleCodeChange = (text: string) => {
    setCode(formatCode(text));
    setFoundMatch(null);
  };

  const handleSearch = async () => {
    if (code.length < 8) {
      setErrorMessage('El código debe tener 8 caracteres');
      setShowErrorAlert(true);
      return;
    }

    setIsLoading(true);
    try {
      const result = await subscriptionService.searchByCode(code);
      
      if (result.error) {
        setErrorMessage(result.error);
        setShowErrorAlert(true);
        return;
      }

      if (result.matchId) {
        // Fetch full match details
        const match = await matchesService.getById(result.matchId);
        
        // Save match to local storage for quick access later
        await savedMatchesService.saveMatch(match, code, userId);
        await loadSavedMatches();
        
        // Navigate directly to stats
        if (onMatchFound) {
          onMatchFound(match);
        }
      }
    } catch (error) {
      console.error('Error searching match:', error);
      setErrorMessage('Error al buscar el partido. Inténtalo de nuevo.');
      setShowErrorAlert(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewMatch = () => {
    if (foundMatch && onMatchFound) {
      onMatchFound(foundMatch);
    }
  };

  const handleViewSavedMatch = async (saved: SavedMatch) => {
    try {
      const match = await matchesService.getById(saved.id);
      if (onMatchFound) {
        onMatchFound(match);
      }
    } catch (error) {
      console.error('Error loading saved match:', error);
      setErrorMessage('No se pudo cargar el partido. Es posible que ya no esté disponible.');
      setShowErrorAlert(true);
      // Remove invalid match from saved list
      await savedMatchesService.removeSavedMatch(saved.id, userId);
      await loadSavedMatches();
    }
  };

  // Show confirmation before removing
  const handleRemoveSavedMatch = async (matchId: number) => {
    const candidate = savedMatches.find(m => m.id === matchId) || null;
    setDeleteCandidate(candidate);
    setShowDeleteConfirm(true);
  };

  const confirmRemoveSavedMatch = async () => {
    if (!deleteCandidate) return;
    try {
      await savedMatchesService.removeSavedMatch(deleteCandidate.id, userId);
      await loadSavedMatches();
    } catch (error) {
      console.error('Error removing saved match:', error);
    } finally {
      setShowDeleteConfirm(false);
      setDeleteCandidate(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const day = date.getDate();
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
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
          <Image 
            source={require('../assets/logo_sinfondo.png')} 
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>VBStats</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <View style={styles.iconContainer}>
            <VolleyballIcon size={60} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Mis partidos</Text>
          <Text style={styles.subtitle}>
            Consulta tus partidos guardados y busca uno nuevo con el código de 8 caracteres
          </Text>
        </View>

        {/* Saved Matches Section */}
        {savedMatches.length > 0 && (
          <View style={styles.savedMatchesSection}>
            <View style={styles.savedMatchesHeader}>
              <MaterialCommunityIcons name="history" size={20} color={Colors.text} />
              <Text style={styles.savedMatchesTitle}>Mis Partidos</Text>
              <Text style={styles.savedMatchesCount}>{savedMatches.length}</Text>
            </View>
            
            {savedMatches.map((saved) => (
              <TouchableOpacity
                key={saved.id}
                style={styles.savedMatchCard}
                onPress={() => handleViewSavedMatch(saved)}
                activeOpacity={0.7}
              >
                <View style={styles.savedMatchLeft}>
                  <View style={styles.savedMatchIconContainer}>
                    <MaterialCommunityIcons name="volleyball" size={22} color={Colors.primary} />
                  </View>
                  <View style={styles.savedMatchInfo}>
                    <Text style={styles.savedMatchTeams} numberOfLines={1}>
                      {saved.team_name || 'Equipo'}
                      {saved.opponent ? ` vs ${saved.opponent}` : ''}
                    </Text>
                    <View style={styles.savedMatchMeta}>
                      {saved.date && (
                        <Text style={styles.savedMatchDate}>{formatDate(saved.date)}</Text>
                      )}
                      {(saved.score_home !== null && saved.score_away !== null) && (
                        <Text style={styles.savedMatchScore}>
                          {saved.score_home} - {saved.score_away}
                        </Text>
                      )}
                    </View>
                    <View style={styles.savedMatchCodeRow}>
                      <MaterialCommunityIcons name="qrcode" size={12} color={Colors.textTertiary} />
                      <Text style={styles.savedMatchCodeText}>{saved.share_code}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.savedMatchRight}>
                  <TouchableOpacity
                    style={styles.savedMatchRemoveBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      handleRemoveSavedMatch(saved.id);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons name="close" size={16} color={Colors.textTertiary} />
                  </TouchableOpacity>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textTertiary} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loadingSavedMatches && savedMatches.length === 0 && (
          <View style={styles.savedMatchesLoading}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        )}

        {/* Code Input Section */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Código del partido</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons 
              name="qrcode" 
              size={24} 
              color={code.length === 8 ? Colors.primary : Colors.textTertiary} 
            />
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={handleCodeChange}
              placeholder="XXXXXXXX"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              editable={!isLoading}
            />
            {code.length > 0 && (
              <TouchableOpacity onPress={() => setCode('')}>
                <MaterialCommunityIcons name="close-circle" size={20} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.codeProgress}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((index: number) => (
              <View 
                key={index} 
                style={[
                  styles.codeProgressDot,
                  index < code.length && styles.codeProgressDotFilled
                ]} 
              />
            ))}
          </View>

          <TouchableOpacity
            style={[
              styles.searchButton,
              (code.length < 8 || isLoading) && styles.searchButtonDisabled
            ]}
            onPress={handleSearch}
            disabled={code.length < 8 || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="magnify" size={20} color="#fff" />
                <Text style={styles.searchButtonText}>Buscar Partido</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Found Match Card */}
        {foundMatch && (
          <View style={styles.matchCard}>
            <View style={styles.matchCardHeader}>
              <MaterialCommunityIcons name="check-circle" size={24} color="#22c55e" />
              <Text style={styles.matchFoundText}>¡Partido encontrado!</Text>
            </View>

            <View style={styles.matchInfo}>
              <Text style={styles.matchTeams}>
                {foundMatch.team_name || 'Equipo'}
                {foundMatch.opponent ? ` vs ${foundMatch.opponent}` : ''}
              </Text>
              
              <View style={styles.matchDetails}>
                <View style={styles.matchDetailRow}>
                  <MaterialCommunityIcons name="calendar" size={16} color={Colors.textSecondary} />
                  <Text style={styles.matchDetailText}>{formatDate(foundMatch.date)}</Text>
                </View>
                
                {(foundMatch.score_home !== null && foundMatch.score_away !== null) && (
                  <View style={styles.matchDetailRow}>
                    <MaterialCommunityIcons name="scoreboard" size={16} color={Colors.textSecondary} />
                    <Text style={styles.matchDetailText}>
                      {foundMatch.score_home} - {foundMatch.score_away}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={styles.viewMatchButton}
              onPress={handleViewMatch}
            >
              <Text style={styles.viewMatchButtonText}>Ver Estadísticas</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Info Section */}
        <View style={styles.infoSection}>
          <MaterialCommunityIcons name="information-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.infoText}>
            El código de partido se genera al compartir el informe de estadísticas desde la app. 
            Pídelo al entrenador o responsable del equipo.
          </Text>
        </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Error Alert */}
      <CustomAlert
        visible={showErrorAlert}
        title="Código no encontrado"
        message={errorMessage}
        type="error"
        icon={<MaterialCommunityIcons name="magnify-close" size={32} color={Colors.error} />}
        buttons={[
          {
            text: 'Entendido',
            onPress: () => setShowErrorAlert(false),
            style: 'primary',
          },
        ]}
        onClose={() => setShowErrorAlert(false)}
      />

      {/* Delete confirmation */}
      <CustomAlert
        visible={showDeleteConfirm}
        title="Eliminar partido"
        message={deleteCandidate ? `¿Eliminar ${deleteCandidate.team_name || 'este partido'} (${deleteCandidate.share_code}) de Mis partidos? Esta acción elimina el partido sólo de tu cuenta.` : '¿Eliminar este partido?'}
        type="warning"
        icon={<MaterialCommunityIcons name="delete" size={32} color={Colors.error} />}
        buttons={[
          {
            text: 'Cancelar',
            onPress: () => {
              setShowDeleteConfirm(false);
              setDeleteCandidate(null);
            },
            style: 'cancel',
          },
          {
            text: 'Eliminar',
            onPress: confirmRemoveSavedMatch,
            style: 'destructive',
          },
        ]}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteCandidate(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: SAFE_AREA_TOP,
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
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.lg,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  inputLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  codeInput: {
    flex: 1,
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 4,
    textAlign: 'center',
  },
  codeProgress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  codeProgressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  codeProgressDotFilled: {
    backgroundColor: Colors.primary,
  },
  searchButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  matchCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: '#22c55e',
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  matchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  matchFoundText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#22c55e',
  },
  matchInfo: {
    marginBottom: Spacing.md,
  },
  matchTeams: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  matchDetails: {
    gap: Spacing.xs,
  },
  matchDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  matchDetailText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  viewMatchButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  viewMatchButtonText: {
    color: '#fff',
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  infoText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  savedMatchesSection: {
    marginBottom: Spacing.xl,
  },
  savedMatchesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  savedMatchesTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  savedMatchesCount: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.primary,
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  savedMatchCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.sm,
  },
  savedMatchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.md,
  },
  savedMatchIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  savedMatchInfo: {
    flex: 1,
  },
  savedMatchTeams: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  savedMatchMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 2,
  },
  savedMatchDate: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  savedMatchScore: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.text,
    backgroundColor: Colors.backgroundLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  savedMatchCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savedMatchCodeText: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
  savedMatchRight: {
    alignItems: 'center',
    gap: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  savedMatchRemoveBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: Colors.backgroundLight,
  },
  savedMatchesLoading: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
});
