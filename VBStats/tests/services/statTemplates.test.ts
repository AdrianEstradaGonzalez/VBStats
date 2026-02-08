/**
 * Tests for Stat Templates
 *
 * Covers: position stat configuration, template detection (basic/advanced/custom),
 * template map building, basic-enabled logic per position.
 */

import {
  POSITION_STATS,
  StatTemplates,
  Position,
} from '../../services/statTemplates';
import type { StatSetting } from '../../services/types';

// ─── Position stat definitions ───────────────────────────────────────

describe('POSITION_STATS configuration', () => {
  const ALL_POSITIONS: Position[] = ['Receptor', 'Opuesto', 'Colocador', 'Central', 'Líbero'];

  test('all 5 positions are defined', () => {
    expect(Object.keys(POSITION_STATS)).toHaveLength(5);
    ALL_POSITIONS.forEach(pos => {
      expect(POSITION_STATS[pos]).toBeDefined();
    });
  });

  test('each full position has 6 stat categories', () => {
    const fullPositions: Position[] = ['Receptor', 'Opuesto', 'Colocador', 'Central'];
    fullPositions.forEach(pos => {
      expect(POSITION_STATS[pos]).toHaveLength(6);
    });
  });

  test('Líbero has only 3 categories (Recepción, Defensa, Colocación)', () => {
    const libero = POSITION_STATS['Líbero'];
    expect(libero).toHaveLength(3);
    const categories = libero.map(s => s.category);
    expect(categories).toEqual(['Recepción', 'Defensa', 'Colocación']);
  });

  test('Recepción always has 4 types including Doble positivo', () => {
    const ALL_POS_WITH_REC = ALL_POSITIONS; // All have Recepción
    ALL_POS_WITH_REC.forEach(pos => {
      const rec = POSITION_STATS[pos].find(s => s.category === 'Recepción');
      if (rec) {
        expect(rec.types).toContain('Doble positivo');
        expect(rec.types).toHaveLength(4);
      }
    });
  });

  test('Saque has 4 types including Punto directo', () => {
    const posWithServe = ['Receptor', 'Opuesto', 'Colocador', 'Central'] as Position[];
    posWithServe.forEach(pos => {
      const saque = POSITION_STATS[pos].find(s => s.category === 'Saque');
      expect(saque).toBeDefined();
      expect(saque!.types).toContain('Punto directo');
      expect(saque!.types).toHaveLength(4);
    });
  });

  test('each stat config has icon and color', () => {
    ALL_POSITIONS.forEach(pos => {
      POSITION_STATS[pos].forEach(config => {
        expect(config.icon).toBeDefined();
        expect(config.color).toMatch(/^#[0-9a-f]{6}$/);
      });
    });
  });
});

// ─── Template map building ───────────────────────────────────────────

describe('StatTemplates.buildTemplateMap', () => {
  test('advanced template has all entries set to true', () => {
    const map = StatTemplates.buildTemplateMap('advanced');
    const entries = Object.entries(map);
    expect(entries.length).toBeGreaterThan(0);
    entries.forEach(([key, value]) => {
      expect(value).toBe(true);
    });
  });

  test('basic template disables Defensa and Colocación', () => {
    const map = StatTemplates.buildTemplateMap('basic');
    // All Defensa entries should be false
    Object.entries(map).forEach(([key, value]) => {
      if (key.includes('|Defensa|')) {
        expect(value).toBe(false);
      }
      if (key.includes('|Colocación|')) {
        expect(value).toBe(false);
      }
    });
  });

  test('basic template enables Recepción only for Receptor and Líbero', () => {
    const map = StatTemplates.buildTemplateMap('basic');
    // Receptor|Recepción should be true
    expect(map['Receptor|Recepción|Positivo']).toBe(true);
    // Líbero|Recepción should be true
    expect(map['Líbero|Recepción|Positivo']).toBe(true);
    // Opuesto|Recepción should be false (not in BASIC_RECEPCION_POSITIONS)
    expect(map['Opuesto|Recepción|Positivo']).toBe(false);
    // Central|Recepción should be false
    expect(map['Central|Recepción|Positivo']).toBe(false);
  });

  test('basic template allows only specific Ataque types', () => {
    const map = StatTemplates.buildTemplateMap('basic');
    // Ataque Positivo and Error should be true for all non-Líbero (Líbero has no Ataque)
    expect(map['Receptor|Ataque|Positivo']).toBe(true);
    expect(map['Receptor|Ataque|Error']).toBe(true);
    // Ataque Neutro should be false
    expect(map['Receptor|Ataque|Neutro']).toBe(false);
  });

  test('basic template allows only Bloqueo Positivo', () => {
    const map = StatTemplates.buildTemplateMap('basic');
    expect(map['Receptor|Bloqueo|Positivo']).toBe(true);
    expect(map['Receptor|Bloqueo|Neutro']).toBe(false);
    expect(map['Receptor|Bloqueo|Error']).toBe(false);
  });

  test('basic template allows Saque Punto directo and Error', () => {
    const map = StatTemplates.buildTemplateMap('basic');
    expect(map['Receptor|Saque|Punto directo']).toBe(true);
    expect(map['Receptor|Saque|Error']).toBe(true);
    expect(map['Receptor|Saque|Positivo']).toBe(false);
    expect(map['Receptor|Saque|Neutro']).toBe(false);
  });
});

// ─── Template detection ──────────────────────────────────────────────

describe('StatTemplates.detectTemplate', () => {
  function buildSettingsFromMap(map: Record<string, boolean>): StatSetting[] {
    return Object.entries(map).map(([key, enabled], idx) => {
      const [position, stat_category, stat_type] = key.split('|');
      return {
        id: idx + 1,
        position,
        stat_category,
        stat_type,
        enabled,
      };
    });
  }

  test('detects advanced template', () => {
    const advancedMap = StatTemplates.buildTemplateMap('advanced');
    const settings = buildSettingsFromMap(advancedMap);
    expect(StatTemplates.detectTemplate(settings)).toBe('advanced');
  });

  test('detects basic template', () => {
    const basicMap = StatTemplates.buildTemplateMap('basic');
    const settings = buildSettingsFromMap(basicMap);
    expect(StatTemplates.detectTemplate(settings)).toBe('basic');
  });

  test('detects custom template when settings differ from both', () => {
    const advancedMap = StatTemplates.buildTemplateMap('advanced');
    const settings = buildSettingsFromMap(advancedMap);
    // Flip one setting to make it custom
    if (settings.length > 0) {
      settings[0].enabled = !settings[0].enabled;
    }
    expect(StatTemplates.detectTemplate(settings)).toBe('custom');
  });

  test('returns custom for empty settings', () => {
    expect(StatTemplates.detectTemplate([])).toBe('custom');
  });
});
