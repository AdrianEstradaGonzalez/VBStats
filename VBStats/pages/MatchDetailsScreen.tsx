/**
 * Pantalla para rellenar los datos básicos del partido
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';
import { MenuIcon, PlayIcon } from '../components/VectorIcons';

// Safe area paddings para Android
const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;
const ANDROID_NAV_BAR_HEIGHT = 48;

interface MatchDetailsScreenProps {
  onBack?: () => void;
  onOpenMenu?: () => void;
  onStartMatch?: (matchDetails: MatchDetails) => void;
  teamId: number;
  teamName: string;
}

export interface MatchDetails {
  teamId: number;
  teamName: string;
  rivalTeam: string;
  date: Date;
  isHome: boolean;
}

export default function MatchDetailsScreen({ 
  onBack, 
  onOpenMenu, 
  onStartMatch,
  teamId,
  teamName 
}: MatchDetailsScreenProps) {
  const [rivalTeam, setRivalTeam] = useState('');
  const [matchDate, setMatchDate] = useState(new Date());
  const [isHome, setIsHome] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleStartMatch = () => {
    if (!rivalTeam.trim()) {
      Alert.alert('Error', 'Por favor ingresa el nombre del equipo rival');
      return;
    }

    const matchDetails: MatchDetails = {
      teamId,
      teamName,
      rivalTeam: rivalTeam.trim(),
      date: matchDate,
      isHome,
    };

    onStartMatch?.(matchDetails);
  };

  const formatDate = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setMatchDate(selectedDate);
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
          <Text style={styles.headerTitle}>Datos del Partido</Text>
        </View>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionDescription}>
            Completa los datos del partido para comenzar
          </Text>
        </View>

        {/* Tu equipo */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Tu Equipo</Text>
          <View style={styles.readOnlyInput}>
            <Text style={styles.readOnlyText}>{teamName}</Text>
          </View>
        </View>

        {/* Equipo rival */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Equipo Rival</Text>
          <TextInput
            style={styles.readOnlyInput}
            value={rivalTeam}
            onChangeText={setRivalTeam}
            placeholder="Nombre del equipo rival"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        {/* Fecha */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Fecha del Partido</Text>
          <TouchableOpacity
            style={styles.readOnlyInput}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.readOnlyText}>{formatDate(matchDate)}</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>Toca para cambiar la fecha</Text>
        </View>
        
        {showDatePicker && (
          <DateTimePicker
            value={matchDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            onTouchCancel={() => setShowDatePicker(false)}
          />
        )}

        {/* Local/Visitante */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Ubicación</Text>
          <View style={styles.locationButtons}>
            <TouchableOpacity
              style={[styles.locationButton, isHome && styles.locationButtonActive]}
              onPress={() => setIsHome(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.locationButtonText, isHome && styles.locationButtonTextActive]}>
                Local
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.locationButton, !isHome && styles.locationButtonActive]}
              onPress={() => setIsHome(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.locationButtonText, !isHome && styles.locationButtonTextActive]}>
                Visitante
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Botón comenzar */}
        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStartMatch}
          activeOpacity={0.7}
        >
          <PlayIcon size={20} color={Colors.textOnPrimary} />
          <Text style={styles.startButtonText}>Comenzar Partido</Text>
        </TouchableOpacity>
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
    marginBottom: Spacing.xl,
  },
  sectionDescription: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  readOnlyInput: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  readOnlyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  hint: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  locationButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  locationButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  locationButtonActive: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  locationButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  locationButtonTextActive: {
    color: Colors.primary,
  },
  startButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    gap: Spacing.sm,
    ...Shadows.md,
  },
  startButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
});
