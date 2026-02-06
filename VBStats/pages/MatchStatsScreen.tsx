/**
 * Pantalla de estadísticas detalladas de un partido
 * Diseño moderno con gráficos y barras apiladas
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  StatusBar,
  Image,
  Share,
  Alert,
} from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';
import { matchesService } from '../services/api';
import type { Match, MatchStatsSummary, MatchStat, MatchState } from '../services/types';
import { StatsIcon, MenuIcon } from '../components/VectorIcons';
import { SubscriptionType } from '../services/subscriptionService';
import CustomAlert from '../components/CustomAlert';
import RNFS from 'react-native-fs';

// Safe area paddings para Android
const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;

interface MatchStatsScreenProps {
  match: Match;
  onBack: () => void;
  onOpenMenu?: () => void;
  subscriptionType?: SubscriptionType;
}

// Función para obtener color según el tipo de stat
const getStatColor = (statType: string): string => {
  const normalized = statType.toLowerCase().trim();
  
  // Doble positivo / Punto directo / Ace = Azul eléctrico
  if (normalized.includes('doble positiv') || 
      normalized.includes('punto directo') || 
      normalized.includes('ace') ||
      normalized === '++') {
    return '#0ea5e9';
  }
  
    // Positivo = Verde
    if (normalized.includes('positiv') || normalized === '+') {
    return '#22c55e';
  }
  
  // Neutro = Amarillo
  if (normalized.includes('neutr') || normalized === '-' || normalized === '=') {
    return '#f59e0b';
  }
  
  // Error = Rojo
  if (normalized.includes('error')) {
    return '#ef4444';
  }
  
  return Colors.textSecondary;
};

// Orden fijo para tipos de estadísticas
const STAT_TYPE_ORDER = [
  'Doble Positivo', 'Punto Directo', 
  'Positivo', 'Punto', 'Ace', '++', '+', 
  'Neutra', 'Neutro', '-', 
  'Error', 'error'
];

// Orden fijo para categorías
const CATEGORY_ORDER = ['ataque', 'recepcion', 'saque', 'bloqueo', 'defensa', 'colocacion'];

const sanitizeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, '_');

const getDateStamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ensureAndroidWritePermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 29) return true;

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    {
      title: 'Permiso de almacenamiento',
      message: 'Necesitamos permiso para guardar el archivo en Descargas.',
      buttonPositive: 'Permitir',
      buttonNegative: 'Cancelar',
    }
  );

  return result === PermissionsAndroid.RESULTS.GRANTED;
};

const normalizeCategory = (value: string): string => {
  return value
    .toLowerCase()
    .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

const sortCategories = (categories: string[]): string[] => {
  return categories.slice().sort((a, b) => {
    const aIndex = CATEGORY_ORDER.indexOf(normalizeCategory(a));
    const bIndex = CATEGORY_ORDER.indexOf(normalizeCategory(b));
    const rankA = aIndex === -1 ? 999 : aIndex;
    const rankB = bIndex === -1 ? 999 : bIndex;
    if (rankA !== rankB) return rankA - rankB;
    return a.localeCompare(b, 'es', { sensitivity: 'base' });
  });
};

export default function MatchStatsScreen({ match, onBack, onOpenMenu, subscriptionType = 'pro' }: MatchStatsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState<MatchStatsSummary | null>(null);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [showExportAlert, setShowExportAlert] = useState(false);
  
  // Filtros
  const [selectedSet, setSelectedSet] = useState<'all' | number>('all');
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const playerFilterScrollRef = useRef<ScrollView>(null);

  const isBasicSubscription = subscriptionType === 'basic';
  const isProSubscription = subscriptionType === 'pro';

  useEffect(() => {
    loadMatchStats();
  }, [match.id]);


  const buildStatsFromMatchState = (state: MatchState | null): MatchStat[] => {
    if (!state?.action_history || !Array.isArray(state.action_history)) return [];
    return state.action_history
      .filter(a => a.type === 'add_stat' && a.data)
      .map(a => a.data)
      .filter((d): d is NonNullable<typeof d> => !!d)
      .map(d => ({
        user_id: match.user_id || 0,
        match_id: match.id,
        player_id: d.playerId || 0,
        set_number: d.setNumber || 1,
        stat_setting_id: d.statSettingId || 0,
        stat_category: d.statCategory || '',
        stat_type: d.statType || '',
        player_name: d.playerName || '',
        player_number: d.playerNumber || undefined,
        created_at: d.timestamp ? new Date(d.timestamp).toISOString() : undefined,
      }))
      .filter(s => s.player_id && s.stat_setting_id && s.stat_category && s.stat_type);
  };

  const loadMatchStats = async () => {
    setLoading(true);
    try {
      const data = await matchesService.getStats(match.id);
      if (!data?.stats?.length) {
        const state = await matchesService.getMatchState(match.id);
        const fallbackStats = buildStatsFromMatchState(state);
        if (fallbackStats.length > 0) {
          setStatsData({ stats: fallbackStats, summary: [], bySet: [] });
        } else {
          setStatsData({ stats: [], summary: [], bySet: [] });
        }
      } else {
        setStatsData(data);
      }
    } catch (error) {
      console.error('Error cargando estadisticas:', error);
      setStatsData({ stats: [], summary: [], bySet: [] });
    } finally {
      setLoading(false);
    }
  };

  // Obtener sets únicos
  const uniqueSets = useMemo(() => {
    if (!statsData?.stats) return [];
    const sets = new Set(statsData.stats.map(s => s.set_number));
    return Array.from(sets).sort((a, b) => a - b);
  }, [statsData]);

  // Obtener jugadores únicos
  const uniquePlayers = useMemo(() => {
    if (!statsData?.stats) return [];
    const playersMap = new Map<number, { id: number; name: string; number: number; position: string }>();
    statsData.stats.forEach(s => {
      if (!playersMap.has(s.player_id)) {
        playersMap.set(s.player_id, {
          id: s.player_id,
          name: s.player_name || '',
          number: s.player_number || 0,
          position: s.player_position || '',
        });
      }
    });
    return Array.from(playersMap.values()).sort((a, b) => a.number - b.number);
  }, [statsData]);

  // Filtrar estadísticas según selección
  const filteredStats = useMemo(() => {
    if (!statsData?.stats) return [];
    let stats = statsData.stats;
    
    if (selectedSet !== 'all') {
      stats = stats.filter(s => s.set_number === selectedSet);
    }
    if (selectedPlayer !== null) {
      stats = stats.filter(s => s.player_id === selectedPlayer);
    }
    
    return stats;
  }, [statsData, selectedSet, selectedPlayer]);

  // Agrupar por categoría
  const statsByCategory = useMemo(() => {
    const grouped: Record<string, { statType: string; count: number; color: string }[]> = {};
    
    filteredStats.forEach(stat => {
      if (!grouped[stat.stat_category]) {
        grouped[stat.stat_category] = [];
      }
      const existing = grouped[stat.stat_category].find(s => s.statType === stat.stat_type);
      if (existing) {
        existing.count++;
      } else {
        const color = getStatColor(stat.stat_type);
        grouped[stat.stat_category].push({ statType: stat.stat_type, count: 1, color });
      }
    });

    // Ordenar tipos dentro de cada categoría
    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) => {
        const normalize = (v: string) => v.toLowerCase();
        const typeWeight = (v: string) => {
          const t = normalize(v);
          if (t.includes('doble positiv') || t.includes('punto directo') || t.includes('ace') || t.includes('positiv')) return 1;
          if (t.includes('neutr')) return 2;
          if (t.includes('error')) return 3;
          return 9;
        };
        const weightA = typeWeight(a.statType);
        const weightB = typeWeight(b.statType);
        if (weightA !== weightB) return weightA - weightB;
        const indexA = STAT_TYPE_ORDER.findIndex(t => t.toLowerCase() === a.statType.toLowerCase());
        const indexB = STAT_TYPE_ORDER.findIndex(t => t.toLowerCase() === b.statType.toLowerCase());
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });
    });

    return grouped;
  }, [filteredStats]);

  const orderedCategoryKeys = useMemo(() => {
    return sortCategories(Object.keys(statsByCategory));
  }, [statsByCategory]);


  // Total de acciones
  const totalActions = filteredStats.length;

  // Función para obtener puntuación de un stat
  const getStatScore = (statType: string): number => {
    const normalized = statType.toLowerCase().trim();
    
    // Doble positivo/Punto directo: +1
    if (normalized.includes('doble positiv') || 
        normalized.includes('punto directo') || 
        normalized.includes('ace') ||
        normalized === '++') {
      return 1;
    }
    
    // Positivo: +1
    if (normalized.includes('positiv') || normalized === '+') {
      return 1;
    }
    
    // Neutro: 0
    if (normalized.includes('neutr') || normalized === '-' || normalized === '=') {
      return 0;
    }
    
    // Error: -1
    if (normalized.includes('error')) {
      return -1;
    }
    
    return 0;
  };

  // Calcular estadísticas G-P por categoría
  const categoryPerformance = useMemo(() => {
    const performance: Record<string, {
      gp: number;
      total: number;
      doblePositivo: number;
      positivo: number;
      neutro: number;
      error: number;
      rating: number;
    }> = {};

    filteredStats.forEach(stat => {
      if (!performance[stat.stat_category]) {
        performance[stat.stat_category] = {
          gp: 0,
          total: 0,
          doblePositivo: 0,
          positivo: 0,
          neutro: 0,
          error: 0,
          rating: 0,
        };
      }
      const score = getStatScore(stat.stat_type);
      const normalized = stat.stat_type.toLowerCase().trim();
      
      performance[stat.stat_category].gp += score;
      performance[stat.stat_category].total += 1;

      // Contar por tipo para el rating
      if (normalized.includes('doble positiv') || normalized.includes('punto directo') || normalized.includes('ace') || normalized === '++') {
        performance[stat.stat_category].doblePositivo += 1;
      } else if (normalized.includes('positiv') || normalized === '+') {
        performance[stat.stat_category].positivo += 1;
      } else if (normalized.includes('neutr') || normalized === '-' || normalized === '=') {
        performance[stat.stat_category].neutro += 1;
      } else if (normalized.includes('error')) {
        performance[stat.stat_category].error += 1;
      }
    });

    // Calcular rating (1-10) basado en la distribución
    Object.keys(performance).forEach(category => {
      const p = performance[category];
      if (p.total === 0) {
        p.rating = 5;
        return;
      }

      // Fórmula de rating ponderada:
      // - Doble positivo/Punto directo: peso 4
      // - Positivo: peso 2
      // - Neutro: peso 0
      // - Error: peso -4
      const weightedScore = (
        p.doblePositivo * 4 +
        p.positivo * 2 +
        p.neutro * 0 +
        p.error * -4
      );
      
      const maxPossible = p.total * 4; // Si todo fuera doble positivo
      const minPossible = p.total * -4; // Si todo fuera error
      
      // Normalizar a escala 1-10
      const normalized = (weightedScore - minPossible) / (maxPossible - minPossible);
      p.rating = Math.max(1, Math.min(10, Math.round(normalized * 9 + 1)));
    });

    return performance;
  }, [filteredStats]);

  // Calcular totales generales
  const totalPerformance = useMemo(() => {
    let totalGP = 0;
    let totalCount = 0;
    let totalDoblePositivo = 0;
    let totalPositivo = 0;
    let totalNeutro = 0;
    let totalError = 0;

    Object.values(categoryPerformance).forEach(cat => {
      totalGP += cat.gp;
      totalCount += cat.total;
      totalDoblePositivo += cat.doblePositivo;
      totalPositivo += cat.positivo;
      totalNeutro += cat.neutro;
      totalError += cat.error;
    });

    // Calcular rating total
    const weightedScore = (
      totalDoblePositivo * 4 +
      totalPositivo * 2 +
      totalNeutro * 0 +
      totalError * -4
    );
    const maxPossible = totalCount * 4;
    const minPossible = totalCount * -4;
    const normalized = totalCount > 0 ? (weightedScore - minPossible) / (maxPossible - minPossible) : 0.5;
    const rating = Math.max(1, Math.min(10, Math.round(normalized * 9 + 1)));

    return { gp: totalGP, total: totalCount, rating };
  }, [categoryPerformance]);

  // Estadísticas por jugador (para mostrar ranking)
  const playerStats = useMemo(() => {
    const playerMap: Record<number, number> = {};
    filteredStats.forEach(s => {
      playerMap[s.player_id] = (playerMap[s.player_id] || 0) + 1;
    });
    return uniquePlayers.map(p => ({
      ...p,
      total: playerMap[p.id] || 0,
    })).sort((a, b) => b.total - a.total);
  }, [filteredStats, uniquePlayers]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${day} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  };

  // Función para generar y compartir el informe de estadísticas
  const getCategorySuccessPercent = (category: string): number => {
    const categoryStats = filteredStats.filter(s => s.stat_category.toLowerCase() === category.toLowerCase());
    if (categoryStats.length === 0) return 0;
    const positives = categoryStats.filter(s => getStatScore(s.stat_type) > 0).length;
    return Math.round((positives / categoryStats.length) * 100);
  };

  const getCategoryTypeOrder = (category: string) => {
    const stats = statsByCategory[category] || [];
    return stats.map(item => item.statType);
  };

  // Generate or get share code for the match
  const generateShareCode = async (): Promise<string> => {
    // If match already has a share code, use it
    if (match.share_code) {
      return match.share_code;
    }
    
    // If we already generated a code in this session, use it
    if (shareCode) {
      return shareCode;
    }
    
    // Generate new code via API
    setGeneratingCode(true);
    try {
      const response = await matchesService.generateShareCode(match.id);
      setShareCode(response.share_code);
      return response.share_code;
    } catch (error) {
      console.error('Error generating share code:', error);
      // Generate local code as fallback
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    } finally {
      setGeneratingCode(false);
    }
  };

  const generateAndShareReport = async () => {
    try {
      // Get or generate share code
      const code = await generateShareCode();
      
      // Generar título del informe
      const matchInfo = `${match.team_name || 'Mi equipo'}${match.opponent ? ` vs ${match.opponent}` : ''}`;
      const dateStr = formatDate(match.date);
      const scoreStr = (match.score_home !== null && match.score_away !== null) 
        ? `\nResultado: ${match.score_home} - ${match.score_away}` 
        : '';

      // For basic subscriptions, generate a summary report
      if (isBasicSubscription) {
        let reportText = `◆ RESUMEN DE PARTIDO\n`;
        reportText += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
        reportText += `Fecha: ${dateStr}\n`;
        reportText += `Partido: ${matchInfo}${scoreStr}\n\n`;

        // Summary performance
        reportText += `Resumen: G-P ${totalPerformance.gp >= 0 ? '+' : ''}${totalPerformance.gp} (${totalPerformance.total} acciones)\n\n`;

        // Simple category breakdown (just totals)
        reportText += `◆ POR CATEGORÍA\n`;
        orderedCategoryKeys.slice(0, 4).forEach((category) => {
          const stats = statsByCategory[category] || [];
          const total = stats.reduce((sum, s) => sum + s.count, 0);
          if (total === 0) return;
          reportText += `• ${category}: ${total} acciones\n`;
        });

        reportText += `\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
        reportText += `CÓDIGO DEL PARTIDO: ${code}\n`;
        reportText += `\nDescarga VBStats para ver el informe completo\n`;
        reportText += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
        reportText += `Generado con VBStats\n`;
        reportText += `BlueDeBug.com`;

        await Share.share({
          message: reportText,
          title: `Estadísticas: ${matchInfo}`,
        });
        return;
      }
      
      // Full report for pro users
      // Filtros aplicados
      let filterInfo = '';
      if (selectedSet !== 'all') {
        filterInfo += `Set: ${selectedSet}`;
      }
      if (selectedPlayer !== null) {
        const player = uniquePlayers.find(p => p.id === selectedPlayer);
        if (player) {
          filterInfo += filterInfo ? ' | ' : '';
          filterInfo += `Jugador: ${player.name} (#${player.number})`;
        }
      }
      if (filterInfo) {
        filterInfo = `\n${filterInfo}`;
      }

      // Resumen general
      let reportText = `◆ INFORME DE ESTADÍSTICAS\n`;
      reportText += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
      reportText += `Fecha: ${dateStr}\n`;
      reportText += `Partido: ${matchInfo}${scoreStr}`;
      reportText += filterInfo ? `${filterInfo}` : '';
      reportText += `\n\n`;

      // Resumen general
      reportText += `• G-P: ${totalPerformance.gp >= 0 ? '+' : ''}${totalPerformance.gp} (${totalPerformance.total} acciones)\n`;

      reportText += `\n`;

      // Estadísticas por categoría
      reportText += `◆ DESGLOSE POR CATEGORÍA\n`;
      reportText += `━━━━━━━━━━━━━━━━━━━━━━━\n`;

      orderedCategoryKeys.forEach((category) => {
        const stats = statsByCategory[category] || [];
        const total = stats.reduce((sum, s) => sum + s.count, 0);
        if (total === 0) return;

        reportText += `\n• ${category}\n`;

        const orderedTypes = getCategoryTypeOrder(category);
        const orderedStats = orderedTypes.length > 0
          ? orderedTypes
              .map(type => stats.find(s => s.statType === type))
              .filter((s): s is { statType: string; count: number; color: string } => !!s)
          : stats;

        orderedStats.forEach(item => {
          const percentage = Math.round((item.count / total) * 100);
          reportText += `  ${item.statType}: ${item.count} · ${percentage}%\n`;
        });
      });

      // Top jugadores (si no hay filtro de jugador)
      if (selectedPlayer === null && playerStats.length > 0) {
        reportText += `\n\n◆ PARTICIPACIÓN DE JUGADORES\n`;
        reportText += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
        playerStats.forEach((player, index) => {
          const position = index + 1;
          reportText += `${position}. #${player.number} ${player.name}: ${player.total} acciones\n`;
        });
      }

      reportText += `\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
      reportText += `CÓDIGO: ${code}\n`;
      reportText += `Ver informe en la app con cuenta gratuita\n`;
      reportText += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
      reportText += `Generado con VBStats\n`;
      reportText += `BlueDeBug.com`;

      // Compartir el informe
      await Share.share({
        message: reportText,
        title: `Estadísticas: ${matchInfo}`,
      });
    } catch (error) {
      console.error('Error sharing report:', error);
    }
  };

  // Función para exportar a Excel (CSV)
  const exportToExcel = async () => {
    try {
      const matchInfo = `${match.team_name || 'Mi equipo'}${match.opponent ? ` vs ${match.opponent}` : ''}`;
      const dateStr = formatDate(match.date);
      
      let csv = 'INFORME DE ESTADÍSTICAS - VBStats Pro\n\n';
      csv += `Fecha,${dateStr}\n`;
      csv += `Partido,${matchInfo}\n`;
      if (match.score_home !== null && match.score_away !== null) {
        csv += `Resultado,${match.score_home} - ${match.score_away}\n`;
      }
      csv += `Localización,${match.location === 'home' ? 'Local' : 'Visitante'}\n`;
      csv += `Total Sets,${match.total_sets || 0}\n\n`;

      // Filtros aplicados
      if (selectedSet !== 'all') {
        csv += `Filtro Set,${selectedSet}\n`;
      }
      if (selectedPlayer !== null) {
        const player = uniquePlayers.find(p => p.id === selectedPlayer);
        if (player) csv += `Filtro Jugador,${player.name} (#${player.number})\n`;
      }
      csv += '\n';

      // Resumen general
      csv += 'RESUMEN GENERAL\n';
      csv += `G-P Total,${totalPerformance.gp}\n`;
      csv += `Total Acciones,${totalPerformance.total}\n`;

      // Rendimiento por categoría
      csv += 'RENDIMIENTO POR CATEGORÍA\n';
      csv += 'Categoría,G-P,Total Acciones,Doble Positivo,Positivo,Neutro,Error\n';
      Object.entries(categoryPerformance).forEach(([category, perf]) => {
        csv += `${category},${perf.gp},${perf.total},${perf.doblePositivo},${perf.positivo},${perf.neutro},${perf.error}\n`;
      });
      csv += '\n';

      // Desglose detallado por categoría
      csv += 'DESGLOSE POR TIPO DE ESTADÍSTICA\n';
      csv += 'Categoría,Tipo,Cantidad,Porcentaje\n';
      orderedCategoryKeys.forEach(category => {
        const stats = statsByCategory[category] || [];
        const total = stats.reduce((sum, s) => sum + s.count, 0);
        stats.forEach(item => {
          const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
          csv += `${category},${item.statType},${item.count},${percentage}%\n`;
        });
      });
      csv += '\n';

      // Participación de jugadores
      if (selectedPlayer === null && playerStats.length > 0) {
        csv += 'PARTICIPACIÓN DE JUGADORES\n';
        csv += 'Posición,Número,Nombre,Acciones\n';
        playerStats.forEach((player, index) => {
          csv += `${index + 1},${player.number},${player.name},${player.total}\n`;
        });
        csv += '\n';
      }

      // Estadísticas detalladas
      csv += 'ESTADÍSTICAS DETALLADAS\n';
      csv += 'Set,Jugador,Número,Categoría,Tipo\n';
      filteredStats.forEach(stat => {
        csv += `${stat.set_number},${stat.player_name || ''},${stat.player_number || ''},${stat.stat_category},${stat.stat_type}\n`;
      });

      csv += '\nGenerado con VBStats Pro - BlueDeBug.com';

      const hasPermission = await ensureAndroidWritePermission();
      if (!hasPermission) {
        Alert.alert('Permiso denegado', 'No se puede guardar el archivo sin permisos de almacenamiento.');
        return;
      }

      const safeTeamName = sanitizeFileName(match.team_name || 'Partido');
      const safeDate = sanitizeFileName(dateStr || getDateStamp());
      const fileName = `Estadisticas_${safeTeamName}_${safeDate}.csv`;
      const directory = Platform.OS === 'android'
        ? RNFS.DownloadDirectoryPath
        : RNFS.DocumentDirectoryPath;
      const filePath = `${directory}/${fileName}`;

      await RNFS.writeFile(filePath, csv, 'utf8');

      if (Platform.OS === 'android') {
        await RNFS.scanFile([{ path: filePath, mime: 'text/csv' }]);
      }

      Alert.alert('Archivo guardado', `Se guardo en: ${filePath}`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
    }
  };

  // Función para obtener el icono según el tipo de stat
  const getStatIcon = (statType: string, color: string, size: number = 20) => {
    const normalizedType = statType.toLowerCase();
    
    // Doble positivo = icono de doble plus
    if (normalizedType.includes('doble positiv') || normalizedType.includes('doble positivo') || normalizedType.includes('++')) {
      return <MaterialCommunityIcons name="plus-circle-multiple" size={size} color={color} />;
    }
    // Punto directo = Diana/Bullseye
    if (normalizedType.includes('punto directo') || normalizedType.includes('ace')) {
      return <MaterialCommunityIcons name="bullseye-arrow" size={size} color={color} />;
    }
    // Positivo = Plus circle
    if (normalizedType.includes('positiv') || normalizedType.includes('+')) {
      return <MaterialCommunityIcons name="plus-circle" size={size} color={color} />;
    }
    // Neutro = Minus circle
    if (normalizedType.includes('neutr')) {
      return <MaterialCommunityIcons name="minus-circle" size={size} color={color} />;
    }
    // Error = Close circle
    if (normalizedType.includes('error')) {
      return <MaterialCommunityIcons name="close-circle" size={size} color={color} />;
    }
    
    return <MaterialCommunityIcons name="circle-outline" size={size} color={color} />;
  };

  // Función para crear path de arco SVG
  const createArcPath = (
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ): string => {
    // Convertir ángulos a radianes (empezando desde arriba, -90 grados)
    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);

    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  // Renderizar gráfico circular verdadero con SVG
  const renderPieChart = (data: { statType: string; count: number; color: string }[], total: number) => {
    if (total === 0) return null;

    const size = 120;
    const center = size / 2;
    const radius = size / 2 - 2;
    const innerRadius = radius * 0.5; // Para efecto donut

    // Calcular segmentos con ángulos
    let currentAngle = 0;
    const segments = data.map(item => {
      const percentage = (item.count / total) * 100;
      const angle = (percentage / 100) * 360;
      const segment = {
        ...item,
        percentage,
        startAngle: currentAngle,
        endAngle: currentAngle + angle,
      };
      currentAngle += angle;
      return segment;
    });

    return (
      <View style={styles.pieChartMainContainer}>
        {/* SVG Pie Chart */}
        <View style={styles.pieChartSvgContainer}>
          <Svg width={size} height={size}>
            <G>
              {segments.map((segment, idx) => {
                // Para un solo segmento del 100%, dibujar círculo completo
                if (segment.percentage >= 99.9) {
                  return (
                    <Path
                      key={idx}
                      d={`M ${center} ${2} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${2} Z`}
                      fill={segment.color}
                    />
                  );
                }
                
                const path = createArcPath(
                  center,
                  center,
                  radius,
                  segment.startAngle,
                  segment.endAngle
                );
                return <Path key={idx} d={path} fill={segment.color} />;
              })}
            </G>
            {/* Centro para efecto donut */}
            <Path
              d={`M ${center} ${center - innerRadius} A ${innerRadius} ${innerRadius} 0 1 1 ${center - 0.01} ${center - innerRadius} Z`}
              fill={Colors.surface}
            />
          </Svg>
        </View>

        {/* Leyenda - Tabla moderna */}
        <View style={styles.pieLegendTable}>
          {/* Header de la tabla */}
          <View style={styles.pieLegendHeader}>
            <Text style={styles.pieLegendHeaderText} numberOfLines={1}>Tipo</Text>
            <Text style={styles.pieLegendHeaderTextRight} numberOfLines={1}>Cant.</Text>
            <Text style={styles.pieLegendHeaderTextRight} numberOfLines={1}>%</Text>
          </View>
          
          {/* Filas de datos */}
          {segments.map((segment, idx) => (
            <View key={idx} style={styles.pieLegendRow}>
              <View style={styles.pieLegendTypeCell}>
                {getStatIcon(segment.statType, segment.color, 22)}
              </View>
              <Text style={styles.pieLegendCount}>{segment.count}</Text>
              <Text style={styles.pieLegendPercent}>{Math.round(segment.percentage)}%</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Renderizar barra horizontal con porcentajes
  const renderHorizontalBar = (data: { statType: string; count: number; color: string }[], total: number) => {
    if (total === 0) return <Text style={styles.noDataText}>Sin datos</Text>;

    return (
      <View style={styles.horizontalBarContainer}>
        {/* Barra apilada */}
        <View style={styles.stackedBar}>
          {data.map((item, idx) => {
            const width = (item.count / total) * 100;
            return (
              <View
                key={idx}
                style={[
                  styles.stackedBarSegment,
                  { 
                    width: `${width}%`, 
                    backgroundColor: item.color,
                    borderTopLeftRadius: idx === 0 ? BorderRadius.sm : 0,
                    borderBottomLeftRadius: idx === 0 ? BorderRadius.sm : 0,
                    borderTopRightRadius: idx === data.length - 1 ? BorderRadius.sm : 0,
                    borderBottomRightRadius: idx === data.length - 1 ? BorderRadius.sm : 0,
                  }
                ]}
              />
            );
          })}
        </View>
        
        {/* Leyenda debajo */}
        <View style={styles.barLegend}>
          {data.map((item, idx) => (
            <View key={idx} style={styles.barLegendItem}>
              <View style={[styles.barLegendDot, { backgroundColor: item.color }]} />
              <Text style={styles.barLegendText}>{item.statType}</Text>
              <Text style={styles.barLegendCount}>{item.count}</Text>
              <Text style={styles.barLegendPercent}>({Math.round((item.count / total) * 100)}%)</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Obtener descripción del filtro actual
  const getFilterDescription = () => {
    const playerName = selectedPlayer 
      ? uniquePlayers.find(p => p.id === selectedPlayer)?.name 
      : null;
    
    if (selectedSet === 'all' && !selectedPlayer) {
      return 'Todo el equipo - Partido completo';
    }
    if (selectedSet === 'all' && selectedPlayer) {
      return `${playerName} - Partido completo`;
    }
    if (selectedSet !== 'all' && !selectedPlayer) {
      return `Todo el equipo - Set ${selectedSet}`;
    }
    return `${playerName} - Set ${selectedSet}`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Cargando estadísticas...</Text>
        </View>
      </View>
    );
  }

  if (!statsData || statsData.stats.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => onOpenMenu ? onOpenMenu() : onBack()}>
            {onOpenMenu ? (
              <MenuIcon size={28} color={Colors.text} />
            ) : (
              <MaterialCommunityIcons name="arrow-left" size={28} color={Colors.text} />
            )}
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Estadísticas</Text>
          <Image 
            source={require('../assets/logo_sinfondo.png')} 
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </View>
        <View style={styles.emptyContainer}>
          <StatsIcon size={80} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>Sin estadísticas</Text>
          <Text style={styles.emptyText}>No hay estadísticas registradas para este partido</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => onOpenMenu ? onOpenMenu() : onBack()}>
          {onOpenMenu ? (
            <MenuIcon size={28} color={Colors.text} />
          ) : (
            <MaterialCommunityIcons name="arrow-left" size={28} color={Colors.text} />
          )}
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <StatsIcon size={20} color={Colors.primary} />
          <Text style={styles.headerTitle}>Estadísticas</Text>
        </View>
        <Image 
          source={require('../assets/logo_sinfondo.png')} 
          style={styles.headerLogo}
          resizeMode="contain"
        />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Info del partido */}
        <View style={styles.matchBanner}>
          <Text style={styles.matchDate}>{formatDate(match.date)}</Text>
          <Text style={styles.matchTeams}>
            {match.team_name} {match.opponent ? `vs ${match.opponent}` : ''}
          </Text>
          
          {/* Resultado del partido si está disponible */}
          {(match.score_home !== null && match.score_home !== undefined && 
            match.score_away !== null && match.score_away !== undefined) && (
            <View style={styles.matchScoreContainer}>
              <Text style={styles.matchScoreText}>
                {match.score_home} - {match.score_away}
              </Text>
            </View>
          )}
          
          <View style={styles.matchMeta}>
            <View style={styles.matchMetaItem}>
              <MaterialCommunityIcons 
                name={match.location === 'home' ? 'home' : 'airplane'} 
                size={14} 
                color={Colors.textOnPrimary} 
              />
              <Text style={styles.matchMetaText}>
                {match.location === 'home' ? 'Local' : 'Visitante'}
              </Text>
            </View>
            <View style={styles.matchMetaDivider} />
            <View style={styles.matchMetaItem}>
              <MaterialCommunityIcons name="volleyball" size={14} color={Colors.textOnPrimary} />
              <Text style={styles.matchMetaText}>{match.total_sets || 0} Sets</Text>
            </View>
          </View>
        </View>
        {/* Filtros por Set */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Filtrar por Set</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, selectedSet === 'all' && styles.filterChipActive]}
                onPress={() => setSelectedSet('all')}
              >
                <Text style={[styles.filterChipText, selectedSet === 'all' && styles.filterChipTextActive]}>
                  Todos
                </Text>
              </TouchableOpacity>
              {uniqueSets.map(setNum => (
                <TouchableOpacity
                  key={setNum}
                  style={[styles.filterChip, selectedSet === setNum && styles.filterChipActive]}
                  onPress={() => setSelectedSet(setNum)}
                >
                  <Text style={[styles.filterChipText, selectedSet === setNum && styles.filterChipTextActive]}>
                    Set {setNum}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Filtros por Jugador */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Filtrar por Jugador</Text>
          <ScrollView 
            ref={playerFilterScrollRef}
            horizontal 
            showsHorizontalScrollIndicator={false}
          >
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, selectedPlayer === null && styles.filterChipActive]}
                onPress={() => {
                  setSelectedPlayer(null);
                  playerFilterScrollRef.current?.scrollTo({ x: 0, animated: true });
                }}
              >
                <Text style={[styles.filterChipText, selectedPlayer === null && styles.filterChipTextActive]}>
                  Equipo
                </Text>
              </TouchableOpacity>
              {uniquePlayers.map((player, index) => (
                <TouchableOpacity
                  key={player.id}
                  style={[styles.filterChip, selectedPlayer === player.id && styles.filterChipActive]}
                  onPress={() => {
                    setSelectedPlayer(player.id);
                    // Autoscroll para centrar el chip seleccionado
                    setTimeout(() => {
                      playerFilterScrollRef.current?.scrollTo({ 
                        x: index * 100, 
                        animated: true 
                      });
                    }, 100);
                  }}
                >
                  <View style={styles.filterChipContent}>
                    <View style={styles.filterChipNumber}>
                      <Text style={[
                        styles.filterChipNumberText,
                        selectedPlayer === player.id && styles.filterChipNumberTextActive
                      ]}>
                        {player.number}
                      </Text>
                    </View>
                    <Text style={[styles.filterChipText, selectedPlayer === player.id && styles.filterChipTextActive]}>
                      {player.name.split(' ')[0]}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Descripción del filtro actual */}
        <View style={styles.filterDescription}>
          <MaterialCommunityIcons name="filter-variant" size={18} color={Colors.primary} />
          <Text style={styles.filterDescriptionText}>{getFilterDescription()}</Text>
        </View>

        {/* Mensaje cuando no hay estadísticas para el filtro */}
        {filteredStats.length === 0 ? (
          <View style={styles.noStatsForFilter}>
            <MaterialCommunityIcons name="information-outline" size={64} color={Colors.textTertiary} />
            <Text style={styles.noStatsForFilterTitle}>Sin estadísticas</Text>
            <Text style={styles.noStatsForFilterText}>
              No hay estadísticas registradas para el filtro seleccionado
            </Text>
          </View>
        ) : (
          <>
        {/* Sección de Rendimiento G-P */}
        <View style={styles.performanceSection}>
          <Text style={styles.performanceSectionTitle}>Rendimiento G-P</Text>
          
          {/* Card de Rendimiento Total */}
          <View style={styles.totalPerformanceCard}>
            <View style={styles.totalPerformanceHeader}>
              <View>
                <Text style={styles.totalPerformanceLabel}>Rendimiento</Text>
                <Text style={styles.totalPerformanceSubtext}>{totalPerformance.total} acciones</Text>
              </View>
              <View style={styles.totalPerformanceValues}>
                <View style={styles.gpBadge}>
                  <Text style={styles.gpLabel}>G-P</Text>
                  <Text style={[
                    styles.gpValue,
                    totalPerformance.gp > 0 && styles.gpValuePositive,
                    totalPerformance.gp < 0 && styles.gpValueNegative,
                  ]}>
                    {totalPerformance.gp > 0 ? '+' : ''}{totalPerformance.gp}
                  </Text>
                </View>
              </View>
            </View>
            
            {/* Barra de progreso visual del rating */}
            <View style={styles.ratingBar}>
              <View style={styles.ratingBarBackground}>
                <View 
                  style={[
                    styles.ratingBarFill,
                    { 
                      width: `${(totalPerformance.rating / 10) * 100}%`,
                      backgroundColor: totalPerformance.rating >= 7 
                        ? '#22c55e' 
                        : totalPerformance.rating >= 5 
                        ? '#f59e0b' 
                        : '#ef4444'
                    },
                  ]} 
                />
              </View>
              <View style={styles.ratingScale}>
                <Text style={styles.ratingScaleText}>1</Text>
                <Text style={styles.ratingScaleText}>5</Text>
                <Text style={styles.ratingScaleText}>10</Text>
              </View>
            </View>
          </View>

          {/* Cards por Faceta */}
          <View style={styles.facetCardsGrid}>
            {Object.entries(categoryPerformance).map(([category, perf]) => (
              <View key={category} style={styles.facetCard}>
                <View style={styles.facetCardHeader}>
                  <StatsIcon size={16} color={Colors.primary} />
                  <Text style={styles.facetCardTitle} numberOfLines={1}>{category}</Text>
                </View>
                <View style={styles.facetCardStats}>
                  <View style={styles.facetStatItemSingle}>
                    <Text style={styles.facetStatLabel}>G-P</Text>
                    <Text style={[
                      styles.facetStatValue,
                      perf.gp > 0 && styles.facetStatValuePositive,
                      perf.gp < 0 && styles.facetStatValueNegative,
                    ]}>
                      {perf.gp > 0 ? '+' : ''}{perf.gp}
                    </Text>
                  </View>
                </View>
                <Text style={styles.facetCardTotal}>{perf.total} acciones</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Resumen Total */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryMain}>
            <Text style={styles.summaryNumber}>{totalActions}</Text>
            <Text style={styles.summaryLabel}>Acciones Totales</Text>
          </View>
          <View style={styles.summaryCategories}>
            {Object.keys(statsByCategory).map(category => {
              const total = statsByCategory[category].reduce((sum, s) => sum + s.count, 0);
              return (
                <View key={category} style={styles.summaryCategoryItem}>
                  <Text style={styles.summaryCategoryCount}>{total}</Text>
                  <Text style={styles.summaryCategoryName}>{category.substring(0, 3)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Estadísticas por Categoría */}
        {orderedCategoryKeys.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Desglose por Categoría</Text>
          
          {orderedCategoryKeys.map((category) => {
            const stats = statsByCategory[category] || [];
            const total = stats.reduce((sum, s) => sum + s.count, 0);
            const isExpanded = expandedCategories.has(category);
            
            return (
              <TouchableOpacity
                key={category}
                style={styles.categoryCard}
                onPress={() => {
                  const newSet = new Set(expandedCategories);
                  if (isExpanded) {
                    newSet.delete(category);
                  } else {
                    newSet.add(category);
                  }
                  setExpandedCategories(newSet);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.categoryHeader}>
                  <View style={styles.categoryInfo}>
                    <StatsIcon size={20} color={Colors.primary} />
                    <Text style={styles.categoryName}>{category}</Text>
                  </View>
                  <View style={styles.categoryRight}>
                    <View style={styles.categoryTotalContainer}>
                      <Text style={styles.categoryTotal}>{total}</Text>
                      <Text style={styles.categoryTotalLabel}>registros</Text>
                    </View>
                    <MaterialCommunityIcons 
                      name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                      size={24} 
                      color={Colors.textSecondary} 
                    />
                  </View>
                </View>
                
                {/* Barra de resumen siempre visible */}
                <View style={styles.categoryBarPreview}>
                  {stats.map((item, idx) => {
                    const width = (item.count / total) * 100;
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.categoryBarSegment,
                          { 
                            width: `${width}%`, 
                            backgroundColor: item.color,
                          }
                        ]}
                      />
                    );
                  })}
                </View>

                {/* Detalle expandido */}
                {isExpanded && (
                  <View style={styles.categoryExpanded}>
                    {renderPieChart(stats, total)}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        )}
        </>
        )}

        {/* Botones de exportación */}
        <View style={styles.exportButtonsContainer}>
          <TouchableOpacity 
            style={styles.shareButtonInline}
            onPress={() => isProSubscription ? setShowExportAlert(true) : generateAndShareReport()}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="share-variant" size={20} color="#fff" />
            <Text style={styles.shareButtonText}>
              {isProSubscription ? 'Exportar informe' : 'Compartir informe'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Alert de exportación PRO */}
      {isProSubscription && (
        <CustomAlert
          visible={showExportAlert}
          icon={<MaterialCommunityIcons name="export-variant" size={48} color={Colors.primary} />}
          iconBackgroundColor={Colors.primary + '15'}
          title="Exportar Informe"
          message="Elige el formato de exportación del informe de estadísticas"
          buttonLayout="column"
          buttons={[
            {
              text: 'Compartir por WhatsApp/Redes',
              icon: <MaterialCommunityIcons name="share-variant" size={18} color="#fff" />,
              onPress: () => {
                setShowExportAlert(false);
                generateAndShareReport();
              },
              style: 'primary',
            },
            {
              text: 'Exportar a Excel (CSV)',
              icon: <MaterialCommunityIcons name="microsoft-excel" size={18} color="#fff" />,
              onPress: () => {
                setShowExportAlert(false);
                exportToExcel();
              },
              style: 'default',
            },
            {
              text: 'Cancelar',
              onPress: () => setShowExportAlert(false),
              style: 'cancel',
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR_HEIGHT : 0,
    paddingBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  matchBanner: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  matchDate: {
    fontSize: FontSizes.xs,
    color: Colors.textOnPrimary,
    opacity: 0.8,
  },
  matchTeams: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textOnPrimary,
    marginTop: 2,
  },
  matchScoreContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.xs,
  },
  matchScoreText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textOnPrimary,
    letterSpacing: 1,
  },
  matchMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: Spacing.md,
  },
  matchMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  matchMetaText: {
    fontSize: FontSizes.xs,
    color: Colors.textOnPrimary,
  },
  matchMetaDivider: {
    width: 1,
    height: 16,
    backgroundColor: Colors.textOnPrimary,
    opacity: 0.3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.lg,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: Spacing.xl,
  },
  filterSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  filterLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary,
  },
  filterChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  filterChipNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  filterChipNumberTextActive: {
    color: Colors.primary,
  },
  filterChipText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.primary,
  },
  filterDescription: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary + '10',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  filterDescriptionText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  noStatsForFilter: {
    padding: Spacing.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noStatsForFilterTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.lg,
  },
  noStatsForFilterText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  performanceSection: {
    padding: Spacing.lg,
  },
  performanceSectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  totalPerformanceCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  totalPerformanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  totalPerformanceLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  totalPerformanceSubtext: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  totalPerformanceValues: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  gpBadge: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
    minWidth: 60,
  },
  gpLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  gpValue: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  gpValuePositive: {
    color: '#22c55e',
  },
  gpValueNegative: {
    color: '#ef4444',
  },
  ratingBadge: {
    backgroundColor: Colors.primary + '15',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
    minWidth: 60,
  },
  ratingLabel: {
    fontSize: FontSizes.xs,
    color: Colors.primary,
    fontWeight: '600',
  },
  ratingValue: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.primary,
  },
  ratingBar: {
    marginTop: Spacing.xs,
  },
  ratingBarBackground: {
    height: 8,
    backgroundColor: Colors.backgroundLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  ratingScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  ratingScaleText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  facetCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  facetCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  facetCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  facetCardTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  facetCardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: Spacing.xs,
  },
  facetStatItem: {
    alignItems: 'center',
  },
  facetStatItemSingle: {
    alignItems: 'center',
    flex: 1,
  },
  facetStatLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  facetStatValue: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  facetStatValuePositive: {
    color: '#22c55e',
  },
  facetStatValueNegative: {
    color: '#ef4444',
  },
  facetStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },
  facetCardTotal: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  summaryMain: {
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.primary,
  },
  summaryLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  summaryCategories: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryCategoryItem: {
    alignItems: 'center',
  },
  summaryCategoryCount: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  summaryCategoryName: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  categoryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  categoryName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  categoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  categoryTotalContainer: {
    alignItems: 'flex-end',
  },
  categoryTotal: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.primary,
  },
  categoryTotalLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: -2,
  },
  categoryBarPreview: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: Spacing.sm,
    backgroundColor: Colors.backgroundLight,
  },
  categoryBarSegment: {
    height: '100%',
  },
  categoryExpanded: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  horizontalBarContainer: {
    gap: Spacing.md,
  },
  stackedBar: {
    flexDirection: 'row',
    height: 24,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    backgroundColor: Colors.backgroundLight,
  },
  stackedBarSegment: {
    height: '100%',
  },
  barLegend: {
    gap: Spacing.xs,
  },
  barLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  barLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  barLegendText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    flex: 1,
  },
  barLegendCount: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  barLegendPercent: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    width: 45,
    textAlign: 'right',
  },
  noDataText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: Spacing.md,
  },
  pieChartMainContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  pieChartSvgContainer: {
    width: 120,
    height: 120,
  },
  pieLegendTable: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  pieLegendHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    alignItems: 'center',
  },
  pieLegendHeaderText: {
    flex: 1,
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    minWidth: 40,
  },
  pieLegendHeaderTextRight: {
    width: 50,
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
  pieLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '40',
  },
  pieLegendTypeCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieLegendCount: {
    width: 60,
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'right',
  },
  pieLegendPercent: {
    width: 60,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.success,
    textAlign: 'right',
  },
  playerRankCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.sm,
  },
  playerRankPosition: {
    width: 30,
    alignItems: 'center',
  },
  playerRankNumber: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  playerRankInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  playerNumberBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '20',
    borderWidth: 2,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerNumberText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  playerRankDetails: {
    flex: 1,
  },
  playerRankName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  playerRankPos: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  playerRankStats: {
    alignItems: 'flex-end',
    marginRight: Spacing.sm,
  },
  playerRankTotal: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.primary,
  },
  playerRankPercent: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  playerRankBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.backgroundLight,
    borderBottomLeftRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  playerRankBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  exportButtonsContainer: {
    paddingHorizontal: 0,
  },
  shareButtonInline: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    ...Shadows.md,
  },
  shareButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#fff',
  },
});
