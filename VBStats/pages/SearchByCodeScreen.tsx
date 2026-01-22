/**
 * Pantalla de búsqueda de partido por código
 * Vista moderna para cuentas gratuitas
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Platform,
  StatusBar,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';
import { CustomAlert } from '../components';
import { MenuIcon, VolleyballIcon } from '../components/VectorIcons';
import { subscriptionService } from '../services/subscriptionService';
import { matchesService } from '../services/api';
import type { Match } from '../services/types';

// Safe area paddings para Android
const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;
const ANDROID_NAV_BAR_HEIGHT = 48;

interface SearchByCodeScreenProps {
  onOpenMenu?: () => void;
  onMatchFound?: (match: Match) => void;
}

export default function SearchByCodeScreen({ 
  onOpenMenu,
  onMatchFound
}: SearchByCodeScreenProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [foundMatch, setFoundMatch] = useState<Match | null>(null);

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
        setFoundMatch(match);
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
    <SafeAreaView style={styles.container}>
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
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <View style={styles.iconContainer}>
            <VolleyballIcon size={60} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Buscar Partido</Text>
          <Text style={styles.subtitle}>
            Introduce el código de 8 caracteres para ver las estadísticas del partido
          </Text>
        </View>

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
    marginTop: 'auto',
  },
  infoText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
