/**
 * Stat templates for basic and advanced configurations
 */

const POSITION_STATS = {
  'Receptor': [
    { category: 'Recepción', types: ['Doble positivo', 'Positivo', 'Neutro', 'Error'] },
    { category: 'Ataque', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Bloqueo', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Saque', types: ['Punto directo', 'Positivo', 'Neutro', 'Error'] },
    { category: 'Defensa', types: ['Positivo', 'Error'] },
    { category: 'Colocación', types: ['Positivo', 'Error'] },
  ],
  'Opuesto': [
    { category: 'Recepción', types: ['Doble positivo', 'Positivo', 'Neutro', 'Error'] },
    { category: 'Ataque', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Bloqueo', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Saque', types: ['Punto directo', 'Positivo', 'Neutro', 'Error'] },
    { category: 'Defensa', types: ['Positivo', 'Error'] },
    { category: 'Colocación', types: ['Positivo', 'Error'] },
  ],
  'Colocador': [
    { category: 'Recepción', types: ['Doble positivo', 'Positivo', 'Neutro', 'Error'] },
    { category: 'Ataque', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Bloqueo', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Saque', types: ['Punto directo', 'Positivo', 'Neutro', 'Error'] },
    { category: 'Defensa', types: ['Positivo', 'Error'] },
    { category: 'Colocación', types: ['Positivo', 'Error'] },
  ],
  'Central': [
    { category: 'Recepción', types: ['Doble positivo', 'Positivo', 'Neutro', 'Error'] },
    { category: 'Ataque', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Bloqueo', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Saque', types: ['Punto directo', 'Positivo', 'Neutro', 'Error'] },
    { category: 'Defensa', types: ['Positivo', 'Error'] },
    { category: 'Colocación', types: ['Positivo', 'Error'] },
  ],
  'Líbero': [
    { category: 'Recepción', types: ['Doble positivo', 'Positivo', 'Neutro', 'Error'] },
    { category: 'Defensa', types: ['Positivo', 'Error'] },
    { category: 'Colocación', types: ['Positivo', 'Error'] },
  ],
};

const BASIC_RECEPCION_POSITIONS = ['Receptor', 'Líbero'];
const BASIC_DISABLED_CATEGORIES = ['Defensa', 'Colocación'];
const BASIC_ENABLED_BY_CATEGORY = {
  'Recepción': ['Doble positivo', 'Positivo', 'Neutro', 'Error'],
  'Ataque': ['Positivo', 'Error'],
  'Bloqueo': ['Positivo'],
  'Saque': ['Punto directo', 'Error'],
};

class StatTemplates {
  static getPositionStats() {
    return POSITION_STATS;
  }

  static getAdvancedSettings() {
    return StatTemplates.buildTemplateSettings('advanced');
  }

  static getAdvancedSettingsForPosition(position) {
    return StatTemplates.buildTemplateSettings('advanced', position);
  }

  static getBasicSettings() {
    return StatTemplates.buildTemplateSettings('basic');
  }

  static getBasicSettingsForPosition(position) {
    return StatTemplates.buildTemplateSettings('basic', position);
  }

  static buildTemplateSettings(template, position) {
    const positions = position ? { [position]: POSITION_STATS[position] } : POSITION_STATS;

    if (!positions || (position && !POSITION_STATS[position])) {
      return [];
    }

    const settings = [];

    for (const [pos, configs] of Object.entries(positions)) {
      for (const stat of configs) {
        for (const type of stat.types) {
          const enabled = template === 'advanced'
            ? true
            : StatTemplates.isBasicEnabled(stat.category, type, pos);

          settings.push({
            position: pos,
            stat_category: stat.category,
            stat_type: type,
            enabled,
          });
        }
      }
    }

    return settings;
  }

  static isBasicEnabled(category, type, position) {
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

module.exports = {
  StatTemplates,
};
