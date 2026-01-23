/**
 * Pantalla de Seguimiento de Equipos - Funcionalidad PRO
 * Muestra el progreso del equipo en todos sus partidos con gráficas
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  StatusBar,
  Share,
  Dimensions,
} from 'react-native';
import Svg, { G, Path, Line, Circle, Text as SvgText, Rect } from 'react-native-svg';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';
import { matchesService } from '../services/api';
import type { Match, MatchStatsSummary, MatchStat } from '../services/types';
import { StatsIcon, MenuIcon, TeamIcon } from '../components/VectorIcons';
import CustomAlert from '../components/CustomAlert';

const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;
const ANDROID_NAV_BAR_HEIGHT = 48;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 200;

interface TeamTrackingScreenProps {
  userId: number;
  teams: { id: number; name: string; playerCount?: number }[];
  onBack: () => void;
  onOpenMenu?: () => void;
}

interface MatchPerformance {
  matchId: number;
  date: string;
  opponent: string;
  gp: number;
  totalActions: number;
  categories: Record<string, {
    gp: number;
    total: number;
    percentage: number;
  }>;
  result: 'win' | 'loss' | 'draw';
  scoreHome: number;
  scoreAway: number;
}

interface PlayerPerformance {
  playerId: number;
  playerName: string;
  playerNumber: number;
  matches: MatchPerformance[];
  totalGP: number;
  totalActions: number;
  averageGP: number;
}

// Categorías de estadísticas
const STAT_CATEGORIES = ['Recepción', 'Ataque', 'Bloqueo', 'Saque', 'Defensa', 'Colocación'];
const CATEGORY_COLORS: Record<string, string> = {
  'Recepción': '#22c55e',
  'Ataque': '#ef4444',
  'Bloqueo': '#3b82f6',
  'Saque': '#f59e0b',
  'Defensa': '#8b5cf6',
  'Colocación': '#06b6d4',
};

export default function TeamTrackingScreen({ 
  userId, 
  teams, 
  onBack, 
  onOpenMenu 
}: TeamTrackingScreenProps) {
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(teams[0]?.id || null);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [matchesData, setMatchesData] = useState<{ match: Match; stats: MatchStat[] }[]>([]);
  const [showExportAlert, setShowExportAlert] = useState(false);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    if (selectedTeam) {
      loadTeamData(selectedTeam);
    }
  }, [selectedTeam]);

  const loadTeamData = async (teamId: number) => {
    setLoading(true);
    try {
      // Cargar todos los partidos finalizados del equipo
      const matches = await matchesService.getAll({ 
        user_id: userId, 
        status: 'finished',
        team_id: teamId 
      });

      // Cargar estadísticas de cada partido
      const matchesWithStats = await Promise.all(
        matches.map(async (match) => {
          try {
            const statsData = await matchesService.getStats(match.id);
            return { match, stats: statsData?.stats || [] };
          } catch (e) {
            return { match, stats: [] };
          }
        })
      );

      setMatchesData(matchesWithStats.filter(m => m.stats.length > 0));
    } catch (error) {
      console.error('Error loading team data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calcular puntuación de una estadística
  const getStatScore = (statType: string): number => {
    const normalized = statType.toLowerCase().trim();
    if (normalized.includes('doble positiv') || normalized.includes('punto directo') || 
        normalized.includes('ace') || normalized === '++') return 1;
    if (normalized.includes('positiv') || normalized === '+') return 1;
    if (normalized.includes('neutr') || normalized === '-' || normalized === '=') return 0;
    if (normalized.includes('error')) return -1;
    return 0;
  };

  // Calcular rendimiento por partido
  const matchPerformances: MatchPerformance[] = useMemo(() => {
    return matchesData.map(({ match, stats }) => {
      let filteredStats = stats;
      if (selectedPlayer) {
        filteredStats = stats.filter(s => s.player_id === selectedPlayer);
      }

      const categories: Record<string, { gp: number; total: number; percentage: number }> = {};
      let totalGP = 0;

      filteredStats.forEach(stat => {
        const category = stat.stat_category;
        if (!categories[category]) {
          categories[category] = { gp: 0, total: 0, percentage: 0 };
        }
        const score = getStatScore(stat.stat_type);
        categories[category].gp += score;
        categories[category].total += 1;
        totalGP += score;
      });

      // Calcular porcentajes
      Object.keys(categories).forEach(cat => {
        const positives = filteredStats.filter(
          s => s.stat_category === cat && getStatScore(s.stat_type) > 0
        ).length;
        categories[cat].percentage = categories[cat].total > 0 
          ? Math.round((positives / categories[cat].total) * 100) 
          : 0;
      });

      const scoreHome = match.score_home || 0;
      const scoreAway = match.score_away || 0;
      let result: 'win' | 'loss' | 'draw' = 'draw';
      if (scoreHome > scoreAway) result = 'win';
      else if (scoreHome < scoreAway) result = 'loss';

      return {
        matchId: match.id,
        date: match.date || '',
        opponent: match.opponent || 'Sin rival',
        gp: totalGP,
        totalActions: filteredStats.length,
        categories,
        result,
        scoreHome,
        scoreAway,
      };
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [matchesData, selectedPlayer]);

  // Obtener jugadores únicos
  const uniquePlayers = useMemo(() => {
    const playersMap = new Map<number, { id: number; name: string; number: number }>();
    matchesData.forEach(({ stats }) => {
      stats.forEach(s => {
        if (!playersMap.has(s.player_id)) {
          playersMap.set(s.player_id, {
            id: s.player_id,
            name: s.player_name || '',
            number: s.player_number || 0,
          });
        }
      });
    });
    return Array.from(playersMap.values()).sort((a, b) => a.number - b.number);
  }, [matchesData]);

  // Calcular estadísticas agregadas
  const aggregatedStats = useMemo(() => {
    const totalGP = matchPerformances.reduce((sum, m) => sum + m.gp, 0);
    const totalActions = matchPerformances.reduce((sum, m) => sum + m.totalActions, 0);
    const wins = matchPerformances.filter(m => m.result === 'win').length;
    const losses = matchPerformances.filter(m => m.result === 'loss').length;

    // Promedios por categoría
    const categoryAverages: Record<string, { avgGP: number; avgPercentage: number; count: number }> = {};
    matchPerformances.forEach(mp => {
      Object.entries(mp.categories).forEach(([cat, data]) => {
        if (!categoryAverages[cat]) {
          categoryAverages[cat] = { avgGP: 0, avgPercentage: 0, count: 0 };
        }
        categoryAverages[cat].avgGP += data.gp;
        categoryAverages[cat].avgPercentage += data.percentage;
        categoryAverages[cat].count += 1;
      });
    });

    Object.keys(categoryAverages).forEach(cat => {
      const count = categoryAverages[cat].count;
      if (count > 0) {
        categoryAverages[cat].avgGP = Math.round((categoryAverages[cat].avgGP / count) * 10) / 10;
        categoryAverages[cat].avgPercentage = Math.round(categoryAverages[cat].avgPercentage / count);
      }
    });

    return {
      totalGP,
      totalActions,
      matchCount: matchPerformances.length,
      wins,
      losses,
      avgGP: matchPerformances.length > 0 ? Math.round((totalGP / matchPerformances.length) * 10) / 10 : 0,
      categoryAverages,
    };
  }, [matchPerformances]);

  // Formatear fecha
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${day} ${monthNames[date.getMonth()]}`;
  };

  // Renderizar gráfico de líneas
  const renderLineChart = (data: { value: number; label: string }[], color: string, title: string) => {
    if (data.length < 2) {
      return (
        <View style={styles.noChartData}>
          <Text style={styles.noChartDataText}>Se necesitan al menos 2 partidos para mostrar el gráfico</Text>
        </View>
      );
    }

    const maxValue = Math.max(...data.map(d => Math.abs(d.value)), 1);
    const minValue = Math.min(...data.map(d => d.value), 0);
    const range = maxValue - minValue || 1;
    const padding = 40;
    const chartW = CHART_WIDTH - padding * 2;
    const chartH = CHART_HEIGHT - 50;

    const points = data.map((d, i) => {
      const x = padding + (i / (data.length - 1)) * chartW;
      const y = 25 + ((maxValue - d.value) / range) * chartH;
      return { x, y, value: d.value, label: d.label };
    });

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          {/* Grid lines */}
          <Line x1={padding} y1={25} x2={padding} y2={chartH + 25} stroke={Colors.border} strokeWidth={1} />
          <Line x1={padding} y1={chartH + 25} x2={CHART_WIDTH - padding} y2={chartH + 25} stroke={Colors.border} strokeWidth={1} />
          
          {/* Zero line if applicable */}
          {minValue < 0 && (
            <Line 
              x1={padding} 
              y1={25 + ((maxValue - 0) / range) * chartH} 
              x2={CHART_WIDTH - padding} 
              y2={25 + ((maxValue - 0) / range) * chartH} 
              stroke={Colors.textTertiary} 
              strokeWidth={1} 
              strokeDasharray="4,4"
            />
          )}

          {/* Line path */}
          <Path d={pathD} fill="none" stroke={color} strokeWidth={2} />

          {/* Data points */}
          {points.map((p, i) => (
            <G key={i}>
              <Circle cx={p.x} cy={p.y} r={6} fill={color} />
              <Circle cx={p.x} cy={p.y} r={3} fill="#fff" />
            </G>
          ))}

          {/* Labels */}
          {points.map((p, i) => (
            <G key={`label-${i}`}>
              <SvgText x={p.x} y={chartH + 45} fontSize={10} fill={Colors.textSecondary} textAnchor="middle">
                {p.label}
              </SvgText>
            </G>
          ))}
        </Svg>
      </View>
    );
  };

  // Renderizar gráfico de barras
  const renderBarChart = (data: { label: string; value: number; color: string }[], title: string) => {
    if (data.length === 0) return null;

    const maxValue = Math.max(...data.map(d => Math.abs(d.value)), 1);
    const barWidth = (CHART_WIDTH - 60) / data.length - 10;
    const chartH = CHART_HEIGHT - 50;

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          {/* Base line */}
          <Line x1={30} y1={chartH + 20} x2={CHART_WIDTH - 10} y2={chartH + 20} stroke={Colors.border} strokeWidth={1} />

          {/* Bars */}
          {data.map((d, i) => {
            const barHeight = (Math.abs(d.value) / maxValue) * (chartH - 10);
            const x = 35 + i * (barWidth + 10);
            const y = d.value >= 0 ? chartH + 20 - barHeight : chartH + 20;

            return (
              <G key={i}>
                <Rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight || 2}
                  fill={d.color}
                  rx={4}
                />
                <SvgText 
                  x={x + barWidth / 2} 
                  y={d.value >= 0 ? y - 5 : y + barHeight + 12} 
                  fontSize={11} 
                  fill={Colors.text} 
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {d.value >= 0 ? '+' : ''}{d.value}
                </SvgText>
                <SvgText 
                  x={x + barWidth / 2} 
                  y={chartH + 38} 
                  fontSize={9} 
                  fill={Colors.textSecondary} 
                  textAnchor="middle"
                >
                  {d.label.substring(0, 3)}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>
    );
  };

  // Renderizar gráfico de puntos (scatter)
  const renderScatterChart = () => {
    if (matchPerformances.length < 2) return null;

    const data = matchPerformances.map(mp => ({
      x: mp.totalActions,
      y: mp.gp,
      result: mp.result,
    }));

    const maxX = Math.max(...data.map(d => d.x), 1);
    const maxY = Math.max(...data.map(d => Math.abs(d.y)), 1);
    const minY = Math.min(...data.map(d => d.y), 0);
    const rangeY = maxY - minY || 1;
    const padding = 40;
    const chartW = CHART_WIDTH - padding * 2;
    const chartH = CHART_HEIGHT - 50;

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Acciones vs G-P por Partido</Text>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          {/* Axes */}
          <Line x1={padding} y1={25} x2={padding} y2={chartH + 25} stroke={Colors.border} strokeWidth={1} />
          <Line x1={padding} y1={chartH + 25} x2={CHART_WIDTH - padding} y2={chartH + 25} stroke={Colors.border} strokeWidth={1} />

          {/* Zero line */}
          {minY < 0 && (
            <Line 
              x1={padding} 
              y1={25 + ((maxY - 0) / rangeY) * chartH} 
              x2={CHART_WIDTH - padding} 
              y2={25 + ((maxY - 0) / rangeY) * chartH} 
              stroke={Colors.textTertiary} 
              strokeWidth={1} 
              strokeDasharray="4,4"
            />
          )}

          {/* Points */}
          {data.map((d, i) => {
            const px = padding + (d.x / maxX) * chartW;
            const py = 25 + ((maxY - d.y) / rangeY) * chartH;
            const color = d.result === 'win' ? '#22c55e' : d.result === 'loss' ? '#ef4444' : '#f59e0b';
            return (
              <Circle key={i} cx={px} cy={py} r={8} fill={color} opacity={0.8} />
            );
          })}

          {/* Labels */}
          <SvgText x={CHART_WIDTH / 2} y={CHART_HEIGHT - 5} fontSize={10} fill={Colors.textSecondary} textAnchor="middle">
            Total Acciones
          </SvgText>
          <SvgText x={15} y={CHART_HEIGHT / 2} fontSize={10} fill={Colors.textSecondary} textAnchor="middle" rotation={-90} origin={`15, ${CHART_HEIGHT / 2}`}>
            G-P
          </SvgText>
        </Svg>
        <View style={styles.scatterLegend}>
          <View style={styles.scatterLegendItem}>
            <View style={[styles.scatterDot, { backgroundColor: '#22c55e' }]} />
            <Text style={styles.scatterLegendText}>Victoria</Text>
          </View>
          <View style={styles.scatterLegendItem}>
            <View style={[styles.scatterDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.scatterLegendText}>Derrota</Text>
          </View>
        </View>
      </View>
    );
  };

  // Generar informe para exportar
  const generateReport = async (format: 'text' | 'excel') => {
    const teamName = teams.find(t => t.id === selectedTeam)?.name || 'Mi Equipo';
    const playerName = selectedPlayer 
      ? uniquePlayers.find(p => p.id === selectedPlayer)?.name 
      : null;

    if (format === 'text') {
      let report = `◆ INFORME DE SEGUIMIENTO\n`;
      report += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
      report += `Equipo: ${teamName}\n`;
      if (playerName) report += `Jugador: ${playerName}\n`;
      report += `\n`;

      report += `📊 RESUMEN GENERAL\n`;
      report += `• Partidos analizados: ${aggregatedStats.matchCount}\n`;
      report += `• Victorias/Derrotas: ${aggregatedStats.wins}/${aggregatedStats.losses}\n`;
      report += `• G-P Total: ${aggregatedStats.totalGP >= 0 ? '+' : ''}${aggregatedStats.totalGP}\n`;
      report += `• G-P Promedio: ${aggregatedStats.avgGP >= 0 ? '+' : ''}${aggregatedStats.avgGP}\n`;
      report += `• Acciones totales: ${aggregatedStats.totalActions}\n\n`;

      report += `📈 RENDIMIENTO POR CATEGORÍA\n`;
      Object.entries(aggregatedStats.categoryAverages)
        .sort((a, b) => b[1].avgGP - a[1].avgGP)
        .forEach(([cat, data]) => {
          report += `• ${cat}: G-P ${data.avgGP >= 0 ? '+' : ''}${data.avgGP} | ${data.avgPercentage}% efectividad\n`;
        });

      report += `\n📅 EVOLUCIÓN POR PARTIDO\n`;
      matchPerformances.forEach(mp => {
        const resultIcon = mp.result === 'win' ? '✅' : mp.result === 'loss' ? '❌' : '➖';
        report += `${resultIcon} ${formatDate(mp.date)} vs ${mp.opponent}: G-P ${mp.gp >= 0 ? '+' : ''}${mp.gp} (${mp.totalActions} acc.)\n`;
      });

      report += `\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
      report += `Generado con VBStats Pro\n`;
      report += `BlueDeBug.com`;

      await Share.share({
        message: report,
        title: `Seguimiento: ${teamName}`,
      });
    } else {
      // Para Excel, generamos un CSV que se puede abrir en Excel
      let csv = 'Informe de Seguimiento - VBStats Pro\n\n';
      csv += `Equipo,${teamName}\n`;
      if (playerName) csv += `Jugador,${playerName}\n`;
      csv += '\n';

      csv += 'RESUMEN GENERAL\n';
      csv += `Partidos analizados,${aggregatedStats.matchCount}\n`;
      csv += `Victorias,${aggregatedStats.wins}\n`;
      csv += `Derrotas,${aggregatedStats.losses}\n`;
      csv += `G-P Total,${aggregatedStats.totalGP}\n`;
      csv += `G-P Promedio,${aggregatedStats.avgGP}\n`;
      csv += `Acciones totales,${aggregatedStats.totalActions}\n\n`;

      csv += 'RENDIMIENTO POR CATEGORÍA\n';
      csv += 'Categoría,G-P Promedio,Efectividad %\n';
      Object.entries(aggregatedStats.categoryAverages).forEach(([cat, data]) => {
        csv += `${cat},${data.avgGP},${data.avgPercentage}\n`;
      });

      csv += '\nEVOLUCIÓN POR PARTIDO\n';
      csv += 'Fecha,Rival,Resultado,G-P,Acciones,';
      STAT_CATEGORIES.forEach(cat => csv += `${cat} G-P,${cat} %,`);
      csv += '\n';

      matchPerformances.forEach(mp => {
        csv += `${formatDate(mp.date)},${mp.opponent},${mp.result},${mp.gp},${mp.totalActions},`;
        STAT_CATEGORIES.forEach(cat => {
          const catData = mp.categories[cat];
          csv += `${catData?.gp || 0},${catData?.percentage || 0},`;
        });
        csv += '\n';
      });

      await Share.share({
        message: csv,
        title: `Seguimiento_${teamName}.csv`,
      });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.menuButton} onPress={onOpenMenu}>
            <MenuIcon size={28} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <MaterialCommunityIcons name="chart-timeline-variant" size={24} color={Colors.primary} />
            <Text style={styles.headerTitle}>Seguimiento</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Cargando datos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={onOpenMenu}>
          <MenuIcon size={28} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <MaterialCommunityIcons name="chart-timeline-variant" size={24} color={Colors.primary} />
          <Text style={styles.headerTitle}>Seguimiento</Text>
        </View>
        <TouchableOpacity 
          style={styles.exportButton} 
          onPress={() => setShowExportAlert(true)}
        >
          <MaterialCommunityIcons name="export-variant" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Selector de equipo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Equipo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterRow}>
              {teams.map(team => (
                <TouchableOpacity
                  key={team.id}
                  style={[styles.filterChip, selectedTeam === team.id && styles.filterChipActive]}
                  onPress={() => {
                    setSelectedTeam(team.id);
                    setSelectedPlayer(null);
                  }}
                >
                  <Text style={[styles.filterChipText, selectedTeam === team.id && styles.filterChipTextActive]}>
                    {team.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Selector de jugador */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Filtrar por jugador</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, selectedPlayer === null && styles.filterChipActive]}
                onPress={() => setSelectedPlayer(null)}
              >
                <Text style={[styles.filterChipText, selectedPlayer === null && styles.filterChipTextActive]}>
                  Todo el equipo
                </Text>
              </TouchableOpacity>
              {uniquePlayers.map(player => (
                <TouchableOpacity
                  key={player.id}
                  style={[styles.filterChip, selectedPlayer === player.id && styles.filterChipActive]}
                  onPress={() => setSelectedPlayer(player.id)}
                >
                  <Text style={[styles.filterChipText, selectedPlayer === player.id && styles.filterChipTextActive]}>
                    #{player.number} {player.name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {matchPerformances.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="chart-line" size={80} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>Sin datos</Text>
            <Text style={styles.emptyText}>
              No hay partidos finalizados para este equipo
            </Text>
          </View>
        ) : (
          <>
            {/* Tarjetas de resumen */}
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{aggregatedStats.matchCount}</Text>
                <Text style={styles.summaryLabel}>Partidos</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{aggregatedStats.wins}/{aggregatedStats.losses}</Text>
                <Text style={styles.summaryLabel}>V/D</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={[
                  styles.summaryValue,
                  aggregatedStats.totalGP > 0 && styles.positiveValue,
                  aggregatedStats.totalGP < 0 && styles.negativeValue,
                ]}>
                  {aggregatedStats.totalGP >= 0 ? '+' : ''}{aggregatedStats.totalGP}
                </Text>
                <Text style={styles.summaryLabel}>G-P Total</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{aggregatedStats.totalActions}</Text>
                <Text style={styles.summaryLabel}>Acciones</Text>
              </View>
            </View>

            {/* Selector de tipo de gráfico */}
            <View style={styles.chartTypeSelector}>
              <TouchableOpacity
                style={[styles.chartTypeButton, chartType === 'line' && styles.chartTypeButtonActive]}
                onPress={() => setChartType('line')}
              >
                <MaterialCommunityIcons 
                  name="chart-line" 
                  size={20} 
                  color={chartType === 'line' ? Colors.textOnPrimary : Colors.textSecondary} 
                />
                <Text style={[styles.chartTypeText, chartType === 'line' && styles.chartTypeTextActive]}>
                  Líneas
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chartTypeButton, chartType === 'bar' && styles.chartTypeButtonActive]}
                onPress={() => setChartType('bar')}
              >
                <MaterialCommunityIcons 
                  name="chart-bar" 
                  size={20} 
                  color={chartType === 'bar' ? Colors.textOnPrimary : Colors.textSecondary} 
                />
                <Text style={[styles.chartTypeText, chartType === 'bar' && styles.chartTypeTextActive]}>
                  Barras
                </Text>
              </TouchableOpacity>
            </View>

            {/* Gráfico de evolución G-P */}
            {chartType === 'line' ? (
              renderLineChart(
                matchPerformances.map(mp => ({ 
                  value: mp.gp, 
                  label: formatDate(mp.date) 
                })),
                Colors.primary,
                'Evolución G-P por Partido'
              )
            ) : (
              renderBarChart(
                matchPerformances.map(mp => ({
                  label: formatDate(mp.date),
                  value: mp.gp,
                  color: mp.result === 'win' ? '#22c55e' : mp.result === 'loss' ? '#ef4444' : '#f59e0b',
                })),
                'G-P por Partido'
              )
            )}

            {/* Gráfico de puntos */}
            {renderScatterChart()}

            {/* Rendimiento por categoría */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Promedio por Categoría</Text>
              {renderBarChart(
                Object.entries(aggregatedStats.categoryAverages)
                  .filter(([cat]) => STAT_CATEGORIES.includes(cat))
                  .map(([cat, data]) => ({
                    label: cat,
                    value: data.avgGP,
                    color: CATEGORY_COLORS[cat] || Colors.primary,
                  })),
                'G-P Promedio por Categoría'
              )}
            </View>

            {/* Lista de partidos */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Historial de Partidos</Text>
              {matchPerformances.map((mp, idx) => (
                <View key={mp.matchId} style={styles.matchItem}>
                  <View style={styles.matchItemHeader}>
                    <View style={styles.matchItemDate}>
                      <MaterialCommunityIcons 
                        name={mp.result === 'win' ? 'check-circle' : mp.result === 'loss' ? 'close-circle' : 'minus-circle'} 
                        size={20} 
                        color={mp.result === 'win' ? '#22c55e' : mp.result === 'loss' ? '#ef4444' : '#f59e0b'} 
                      />
                      <Text style={styles.matchItemDateText}>{formatDate(mp.date)}</Text>
                    </View>
                    <Text style={styles.matchItemOpponent}>vs {mp.opponent}</Text>
                  </View>
                  <View style={styles.matchItemStats}>
                    <View style={styles.matchItemStat}>
                      <Text style={styles.matchItemStatLabel}>G-P</Text>
                      <Text style={[
                        styles.matchItemStatValue,
                        mp.gp > 0 && styles.positiveValue,
                        mp.gp < 0 && styles.negativeValue,
                      ]}>
                        {mp.gp >= 0 ? '+' : ''}{mp.gp}
                      </Text>
                    </View>
                    <View style={styles.matchItemStat}>
                      <Text style={styles.matchItemStatLabel}>Acc.</Text>
                      <Text style={styles.matchItemStatValue}>{mp.totalActions}</Text>
                    </View>
                    <View style={styles.matchItemStat}>
                      <Text style={styles.matchItemStatLabel}>Score</Text>
                      <Text style={styles.matchItemStatValue}>{mp.scoreHome}-{mp.scoreAway}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Alert de exportación */}
      <CustomAlert
        visible={showExportAlert}
        icon={<MaterialCommunityIcons name="export-variant" size={48} color={Colors.primary} />}
        iconBackgroundColor={Colors.primary + '15'}
        title="Exportar Informe"
        message="Elige el formato de exportación del informe de seguimiento"
        buttonLayout="column"
        buttons={[
          {
            text: 'Compartir por Redes',
            icon: <MaterialCommunityIcons name="share-variant" size={18} color="#fff" />,
            onPress: () => {
              setShowExportAlert(false);
              generateReport('text');
            },
            style: 'primary',
          },
          {
            text: 'Exportar a Excel (CSV)',
            icon: <MaterialCommunityIcons name="microsoft-excel" size={18} color="#fff" />,
            onPress: () => {
              setShowExportAlert(false);
              generateReport('excel');
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
  headerRight: {
    width: 44,
  },
  exportButton: {
    padding: Spacing.sm,
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
  scrollContent: {
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.textOnPrimary,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
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
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadows.sm,
  },
  summaryValue: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.text,
  },
  summaryLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  positiveValue: {
    color: '#22c55e',
  },
  negativeValue: {
    color: '#ef4444',
  },
  chartTypeSelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  chartTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chartTypeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chartTypeText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  chartTypeTextActive: {
    color: Colors.textOnPrimary,
    fontWeight: '600',
  },
  chartContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  chartTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  noChartData: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noChartDataText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  scatterLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  scatterLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  scatterDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  scatterLegendText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  matchItem: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  matchItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  matchItemDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  matchItemDateText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  matchItemOpponent: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  matchItemStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  matchItemStat: {
    alignItems: 'center',
  },
  matchItemStatLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  matchItemStatValue: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
});
