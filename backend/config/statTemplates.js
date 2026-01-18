/**
 * Stat templates for basic and advanced configurations
 */

const POSITION_STATS = {
  'Receptor': [
    { category: 'Recepción', types: ['Doble positiva', 'Positiva', 'Neutra', 'Error'] },
    { category: 'Ataque', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Bloqueo', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Saque', types: ['Punto directo', 'Positivo', 'Neutro', 'Error'] },
    { category: 'Defensa', types: ['Positiva', 'Error'] },
    { category: 'Colocación', types: ['Positiva', 'Error'] },
  ],
  'Opuesto': [
    { category: 'Recepción', types: ['Doble positiva', 'Positiva', 'Neutra', 'Error'] },
    { category: 'Ataque', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Bloqueo', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Saque', types: ['Punto directo', 'Positivo', 'Neutro', 'Error'] },
    { category: 'Defensa', types: ['Positiva', 'Error'] },
    { category: 'Colocación', types: ['Positiva', 'Error'] },
  ],
  'Colocador': [
    { category: 'Recepción', types: ['Doble positiva', 'Positiva', 'Neutra', 'Error'] },
    { category: 'Ataque', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Bloqueo', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Saque', types: ['Punto directo', 'Positivo', 'Neutro', 'Error'] },
    { category: 'Defensa', types: ['Positiva', 'Error'] },
    { category: 'Colocación', types: ['Positiva', 'Error'] },
  ],
  'Central': [
    { category: 'Recepción', types: ['Doble positiva', 'Positiva', 'Neutra', 'Error'] },
    { category: 'Ataque', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Bloqueo', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Saque', types: ['Punto directo', 'Positivo', 'Neutro', 'Error'] },
    { category: 'Defensa', types: ['Positiva', 'Error'] },
    { category: 'Colocación', types: ['Positiva', 'Error'] },
  ],
  'Líbero': [
    { category: 'Recepción', types: ['Doble positiva', 'Positiva', 'Neutra', 'Error'] },
    { category: 'Defensa', types: ['Positiva', 'Error'] },
    { category: 'Colocación', types: ['Positiva', 'Error'] },
  ],
};

const BASIC_ENABLED_BY_CATEGORY = {
  'Recepción': ['Positiva', 'Error'],
  'Ataque': ['Positivo', 'Error'],
  'Bloqueo': ['Positivo', 'Error'],
  'Saque': ['Punto directo', 'Error'],
  'Defensa': ['Positiva', 'Error'],
  'Colocación': ['Positiva', 'Error'],
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
            : StatTemplates.isBasicEnabled(stat.category, type);

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

  static isBasicEnabled(category, type) {
    const enabledTypes = BASIC_ENABLED_BY_CATEGORY[category] || [];
    return enabledTypes.includes(type);
  }
}

module.exports = {
  StatTemplates,
};
