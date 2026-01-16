/**
 * Pantalla de Configuración de Estadísticas
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';
import { 
  MenuIcon, 
  SettingsIcon,
  ChevronRightIcon,
  TeamIcon,
  ReceptionIcon,
  AttackIcon,
  BlockIcon,
  ServeIcon,
  DefenseIcon,
  SetIcon,
  WarningIcon,
  DoublePlusIcon,
  PlusIcon,
  MinusIcon,
  XIcon,
  TickIcon,
  TargetIcon,
  StatsIcon,
} from '../components/VectorIcons';
import { CustomAlert, CustomAlertButton } from '../components';
import { settingsService, StatSetting } from '../services/api';

interface SettingsScreenProps {
  onBack?: () => void;
  onOpenMenu?: () => void;
  userId?: number | null;
}

type Position = 'Receptor' | 'Opuesto' | 'Colocador' | 'Central' | 'Líbero';

interface StatConfig {
  category: string;
  types: string[];
  icon: string;
  color: string;
}

const POSITION_STATS: Record<Position, StatConfig[]> = {
  'Receptor': [
    { category: 'Recepción', types: ['Doble positiva', 'Positiva', 'Neutra', 'Error'], icon: 'reception', color: '#3b82f6' },
    { category: 'Ataque', types: ['Punto de ataque', 'Neutro', 'Error'], icon: 'attack', color: '#f59e0b' },
    { category: 'Bloqueo', types: ['Punto de bloqueo', 'Neutro', 'Error'], icon: 'block', color: '#10b981' },
    { category: 'Saque', types: ['Punto directo', 'Positivo', 'Neutro', 'Error'], icon: 'serve', color: '#8b5cf6' },
    { category: 'Defensa', types: ['Positiva', 'Error'], icon: 'defense', color: '#ef4444' },
    { category: 'Colocación', types: ['Positiva', 'Error'], icon: 'set', color: '#06b6d4' },
  ],
  'Opuesto': [
    { category: 'Recepción', types: ['Doble positiva', 'Positiva', 'Neutra', 'Error'], icon: 'reception', color: '#3b82f6' },
    { category: 'Ataque', types: ['Punto de ataque', 'Neutro', 'Error'], icon: 'attack', color: '#f59e0b' },
    { category: 'Bloqueo', types: ['Punto de bloqueo', 'Neutro', 'Error'], icon: 'block', color: '#10b981' },
    { category: 'Saque', types: ['Punto directo', 'Positivo', 'Neutro', 'Error'], icon: 'serve', color: '#8b5cf6' },
    { category: 'Defensa', types: ['Positiva', 'Error'], icon: 'defense', color: '#ef4444' },
    { category: 'Colocación', types: ['Positiva', 'Error'], icon: 'set', color: '#06b6d4' },
  ],
  'Colocador': [
    { category: 'Recepción', types: ['Doble positiva', 'Positiva', 'Neutra', 'Error'], icon: 'reception', color: '#3b82f6' },
    { category: 'Ataque', types: ['Punto de ataque', 'Neutro', 'Error'], icon: 'attack', color: '#f59e0b' },
    { category: 'Bloqueo', types: ['Punto de bloqueo', 'Neutro', 'Error'], icon: 'block', color: '#10b981' },
    { category: 'Saque', types: ['Punto directo', 'Positivo', 'Neutro', 'Error'], icon: 'serve', color: '#8b5cf6' },
    { category: 'Defensa', types: ['Positiva', 'Error'], icon: 'defense', color: '#ef4444' },
    { category: 'Colocación', types: ['Positiva', 'Error'], icon: 'set', color: '#06b6d4' },
  ],
  'Central': [
    { category: 'Recepción', types: ['Doble positiva', 'Positiva', 'Neutra', 'Error'], icon: 'reception', color: '#3b82f6' },
    { category: 'Ataque', types: ['Punto de ataque', 'Neutro', 'Error'], icon: 'attack', color: '#f59e0b' },
    { category: 'Bloqueo', types: ['Punto de bloqueo', 'Neutro', 'Error'], icon: 'block', color: '#10b981' },
    { category: 'Saque', types: ['Punto directo', 'Positivo', 'Neutro', 'Error'], icon: 'serve', color: '#8b5cf6' },
    { category: 'Defensa', types: ['Positiva', 'Error'], icon: 'defense', color: '#ef4444' },
    { category: 'Colocación', types: ['Positiva', 'Error'], icon: 'set', color: '#06b6d4' },
  ],
  'Líbero': [
    { category: 'Recepción', types: ['Doble positiva', 'Positiva', 'Neutra', 'Error'], icon: 'reception', color: '#3b82f6' },
    { category: 'Defensa', types: ['Positiva', 'Error'], icon: 'defense', color: '#ef4444' },
    { category: 'Colocación', types: ['Positiva', 'Error'], icon: 'set', color: '#06b6d4' },
  ],
};

const POSITIONS: Position[] = ['Receptor', 'Opuesto', 'Colocador', 'Central', 'Líbero'];

export default function SettingsScreen({ onBack, onOpenMenu, userId }: SettingsScreenProps) {
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [originalSettings, setOriginalSettings] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showUnsavedAlert, setShowUnsavedAlert] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);

  useEffect(() => {
    if (selectedPosition) {
      loadPositionSettings(selectedPosition);
    }
  }, [selectedPosition]);

  const loadPositionSettings = async (position: Position) => {
    setLoading(true);
    try {
      let positionSettings = await settingsService.getByPosition(position, userId ?? undefined);
      
      // If no settings exist, initialize them
      if (positionSettings.length === 0) {
        positionSettings = await settingsService.initPosition(position, userId ?? undefined);
      }
      
      // Convert to key-value map with default true
      // MySQL returns BOOLEAN as 0/1, so we need to explicitly convert
      const settingsMap: Record<string, boolean> = {};
      positionSettings.forEach(setting => {
        const key = `${setting.stat_category}|${setting.stat_type}`;
        // Force strict boolean: convert any truthy/falsy to true/false
        const enabledValue = setting.enabled == null ? true : !!(setting.enabled);
        settingsMap[key] = enabledValue === true; // Ensure it's exactly true or false
      });
      
      console.log('Loaded settings for', position, ':', settingsMap);
      
      setSettings(settingsMap);
      setOriginalSettings(settingsMap);
    } catch (error) {
      console.error('Error loading settings:', error);
      Alert.alert('Error', 'No se pudieron cargar las configuraciones');
    } finally {
      setLoading(false);
    }
  };

  const hasUnsavedChanges = () => {
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  };

  const handleBackPress = () => {
    if (hasUnsavedChanges()) {
      setShowUnsavedAlert(true);
    } else {
      setSelectedPosition(null);
    }
  };

  const handleDiscardChanges = () => {
    setShowUnsavedAlert(false);
    setSelectedPosition(null);
    setSettings({});
    setOriginalSettings({});
  };

  const toggleSetting = (category: string, type: string) => {
    const key = `${category}|${type}`;
    setSettings(prev => {
      const currentValue = prev[key];
      const newValue = currentValue === true ? false : true; // Strict boolean toggle
      return {
        ...prev,
        [key]: newValue,
      };
    });
  };

  const toggleAllSettings = (enable: boolean) => {
    if (!selectedPosition) return;
    
    const newSettings: Record<string, boolean> = {};
    POSITION_STATS[selectedPosition].forEach(statConfig => {
      statConfig.types.forEach(type => {
        const key = `${statConfig.category}|${type}`;
        newSettings[key] = enable;
      });
    });
    setSettings(newSettings);
  };

  const toggleCategorySettings = (category: string, enable: boolean) => {
    if (!selectedPosition) return;
    
    const categoryStats = POSITION_STATS[selectedPosition].find(s => s.category === category);
    if (!categoryStats) return;

    setSettings(prev => {
      const newSettings = { ...prev };
      categoryStats.types.forEach(type => {
        const key = `${category}|${type}`;
        newSettings[key] = enable;
      });
      return newSettings;
    });
  };

  const areAllEnabled = () => {
    if (!selectedPosition) return false;
    return POSITION_STATS[selectedPosition].every(statConfig =>
      statConfig.types.every(type => {
        const key = `${statConfig.category}|${type}`;
        // Use default true if the setting hasn't been loaded/created yet
        const rawValue = settings.hasOwnProperty(key) ? settings[key] : true;
        return rawValue === true;
      })
    );
  };

  const isCategoryEnabled = (category: string) => {
    if (!selectedPosition) return false;
    const categoryStats = POSITION_STATS[selectedPosition].find(s => s.category === category);
    if (!categoryStats) return false;
    return categoryStats.types.every(type => {
      const key = `${category}|${type}`;
      // Use default value of true if key doesn't exist, same as individual switches
      const rawValue = settings.hasOwnProperty(key) ? settings[key] : true;
      return rawValue === true;
    });
  };

  const saveSettings = async () => {
    if (!selectedPosition) return;
    
    setSaving(true);
    try {
      const settingsArray = Object.entries(settings).map(([key, enabled]) => {
        const [category, type] = key.split('|');
        return {
          position: selectedPosition,
          stat_category: category,
          stat_type: type,
          enabled: Boolean(enabled), // Ensure it's a boolean
          user_id: userId ?? undefined,
        };
      });
      
      await settingsService.batchUpdate(settingsArray, userId ?? undefined);
      setOriginalSettings(settings);
      setShowSuccessAlert(true);
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'No se pudieron guardar las configuraciones');
    } finally {
      setSaving(false);
    }
  };

  const renderStatIcon = (iconName: string, color: string) => {
    const iconSize = 20;
    return <StatsIcon size={iconSize} color={color} />;
  };

  const renderStatTypeIcon = (type: string, color: string) => {
    const iconSize = 16;
    const normalizedType = type.toLowerCase();
    
    // Doble positivo = icono de doble plus
    if (normalizedType.includes('doble positiva') || normalizedType.includes('doble positivo') || normalizedType.includes('++')) {
      return <MaterialCommunityIcons name="plus-circle-multiple" size={iconSize} color={color} />;
    }
    // Punto directo = Diana/Bullseye
    if (normalizedType.includes('punto directo') || normalizedType.includes('ace')) {
      return <MaterialCommunityIcons name="bullseye-arrow" size={iconSize} color={color} />;
    }
    // Positivo = Plus circle
    if (normalizedType.includes('positiv') || normalizedType.includes('+') || normalizedType.includes('punto')) {
      return <MaterialCommunityIcons name="plus-circle" size={iconSize} color={color} />;
    }
    // Neutro = Minus circle
    if (normalizedType.includes('neutr')) {
      return <MaterialCommunityIcons name="minus-circle" size={iconSize} color={color} />;
    }
    // Error = Close circle
    if (normalizedType.includes('error')) {
      return <MaterialCommunityIcons name="close-circle" size={iconSize} color={color} />;
    }
    
    return <MaterialCommunityIcons name="circle-outline" size={iconSize} color={color} />;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={onOpenMenu}>
          <MenuIcon size={28} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <SettingsIcon size={24} color={Colors.primary} />
          <Text style={styles.headerTitle}>
            {selectedPosition ? selectedPosition : 'Configuración'}
          </Text>
        </View>
        {selectedPosition ? (
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      {!selectedPosition ? (
        // Position selection
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Selecciona una posición</Text>
            <Text style={styles.sectionDescription}>
              Configura qué estadísticas deseas contabilizar para cada posición
            </Text>
          </View>

          {POSITIONS.map((position) => (
            <TouchableOpacity
              key={position}
              style={styles.positionCard}
              onPress={() => setSelectedPosition(position)}
              activeOpacity={0.7}
            >
              <View style={styles.positionInfo}>
                <View style={styles.positionIconContainer}>
                  <TeamIcon size={24} color={Colors.primary} />
                </View>
                <View style={styles.positionTextContainer}>
                  <Text style={styles.positionName}>{position}</Text>
                  <Text style={styles.positionStats}>
                    {POSITION_STATS[position].length} categorías de estadísticas
                  </Text>
                </View>
              </View>
              <ChevronRightIcon size={24} color={Colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        // Stat configuration for selected position
        <View style={styles.contentContainer}>
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Cargando configuración...</Text>
            </View>
          ) : (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionDescription}>
                  Activa o desactiva las estadísticas que deseas contabilizar para {selectedPosition}es
                </Text>
              </View>

              {/* Toggle All Switch */}
              <View style={styles.toggleAllCard}>
                <View style={styles.toggleAllContent}>
                  <Text style={styles.toggleAllText}>Activar/Desactivar Todo</Text>
                  <Switch
                    value={areAllEnabled()}
                    onValueChange={toggleAllSettings}
                    trackColor={{ false: '#3a3a3a', true: Colors.primary + '60' }}
                    thumbColor={areAllEnabled() ? Colors.primary : '#767577'}
                    ios_backgroundColor="#3a3a3a"
                  />
                </View>
              </View>

              {POSITION_STATS[selectedPosition].map((statConfig) => (
                <View key={statConfig.category} style={styles.statCategoryCard}>
                  <View style={styles.categoryHeader}>
                    <View style={styles.categoryHeaderLeft}>
                      <View style={[styles.categoryIcon, { backgroundColor: statConfig.color + '20' }]}>
                        {renderStatIcon(statConfig.icon, statConfig.color)}
                      </View>
                      <Text style={styles.categoryName}>{statConfig.category}</Text>
                    </View>
                    <Switch
                      value={isCategoryEnabled(statConfig.category)}
                      onValueChange={(value) => toggleCategorySettings(statConfig.category, value)}
                      trackColor={{ false: '#3a3a3a', true: statConfig.color + '60' }}
                      thumbColor={isCategoryEnabled(statConfig.category) ? statConfig.color : '#767577'}
                      ios_backgroundColor="#3a3a3a"
                    />
                  </View>

                  {statConfig.types.map((type) => {
                    const key = `${statConfig.category}|${type}`;
                    // Ensure we always have a strict boolean value - default to true if not in settings
                    const rawValue = settings.hasOwnProperty(key) ? settings[key] : true;
                    const isEnabled = rawValue === true; // Strict comparison to true

                    return (
                      <View key={type} style={styles.statTypeRow}>
                        <View style={styles.statTypeInfo}>
                          <View style={[styles.typeIconContainer, { backgroundColor: statConfig.color + '15' }]}>
                            {renderStatTypeIcon(type, statConfig.color)}
                          </View>
                          <Text style={styles.statTypeName}>{type}</Text>
                        </View>
                        <Switch
                          value={isEnabled}
                          onValueChange={() => toggleSetting(statConfig.category, type)}
                          trackColor={{ false: '#3a3a3a', true: statConfig.color + '60' }}
                          thumbColor={isEnabled ? statConfig.color : '#767577'}
                          ios_backgroundColor="#3a3a3a"
                        />
                      </View>
                    );
                  })}
                </View>
              ))}
              </>
            )}
          </ScrollView>

          {/* Fixed Save Button Footer */}
          {!loading && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.saveButton, (saving || !hasUnsavedChanges()) && styles.saveButtonDisabled]}
                onPress={saveSettings}
                disabled={saving || !hasUnsavedChanges()}
                activeOpacity={0.7}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.textOnPrimary} />
                ) : (
                  <Text style={styles.saveButtonText}>Guardar Configuración</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Unsaved Changes Alert */}
      <CustomAlert
        visible={showUnsavedAlert}
        icon={<WarningIcon size={48} color={Colors.warning} />}
        iconBackgroundColor={Colors.warning + '15'}
        title="¿Salir sin guardar?"
        message="Tienes cambios sin guardar en la configuración de estadísticas."
        warning="Si sales ahora, perderás todos los cambios realizados."
        buttons={[
          {
            text: 'Cancelar',
            onPress: () => setShowUnsavedAlert(false),
            style: 'cancel',
          },
          {
            text: 'Salir',
            onPress: handleDiscardChanges,
            style: 'destructive',
          },
        ]}
      />

      {/* Success Alert */}
      <CustomAlert
        visible={showSuccessAlert}
        icon={<TickIcon size={48} color={Colors.success} />}
        iconBackgroundColor={Colors.success + '15'}
        title="¡Configuración guardada!"
        message="Tus preferencias de estadísticas han sido actualizadas correctamente."
        buttons={[
          {
            text: 'Aceptar',
            onPress: () => setShowSuccessAlert(false),
            style: 'primary',
          },
        ]}
        type="success"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    width: 60,
  },
  backButton: {
    padding: Spacing.sm,
  },
  backButtonText: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  sectionDescription: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  positionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  positionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  positionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  positionTextContainer: {
    flex: 1,
  },
  positionName: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  positionStats: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
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
  toggleAllCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  toggleAllContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleAllText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  statCategoryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  categoryName: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  statTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '40',
  },
  statTypeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.md,
  },
  typeIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  statTypeName: {
    fontSize: FontSizes.md,
    color: Colors.text,
    flex: 1,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    ...Shadows.md,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: Colors.textOnPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
});
