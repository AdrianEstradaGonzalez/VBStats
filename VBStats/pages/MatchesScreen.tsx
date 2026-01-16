/**
 * Pantalla de partidos
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';

interface Match {
  id: string;
  opponent: string;
  date: string;
  result: 'win' | 'loss';
  score: string;
}

export default function MatchesScreen() {
  const matches: Match[] = [
    { id: '1', opponent: 'Equipo A', date: '15 Ene 2026', result: 'win', score: '3-1' },
    { id: '2', opponent: 'Equipo B', date: '12 Ene 2026', result: 'win', score: '3-0' },
    { id: '3', opponent: 'Equipo C', date: '10 Ene 2026', result: 'loss', score: '1-3' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Partidos</Text>
          <TouchableOpacity style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Nuevo</Text>
          </TouchableOpacity>
        </View>

        {matches.map((match) => (
          <TouchableOpacity key={match.id} style={styles.matchCard}>
            <View style={styles.matchHeader}>
              <Text style={styles.matchDate}>{match.date}</Text>
              <View style={[
                styles.resultBadge,
                match.result === 'win' ? styles.winBadge : styles.lossBadge
              ]}>
                <Text style={styles.resultText}>
                  {match.result === 'win' ? 'Victoria' : 'Derrota'}
                </Text>
              </View>
            </View>
            <Text style={styles.opponentName}>{match.opponent}</Text>
            <Text style={styles.score}>{match.score}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSizes.xxxl,
    fontWeight: '700',
    color: Colors.text,
  },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  addButtonText: {
    color: Colors.textOnPrimary,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  matchCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  matchDate: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  resultBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  winBadge: {
    backgroundColor: Colors.success,
  },
  lossBadge: {
    backgroundColor: Colors.error,
  },
  resultText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  opponentName: {
    fontSize: FontSizes.xl,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  score: {
    fontSize: FontSizes.xxxl,
    fontWeight: '800',
    color: Colors.primary,
  },
});
