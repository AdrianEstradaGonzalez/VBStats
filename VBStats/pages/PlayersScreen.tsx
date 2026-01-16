/**
 * Pantalla de jugadores
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

interface Player {
  id: string;
  name: string;
  position: string;
  number: number;
}

export default function PlayersScreen() {
  const players: Player[] = [
    { id: '1', name: 'Juan Pérez', position: 'Armador', number: 7 },
    { id: '2', name: 'María López', position: 'Opuesto', number: 10 },
    { id: '3', name: 'Carlos Ruiz', position: 'Central', number: 5 },
    { id: '4', name: 'Ana García', position: 'Líbero', number: 1 },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Jugadores</Text>
          <TouchableOpacity style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Agregar</Text>
          </TouchableOpacity>
        </View>

        {players.map((player) => (
          <TouchableOpacity key={player.id} style={styles.playerCard}>
            <View style={styles.numberBadge}>
              <Text style={styles.numberText}>{player.number}</Text>
            </View>
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>{player.name}</Text>
              <Text style={styles.playerPosition}>{player.position}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
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
  playerCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.sm,
  },
  numberBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  numberText: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: Colors.textOnPrimary,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  playerPosition: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  arrow: {
    fontSize: FontSizes.xxxl,
    color: Colors.textTertiary,
  },
});
