/**
 * Stat templates and helpers for basic/advanced configurations
 */

import type { StatSetting } from './types';

export type Position = 'Receptor' | 'Opuesto' | 'Colocador' | 'Central' | 'Líbero';

export interface StatConfig {
  category: string;
  types: string[];
  icon: string;
  color: string;
}

export const POSITION_STATS: Record<Position, StatConfig[]> = {
  'Receptor': [
    { category: 'Recepción', types: ['Doble positivo', 'Positivo', 'Neutro', 'Error'], icon: 'reception', color: '#3b82f6' },
    { category: 'Ataque', types: ['Positivo', 'Neutro', 'Error'], icon: 'attack', color: '#f59e0b' },
    { category: 'Bloqueo', types: ['Positivo', 'Neutro', 'Error'], icon: 'block', color: '#10b981' },
    { category: 'Saque', types: ['Punto directo', 'Positivo', 'Neutro', 'Error'], icon: 'serve', color: '#8b5cf6' },
    { category: 'Defensa', types: ['Positivo', 'Error'], icon: 'defense', color: '#ef4444' },
    { category: 'Colocación', types: ['Positivo', 'Error'], icon: 'set', color: '#06b6d4' },
  ],
  'Opuesto': [
    { category: 'Recepción', types: ['Doble positivo', 'Positivo', 'Neutro', 'Error'], icon: 'reception', color: '#3b82f6' },
    { category: 'Ataque', types: ['Positivo', 'Neutro', 'Error'], icon: 'attack', color: '#f59e0b' },
    { category: 'Bloqueo', types: ['Positivo', 'Neutro', 'Error'], icon: 'block', color: '#10b981' },
    { category: 'Saque', types: ['Punto directo', 'Positivo', 'Neutro', 'Error'], icon: 'serve', color: '#8b5cf6' },
    { category: 'Defensa', types: ['Positivo', 'Error'], icon: 'defense', color: '#ef4444' },
    { category: 'Colocación', types: ['Positivo', 'Error'], icon: 'set', color: '#06b6d4' },
  ],
  'Colocador': [
    { category: 'Recepción', types: ['Doble positivo', 'Positivo', 'Neutro', 'Error'], icon: 'reception', color: '#3b82f6' },
    { category: 'Ataque', types: ['Positivo', 'Neutro', 'Error'], icon: 'attack', color: '#f59e0b' },
    { category: 'Bloqueo', types: ['Positivo', 'Neutro', 'Error'], icon: 'block', color: '#10b981' },
    { category: 'Saque', types: ['Punto directo', 'Positivo', 'Neutro', 'Error'], icon: 'serve', color: '#8b5cf6' },
    { category: 'Defensa', types: ['Positivo', 'Error'], icon: 'defense', color: '#ef4444' },
    { category: 'Colocación', types: ['Positivo', 'Error'], icon: 'set', color: '#06b6d4' },
  ],
  'Central': [
    { category: 'Recepción', types: ['Doble positivo', 'Positivo', 'Neutro', 'Error'], icon: 'reception', color: '#3b82f6' },
    { category: 'Ataque', types: ['Positivo', 'Neutro', 'Error'], icon: 'attack', color: '#f59e0b' },
    { category: 'Bloqueo', types: ['Positivo', 'Neutro', 'Error'], icon: 'block', color: '#10b981' },
    { category: 'Saque', types: ['Punto directo', 'Positivo', 'Neutro', 'Error'], icon: 'serve', color: '#8b5cf6' },
    { category: 'Defensa', types: ['Positivo', 'Error'], icon: 'defense', color: '#ef4444' },
    { category: 'Colocación', types: ['Positivo', 'Error'], icon: 'set', color: '#06b6d4' },
  ],
  'Líbero': [
    { category: 'Recepción', types: ['Doble positivo', 'Positivo', 'Neutro', 'Error'], icon: 'reception', color: '#3b82f6' },
    { category: 'Defensa', types: ['Positivo', 'Error'], icon: 'defense', color: '#ef4444' },
    { category: 'Colocación', types: ['Positivo', 'Error'], icon: 'set', color: '#06b6d4' },
  ],
};

const BASIC_RECEPCION_POSITIONS: Position[] = ['Receptor', 'Líbero'];
const BASIC_DISABLED_CATEGORIES = ['Defensa', 'Colocación'];
const BASIC_ENABLED_BY_CATEGORY: Record<string, string[]> = {
  'Recepción': ['Doble positivo', 'Positivo', 'Neutro', 'Error'],
  'Ataque': ['Positivo', 'Error'],
  'Bloqueo': ['Positivo'],
  'Saque': ['Punto directo', 'Error'],
};

export type TemplateMode = 'basic' | 'advanced' | 'custom';

export class StatTemplates {
  static detectTemplate(settings: StatSetting[]): TemplateMode {
    const settingsMap = StatTemplates.buildSettingsMap(settings);
    const advancedMap = StatTemplates.buildTemplateMap('advanced');
    const basicMap = StatTemplates.buildTemplateMap('basic');

    const matchesAdvanced = StatTemplates.isMapMatch(settingsMap, advancedMap);
    if (matchesAdvanced) return 'advanced';

    const matchesBasic = StatTemplates.isMapMatch(settingsMap, basicMap);
    if (matchesBasic) return 'basic';

    return 'custom';
  }

  static buildTemplateMap(mode: 'basic' | 'advanced') {
    const map: Record<string, boolean> = {};

    Object.entries(POSITION_STATS).forEach(([position, configs]) => {
      configs.forEach((stat) => {
        stat.types.forEach((type) => {
          const key = `${position}|${stat.category}|${type}`;
          const enabled = mode === 'advanced'
            ? true
            : StatTemplates.isBasicEnabled(stat.category, type, position as Position);
          map[key] = enabled;
        });
      });
    });

    return map;
  }

  private static buildSettingsMap(settings: StatSetting[]) {
    const map: Record<string, boolean> = {};
    settings.forEach((setting) => {
      const key = `${setting.position}|${setting.stat_category}|${setting.stat_type}`;
      map[key] = !!setting.enabled;
    });
    return map;
  }

  private static isMapMatch(actual: Record<string, boolean>, expected: Record<string, boolean>) {
    const expectedKeys = Object.keys(expected);
    if (expectedKeys.length === 0) return false;

    for (const key of expectedKeys) {
      if (!(key in actual)) return false;
      if (actual[key] !== expected[key]) return false;
    }

    return true;
  }

  private static isBasicEnabled(category: string, type: string, position: Position) {
    if (BASIC_DISABLED_CATEGORIES.includes(category)) {
      return false;
    }

    if (category === 'Recepción' && !BASIC_RECEPCION_POSITIONS.includes(position)) {
      return false;
    }

    const enabledTypes = BASIC_ENABLED_BY_CATEGORY[category] || [];
    return enabledTypes.includes(type);
  }
}
