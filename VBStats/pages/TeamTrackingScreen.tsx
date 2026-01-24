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
import { POSITION_STATS } from '../services/statTemplates';
import type { Match, MatchStatsSummary, MatchStat } from '../services/types';
import { StatsIcon, MenuIcon, TeamIcon } from '../components/VectorIcons';
import CustomAlert from '../components/CustomAlert';

const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;
const ANDROID_NAV_BAR_HEIGHT = 48;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 240;

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

const MATCH_RESULT_COLORS: Record<'win' | 'loss' | 'draw', string> = {
  win: '#22c55e',
  loss: '#ef4444',
  draw: '#f59e0b',
};

const getMatchResultColor = (result: MatchPerformance['result']) => MATCH_RESULT_COLORS[result];

// Categorías de estadísticas
const STAT_CATEGORIES = ['Recepción', 'Ataque', 'Bloqueo', 'Saque', 'Defensa', 'Colocación'];
const normalizeCategoryKey = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
const CATEGORY_COLORS = Object.values(POSITION_STATS).reduce((map, configs) => {
  configs.forEach((stat) => {
    const key = normalizeCategoryKey(stat.category);
    if (!map[key]) {
      map[key] = stat.color;
    }
  });
  return map;
}, {} as Record<string, string>);

export default function TeamTrackingScreen({ 
  userId, 
  teams, 
  onBack, 
  onOpenMenu 
}: TeamTrackingScreenProps) {
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [matchesData, setMatchesData] = useState<{ match: Match; stats: MatchStat[] }[]>([]);
  const [showExportAlert, setShowExportAlert] = useState(false);
  const [teamSelectionConfirmed, setTeamSelectionConfirmed] = useState(false);

  useEffect(() => {
    if (selectedTeam && teamSelectionConfirmed) {
      loadTeamData(selectedTeam);
    }
  }, [selectedTeam, teamSelectionConfirmed]);

  const confirmTeamSelection = (teamId: number) => {
    setSelectedTeam(teamId);
    setSelectedPlayer(null);
    setTeamSelectionConfirmed(true);
  };

  const reopenTeamSelector = () => {
    setTeamSelectionConfirmed(false);
    setMatchesData([]);
    setSelectedPlayer(null);
  };

  const selectedTeamName = teams.find(t => t.id === selectedTeam)?.name;

  const renderHeader = (showActions: boolean) => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.menuButton} onPress={onOpenMenu}>
        <MenuIcon size={28} color={Colors.text} />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <StatsIcon size={24} color={Colors.primary} />
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerTitle}>Seguimiento</Text>
          {selectedTeamName ? (
            <Text style={styles.headerSubtitle}>{selectedTeamName}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.headerActions}>
        {showActions && teamSelectionConfirmed && teams.length > 1 && (
          <TouchableOpacity style={styles.changeTeamButton} onPress={reopenTeamSelector}>
            <MaterialCommunityIcons name="swap-horizontal" size={20} color={Colors.primary} />
            <Text style={styles.changeTeamText}>Cambiar</Text>
          </TouchableOpacity>
        )}
        {showActions && (
          <TouchableOpacity style={styles.exportButton} onPress={() => setShowExportAlert(true)}>
            <MaterialCommunityIcons name="export-variant" size={24} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

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

      setMatchesData(matchesWithStats);
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

  // Generar path suavizado con curvas bezier
  const generateSmoothPath = (points: { x: number; y: number }[]): string => {
    if (points.length < 2) return '';
    
    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? i : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
      
      const tension = 0.3;
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    
    return path;
  };

  // Renderizar gráfico de líneas suavizadas con ejes
  const renderSmoothLineChart = (
    data: { value: number; label: string }[], 
    color: string, 
    title: string,
    unit: string = '',
    showSign: boolean = true
  ) => {
    if (data.length < 2) {
      return (
        <View style={styles.noChartData}>
          <Text style={styles.noChartDataText}>Se necesitan al menos 2 partidos para mostrar el gráfico</Text>
        </View>
      );
    }

    const values = data.map(d => d.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;
    const padding = 50;
    const chartW = CHART_WIDTH - padding - 20;
    const chartH = CHART_HEIGHT - 80;

    // Calcular valores de eje Y
    const yAxisValues = [];
    const step = range / 4;
    for (let i = 0; i <= 4; i++) {
      yAxisValues.push(Math.round((maxValue - step * i) * 10) / 10);
    }

    const points = data.map((d, i) => {
      const x = padding + (i / (data.length - 1)) * chartW;
      const y = 30 + ((maxValue - d.value) / range) * chartH;
      return { x, y, value: d.value, label: d.label };
    });

    const smoothPath = generateSmoothPath(points);

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          {/* Grid horizontal lines */}
          {yAxisValues.map((val, i) => {
            const y = 30 + (i / 4) * chartH;
            return (
              <G key={`grid-${i}`}>
                <Line x1={padding} y1={y} x2={CHART_WIDTH - 20} y2={y} stroke={Colors.border} strokeWidth={1} strokeDasharray="4,4" />
                <SvgText x={padding - 8} y={y + 4} fontSize={9} fill={Colors.textSecondary} textAnchor="end">
                  {showSign && val >= 0 ? '+' : ''}{val}{unit}
                </SvgText>
              </G>
            );
          })}

          {/* Eje Y */}
          <Line x1={padding} y1={30} x2={padding} y2={chartH + 30} stroke={Colors.border} strokeWidth={1} />
          
          {/* Zero line if applicable */}
          {minValue < 0 && maxValue > 0 && (
            <Line 
              x1={padding} 
              y1={30 + ((maxValue - 0) / range) * chartH} 
              x2={CHART_WIDTH - 20} 
              y2={30 + ((maxValue - 0) / range) * chartH} 
              stroke={Colors.textTertiary} 
              strokeWidth={2} 
            />
          )}

          {/* Línea suavizada */}
          <Path d={smoothPath} fill="none" stroke={color} strokeWidth={3} />

          {/* Puntos de datos */}
          {points.map((p, i) => (
            <G key={i}>
              <Circle cx={p.x} cy={p.y} r={6} fill={color} />
              <Circle cx={p.x} cy={p.y} r={3} fill="#fff" />
            </G>
          ))}

          {/* Labels eje X */}
          {points.map((p, i) => (
            <SvgText key={`label-${i}`} x={p.x} y={chartH + 50} fontSize={9} fill={Colors.textSecondary} textAnchor="middle">
              {p.label.length > 6 ? p.label.substring(0, 6) : p.label}
            </SvgText>
          ))}
        </Svg>
      </View>
    );
  };

  // Renderizar gráfico de líneas múltiples (2 series)
  const renderDualLineChart = (
    data1: { value: number; label: string }[],
    data2: { value: number; label: string }[],
    color1: string,
    color2: string,
    title: string,
    legend1: string,
    legend2: string,
    unit1: string = '%',
    unit2: string = ''
  ) => {
    if (data1.length < 2) {
      return (
        <View style={styles.noChartData}>
          <Text style={styles.noChartDataText}>Se necesitan al menos 2 partidos para mostrar el gráfico</Text>
        </View>
      );
    }

    const values1 = data1.map(d => d.value);
    const values2 = data2.map(d => d.value);
    const maxValue1 = Math.max(...values1);
    const minValue1 = Math.min(...values1);
    const maxValue2 = Math.max(...values2);
    const minValue2 = Math.min(...values2);
    
    const range1 = maxValue1 - minValue1 || 1;
    const range2 = maxValue2 - minValue2 || 1;
    
    const padding = 45;
    const paddingRight = 45;
    const chartW = CHART_WIDTH - padding - paddingRight;
    const chartH = CHART_HEIGHT - 80;

    const points1 = data1.map((d, i) => {
      const x = padding + (i / (data1.length - 1)) * chartW;
      const y = 30 + ((maxValue1 - d.value) / range1) * chartH;
      return { x, y, value: d.value };
    });

    const points2 = data2.map((d, i) => {
      const x = padding + (i / (data2.length - 1)) * chartW;
      const y = 30 + ((maxValue2 - d.value) / range2) * chartH;
      return { x, y, value: d.value };
    });

    const smoothPath1 = generateSmoothPath(points1);
    const smoothPath2 = generateSmoothPath(points2);

    // Valores eje Y izquierdo (serie 1)
    const yAxis1Values = [maxValue1, Math.round((maxValue1 + minValue1) / 2), minValue1];
    // Valores eje Y derecho (serie 2)  
    const yAxis2Values = [maxValue2, Math.round((maxValue2 + minValue2) / 2), minValue2];

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          {/* Grid lines */}
          {[0, 0.5, 1].map((ratio, i) => {
            const y = 30 + ratio * chartH;
            return (
              <G key={`grid-${i}`}>
                <Line x1={padding} y1={y} x2={CHART_WIDTH - paddingRight} y2={y} stroke={Colors.border} strokeWidth={1} strokeDasharray="4,4" />
                <SvgText x={padding - 5} y={y + 4} fontSize={8} fill={color1} textAnchor="end">
                  {yAxis1Values[i]}{unit1}
                </SvgText>
                <SvgText x={CHART_WIDTH - paddingRight + 5} y={y + 4} fontSize={8} fill={color2} textAnchor="start">
                  {yAxis2Values[i]}{unit2}
                </SvgText>
              </G>
            );
          })}

          {/* Ejes */}
          <Line x1={padding} y1={30} x2={padding} y2={chartH + 30} stroke={color1} strokeWidth={2} />
          <Line x1={CHART_WIDTH - paddingRight} y1={30} x2={CHART_WIDTH - paddingRight} y2={chartH + 30} stroke={color2} strokeWidth={2} />

          {/* Líneas suavizadas */}
          <Path d={smoothPath1} fill="none" stroke={color1} strokeWidth={2.5} />
          <Path d={smoothPath2} fill="none" stroke={color2} strokeWidth={2.5} strokeDasharray="6,3" />

          {/* Puntos */}
          {points1.map((p, i) => (
            <Circle key={`p1-${i}`} cx={p.x} cy={p.y} r={4} fill={color1} />
          ))}
          {points2.map((p, i) => (
            <Circle key={`p2-${i}`} cx={p.x} cy={p.y} r={4} fill={color2} />
          ))}

          {/* Labels eje X */}
          {data1.map((d, i) => {
            const x = padding + (i / (data1.length - 1)) * chartW;
            return (
              <SvgText key={`label-${i}`} x={x} y={chartH + 50} fontSize={8} fill={Colors.textSecondary} textAnchor="middle">
                {d.label.length > 5 ? d.label.substring(0, 5) : d.label}
              </SvgText>
            );
          })}
        </Svg>
        {/* Leyenda */}
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: color1 }]} />
            <Text style={styles.legendText}>{legend1}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendLineDashed, { borderColor: color2 }]} />
            <Text style={styles.legendText}>{legend2}</Text>
          </View>
        </View>
      </View>
    );
  };

  // Renderizar gráfico de barras mejorado con manejo de negativos
  const renderImprovedBarChart = (data: { label: string; value: number; color: string }[], title: string) => {
    if (data.length === 0) return null;

    const values = data.map(d => d.value);
    const maxValue = Math.max(...values, 0);
    const minValue = Math.min(...values, 0);
    const range = maxValue - minValue || 1;
    
    const padding = 50;
    const chartW = CHART_WIDTH - padding - 20;
    const chartH = CHART_HEIGHT - 90;
    const barWidth = Math.min((chartW / data.length) - 12, 45);
    
    // Posición de la línea cero
    const zeroY = 30 + (maxValue / range) * chartH;

    // Valores del eje Y
    const yAxisValues = [];
    const step = range / 4;
    for (let i = 0; i <= 4; i++) {
      yAxisValues.push(Math.round((maxValue - step * i) * 10) / 10);
    }

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          {/* Grid y etiquetas eje Y */}
          {yAxisValues.map((val, i) => {
            const y = 30 + (i / 4) * chartH;
            return (
              <G key={`grid-${i}`}>
                <Line x1={padding} y1={y} x2={CHART_WIDTH - 20} y2={y} stroke={Colors.border} strokeWidth={1} strokeDasharray="4,4" />
                <SvgText x={padding - 8} y={y + 4} fontSize={9} fill={Colors.textSecondary} textAnchor="end">
                  {val >= 0 ? '+' : ''}{val}
                </SvgText>
              </G>
            );
          })}

          {/* Eje Y */}
          <Line x1={padding} y1={30} x2={padding} y2={chartH + 30} stroke={Colors.border} strokeWidth={1} />
          
          {/* Línea cero */}
          <Line x1={padding} y1={zeroY} x2={CHART_WIDTH - 20} y2={zeroY} stroke={Colors.text} strokeWidth={1.5} />

          {/* Barras */}
          {data.map((d, i) => {
            const totalWidth = data.length * (barWidth + 12);
            const startX = padding + (chartW - totalWidth) / 2 + 6;
            const x = startX + i * (barWidth + 12);
            
            const barHeight = Math.abs(d.value) / range * chartH;
            const y = d.value >= 0 ? zeroY - barHeight : zeroY;

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
                  y={d.value >= 0 ? y - 6 : y + barHeight + 14} 
                  fontSize={10} 
                  fill={Colors.text} 
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {d.value >= 0 ? '+' : ''}{d.value}
                </SvgText>
                <SvgText 
                  x={x + barWidth / 2} 
                  y={chartH + 50} 
                  fontSize={8} 
                  fill={Colors.textSecondary} 
                  textAnchor="middle"
                >
                  {d.label.length > 5 ? d.label.substring(0, 5) : d.label}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>
    );
  };

  // Renderizar gráfico de línea simple para acciones positivas
  const renderSimpleLineChart = (
    data: { value: number; label: string }[], 
    color: string, 
    title: string
  ) => {
    if (data.length < 2) {
      return (
        <View style={styles.noChartData}>
          <Text style={styles.noChartDataText}>Se necesitan al menos 2 partidos para mostrar el gráfico</Text>
        </View>
      );
    }

    const values = data.map(d => d.value);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, 0);
    const range = maxValue - minValue || 1;
    const padding = 45;
    const chartW = CHART_WIDTH - padding - 20;
    const chartH = CHART_HEIGHT - 80;

    const points = data.map((d, i) => {
      const x = padding + (i / (data.length - 1)) * chartW;
      const y = 30 + ((maxValue - d.value) / range) * chartH;
      return { x, y, value: d.value, label: d.label };
    });

    const smoothPath = generateSmoothPath(points);

    // Valores eje Y
    const yAxisValues = [maxValue, Math.round((maxValue + minValue) / 2), minValue];

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          {/* Grid */}
          {yAxisValues.map((val, i) => {
            const y = 30 + (i / 2) * chartH;
            return (
              <G key={`grid-${i}`}>
                <Line x1={padding} y1={y} x2={CHART_WIDTH - 20} y2={y} stroke={Colors.border} strokeWidth={1} strokeDasharray="4,4" />
                <SvgText x={padding - 8} y={y + 4} fontSize={9} fill={Colors.textSecondary} textAnchor="end">
                  {val}
                </SvgText>
              </G>
            );
          })}

          <Line x1={padding} y1={30} x2={padding} y2={chartH + 30} stroke={Colors.border} strokeWidth={1} />

          {/* Línea suavizada */}
          <Path d={smoothPath} fill="none" stroke={color} strokeWidth={3} />

          {/* Puntos */}
          {points.map((p, i) => (
            <G key={i}>
              <Circle cx={p.x} cy={p.y} r={5} fill={color} />
              <Circle cx={p.x} cy={p.y} r={2} fill="#fff" />
            </G>
          ))}

          {/* Labels */}
          {points.map((p, i) => (
            <SvgText key={`label-${i}`} x={p.x} y={chartH + 50} fontSize={9} fill={Colors.textSecondary} textAnchor="middle">
              {p.label.length > 6 ? p.label.substring(0, 6) : p.label}
            </SvgText>
          ))}
        </Svg>
      </View>
    );
  };

  // Calcular estadísticas detalladas por partido y categoría
  const getDetailedCategoryStats = useMemo(() => {
    return matchesData.map(({ match, stats }) => {
      let filteredStats = stats;
      if (selectedPlayer) {
        filteredStats = stats.filter(s => s.player_id === selectedPlayer);
      }

      const categoryDetails: Record<string, {
        total: number;
        doblePositivo: number;
        positivo: number;
        neutro: number;
        error: number;
        eficacia: number;
        puntoDirecto: number;
      }> = {};

      filteredStats.forEach(stat => {
        const category = stat.stat_category;
        const normalized = stat.stat_type.toLowerCase().trim();
        
        if (!categoryDetails[category]) {
          categoryDetails[category] = {
            total: 0,
            doblePositivo: 0,
            positivo: 0,
            neutro: 0,
            error: 0,
            eficacia: 0,
            puntoDirecto: 0,
          };
        }

        categoryDetails[category].total += 1;

        if (normalized.includes('doble positiv') || normalized === '++') {
          categoryDetails[category].doblePositivo += 1;
        } else if (normalized.includes('punto directo') || normalized.includes('ace')) {
          categoryDetails[category].puntoDirecto += 1;
          categoryDetails[category].positivo += 1;
        } else if (normalized.includes('positiv') || normalized === '+') {
          categoryDetails[category].positivo += 1;
        } else if (normalized.includes('neutr') || normalized === '-' || normalized === '=') {
          categoryDetails[category].neutro += 1;
        } else if (normalized.includes('error')) {
          categoryDetails[category].error += 1;
        }
      });

      // Calcular eficacia por categoría
      Object.keys(categoryDetails).forEach(cat => {
        const d = categoryDetails[cat];
        if (d.total > 0) {
          // Eficacia = (doblePos + pos - error) / total * 100
          d.eficacia = Math.round(((d.doblePositivo + d.positivo - d.error) / d.total) * 100);
        }
      });

      return {
        matchId: match.id,
        opponent: match.opponent || 'Sin rival',
        categoryDetails,
      };
    });
  }, [matchesData, selectedPlayer]);

  // Renderizar gráficos de progreso por categoría
  const renderCategoryProgressCharts = () => {
    if (matchPerformances.length < 2) {
      return (
        <View style={styles.noChartData}>
          <Text style={styles.noChartDataText}>Se necesitan al menos 2 partidos para mostrar el progreso por categoría</Text>
        </View>
      );
    }

    const categoryColor = (cat: string) => CATEGORY_COLORS[normalizeCategoryKey(cat)] || Colors.primary;

    // Datos para Recepción
    const recepcionData = getDetailedCategoryStats.map(m => ({
      eficacia: m.categoryDetails['Recepción']?.eficacia || 0,
      doblePositivo: m.categoryDetails['Recepción']?.doblePositivo || 0,
      label: m.opponent.length > 5 ? m.opponent.substring(0, 5) : m.opponent,
    }));

    // Datos para Ataque
    const ataqueData = getDetailedCategoryStats.map(m => ({
      eficacia: m.categoryDetails['Ataque']?.total > 0 
        ? Math.round((m.categoryDetails['Ataque']?.positivo || 0) / m.categoryDetails['Ataque'].total * 100)
        : 0,
      puntos: m.categoryDetails['Ataque']?.positivo || 0,
      label: m.opponent.length > 5 ? m.opponent.substring(0, 5) : m.opponent,
    }));

    // Datos para Bloqueo (acciones positivas)
    const bloqueoData = getDetailedCategoryStats.map(m => ({
      value: m.categoryDetails['Bloqueo']?.positivo || 0,
      label: m.opponent.length > 5 ? m.opponent.substring(0, 5) : m.opponent,
    }));

    // Datos para Defensa (acciones positivas)
    const defensaData = getDetailedCategoryStats.map(m => ({
      value: m.categoryDetails['Defensa']?.positivo || 0,
      label: m.opponent.length > 5 ? m.opponent.substring(0, 5) : m.opponent,
    }));

    // Datos para Saque (puntos directos)
    const saqueData = getDetailedCategoryStats.map(m => ({
      value: m.categoryDetails['Saque']?.puntoDirecto || 0,
      label: m.opponent.length > 5 ? m.opponent.substring(0, 5) : m.opponent,
    }));

    const hasRecepcion = recepcionData.some(d => d.eficacia !== 0 || d.doblePositivo !== 0);
    const hasAtaque = ataqueData.some(d => d.eficacia !== 0 || d.puntos !== 0);
    const hasBloqueo = bloqueoData.some(d => d.value !== 0);
    const hasDefensa = defensaData.some(d => d.value !== 0);
    const hasSaque = saqueData.some(d => d.value !== 0);

    if (!hasRecepcion && !hasAtaque && !hasBloqueo && !hasDefensa && !hasSaque) {
      return (
        <View style={styles.noChartData}>
          <Text style={styles.noChartDataText}>No hay datos de categorías registrados</Text>
        </View>
      );
    }

    return (
      <View>
        {/* Recepción: Eficacia + Dobles Positivos */}
        {hasRecepcion && renderDualLineChart(
          recepcionData.map(d => ({ value: d.eficacia, label: d.label })),
          recepcionData.map(d => ({ value: d.doblePositivo, label: d.label })),
          categoryColor('Recepción'),
          '#0ea5e9',
          'Recepción - Progreso',
          'Eficacia %',
          'Dobles ++',
          '%',
          ''
        )}

        {/* Ataque: Eficacia + Puntos */}
        {hasAtaque && renderDualLineChart(
          ataqueData.map(d => ({ value: d.eficacia, label: d.label })),
          ataqueData.map(d => ({ value: d.puntos, label: d.label })),
          categoryColor('Ataque'),
          '#f59e0b',
          'Ataque - Progreso',
          'Eficacia %',
          'Puntos',
          '%',
          ''
        )}

        {/* Bloqueo: Acciones positivas */}
        {hasBloqueo && renderSimpleLineChart(
          bloqueoData,
          categoryColor('Bloqueo'),
          'Bloqueo - Positivos por Partido'
        )}

        {/* Defensa: Acciones positivas */}
        {hasDefensa && renderSimpleLineChart(
          defensaData,
          categoryColor('Defensa'),
          'Defensa - Positivos por Partido'
        )}

        {/* Saque: Puntos directos */}
        {hasSaque && renderSimpleLineChart(
          saqueData,
          categoryColor('Saque'),
          'Saque - Puntos Directos por Partido'
        )}
      </View>
    );
  };

  // Calcular TOP de jugadores
  const playerRankings = useMemo(() => {
    const playerStats: Record<number, {
      id: number;
      name: string;
      number: number;
      ataquePositivo: number;
      ataqueTotalPuntos: number;
      ataqueTotal: number;
      recepcionEficacia: number;
      recepcionTotal: number;
      defensaPositivo: number;
      bloqueoPositivo: number;
      saquePuntoDirecto: number;
    }> = {};

    matchesData.forEach(({ stats }) => {
      stats.forEach(stat => {
        const playerId = stat.player_id;
        if (!playerStats[playerId]) {
          playerStats[playerId] = {
            id: playerId,
            name: stat.player_name || 'Jugador',
            number: stat.player_number || 0,
            ataquePositivo: 0,
            ataqueTotalPuntos: 0,
            ataqueTotal: 0,
            recepcionEficacia: 0,
            recepcionTotal: 0,
            defensaPositivo: 0,
            bloqueoPositivo: 0,
            saquePuntoDirecto: 0,
          };
        }

        const p = playerStats[playerId];
        const category = stat.stat_category;
        const normalized = stat.stat_type.toLowerCase().trim();
        const score = getStatScore(stat.stat_type);

        if (category === 'Ataque') {
          p.ataqueTotal += 1;
          if (score > 0) {
            p.ataquePositivo += 1;
            p.ataqueTotalPuntos += 1;
          }
        } else if (category === 'Recepción') {
          p.recepcionTotal += 1;
          if (normalized.includes('doble positiv') || normalized === '++') {
            p.recepcionEficacia += 2; // doble positivo cuenta como 2
          } else if (normalized.includes('positiv') || normalized === '+') {
            p.recepcionEficacia += 1;
          } else if (normalized.includes('error')) {
            p.recepcionEficacia -= 1;
          }
        } else if (category === 'Defensa' && score > 0) {
          p.defensaPositivo += 1;
        } else if (category === 'Bloqueo' && score > 0) {
          p.bloqueoPositivo += 1;
        } else if (category === 'Saque' && (normalized.includes('punto directo') || normalized.includes('ace'))) {
          p.saquePuntoDirecto += 1;
        }
      });
    });

    const players = Object.values(playerStats);

    // Calcular rankings
    const maxAnotador = [...players].sort((a, b) => b.ataquePositivo - a.ataquePositivo)[0];
    const mejorAtacante = [...players]
      .filter(p => p.ataqueTotal >= 5)
      .sort((a, b) => (b.ataqueTotalPuntos / b.ataqueTotal) - (a.ataqueTotalPuntos / a.ataqueTotal))[0];
    const mejorReceptor = [...players]
      .filter(p => p.recepcionTotal >= 5)
      .sort((a, b) => (b.recepcionEficacia / b.recepcionTotal) - (a.recepcionEficacia / a.recepcionTotal))[0];
    const mejorDefensor = [...players].sort((a, b) => b.defensaPositivo - a.defensaPositivo)[0];
    const mejorBloqueador = [...players].sort((a, b) => b.bloqueoPositivo - a.bloqueoPositivo)[0];
    const mejorSacador = [...players].sort((a, b) => b.saquePuntoDirecto - a.saquePuntoDirecto)[0];

    return {
      maxAnotador: maxAnotador ? {
        ...maxAnotador,
        stat: maxAnotador.ataquePositivo,
        label: 'puntos'
      } : null,
      mejorAtacante: mejorAtacante ? {
        ...mejorAtacante,
        stat: Math.round((mejorAtacante.ataqueTotalPuntos / mejorAtacante.ataqueTotal) * 100),
        label: '% eficacia'
      } : null,
      mejorReceptor: mejorReceptor ? {
        ...mejorReceptor,
        stat: Math.round((mejorReceptor.recepcionEficacia / mejorReceptor.recepcionTotal) * 100),
        label: '% eficacia'
      } : null,
      mejorDefensor: mejorDefensor ? {
        ...mejorDefensor,
        stat: mejorDefensor.defensaPositivo,
        label: 'defensas'
      } : null,
      mejorBloqueador: mejorBloqueador ? {
        ...mejorBloqueador,
        stat: mejorBloqueador.bloqueoPositivo,
        label: 'bloqueos'
      } : null,
      mejorSacador: mejorSacador ? {
        ...mejorSacador,
        stat: mejorSacador.saquePuntoDirecto,
        label: 'aces'
      } : null,
    };
  }, [matchesData]);

  // Renderizar TOP de jugadores
  const renderPlayerRankings = () => {
    const rankings = [
      { title: 'Máximo Anotador', icon: 'target', color: '#ef4444', data: playerRankings.maxAnotador },
      { title: 'Atacante más Eficaz', icon: 'arm-flex', color: '#f59e0b', data: playerRankings.mejorAtacante },
      { title: 'Mejor Receptor', icon: 'hand-wave', color: '#22c55e', data: playerRankings.mejorReceptor },
      { title: 'Mejor Defensor', icon: 'shield-check', color: '#8b5cf6', data: playerRankings.mejorDefensor },
      { title: 'Mejor Bloqueador', icon: 'wall', color: '#3b82f6', data: playerRankings.mejorBloqueador },
      { title: 'Mejor Sacador', icon: 'volleyball', color: '#06b6d4', data: playerRankings.mejorSacador },
    ].filter(r => r.data && r.data.stat > 0);

    if (rankings.length === 0) {
      return (
        <View style={styles.noChartData}>
          <Text style={styles.noChartDataText}>No hay suficientes datos para mostrar rankings</Text>
        </View>
      );
    }

    return (
      <View style={styles.rankingsContainer}>
        {rankings.map((ranking, index) => (
          <View key={ranking.title} style={styles.rankingCard}>
            <View style={[styles.rankingIconContainer, { backgroundColor: ranking.color + '20' }]}>
              <MaterialCommunityIcons name={ranking.icon as any} size={24} color={ranking.color} />
            </View>
            <View style={styles.rankingContent}>
              <Text style={styles.rankingTitle}>{ranking.title}</Text>
              <View style={styles.rankingPlayerRow}>
                <View style={[styles.rankingNumber, { backgroundColor: ranking.color }]}>
                  <Text style={styles.rankingNumberText}>#{ranking.data!.number}</Text>
                </View>
                <Text style={styles.rankingPlayerName}>{ranking.data!.name}</Text>
              </View>
            </View>
            <View style={styles.rankingStatContainer}>
              <Text style={[styles.rankingStat, { color: ranking.color }]}>{ranking.data!.stat}</Text>
              <Text style={styles.rankingStatLabel}>{ranking.data!.label}</Text>
            </View>
          </View>
        ))}
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

  const trendChartColor = matchPerformances.length
    ? getMatchResultColor(matchPerformances[matchPerformances.length - 1].result)
    : Colors.primary;

  if (!teamSelectionConfirmed) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader(false)}
        <ScrollView
          contentContainerStyle={styles.teamSelectionContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.selectionTitle}>Selecciona el equipo para el seguimiento</Text>
          <Text style={styles.selectionSubtitle}>
            Elige el equipo que quieres analizar para cargar sus métricas.
          </Text>
          {teams.length === 0 ? (
            <View style={styles.selectionEmptyState}>
              <Text style={styles.selectionEmptyTitle}>Todavía no tienes equipos</Text>
              <Text style={styles.selectionEmptyText}>
                Crea uno desde el menú lateral y vuelve a esta pantalla para comenzar.
              </Text>
            </View>
          ) : (
            <View style={styles.teamSelectionList}>
              {teams.map(team => (
                <TouchableOpacity
                  key={team.id}
                  style={[
                    styles.teamSelectionCard,
                    selectedTeam === team.id && styles.teamSelectionCardActive,
                  ]}
                  onPress={() => confirmTeamSelection(team.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.teamSelectionHeader}>
                    <TeamIcon size={28} color={Colors.primary} />
                    <Text style={styles.teamSelectionTitle}>{team.name}</Text>
                  </View>
                  <Text style={styles.teamSelectionText}>
                    {team.playerCount ?? 0} jugadores registrados
                  </Text>
                  <View style={styles.teamSelectionBadge}>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textSecondary} />
                    <Text style={styles.teamSelectionBadgeText}>Ver seguimiento</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader(true)}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Cargando datos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader(true)}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Equipo seleccionado */}
        <View style={styles.teamBanner}>
          <View style={styles.teamBadgeIcon}>
            <TeamIcon size={22} color={Colors.primary} />
          </View>
          <View style={styles.teamBannerText}>
            <Text style={styles.teamBannerLabel}>Equipo seleccionado</Text>
            <Text style={styles.teamBannerName}>{selectedTeamName || 'Mi Equipo'}</Text>
          </View>
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

            {/* Gráfico de evolución G-P - Líneas suavizadas */}
            <View style={styles.section}>
              {renderSmoothLineChart(
                matchPerformances.map(mp => ({ 
                  value: mp.gp, 
                  label: mp.opponent.length > 5 ? mp.opponent.substring(0, 5) : mp.opponent
                })),
                trendChartColor,
                'Evolución G-P por Partido'
              )}
            </View>

            {/* Gráfico de barras G-P por categoría */}
            <View style={styles.section}>
              {renderImprovedBarChart(
                Object.entries(aggregatedStats.categoryAverages)
                  .filter(([cat]) => STAT_CATEGORIES.includes(cat))
                  .map(([cat, data]) => ({
                    label: cat,
                    value: data.avgGP,
                    color: CATEGORY_COLORS[normalizeCategoryKey(cat)] || Colors.primary,
                  })),
                'G-P Promedio por Categoría'
              )}
            </View>

            {/* TOP de jugadores */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🏆 TOP Jugadores</Text>
              {renderPlayerRankings()}
            </View>

            {/* Gráficos de progreso por categoría */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Progreso por Categoría</Text>
              {renderCategoryProgressCharts()}
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
                        color={getMatchResultColor(mp.result)} 
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
    flex: 1,
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
  categoryChartWrapper: {
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
  headerTextBlock: {
    marginLeft: Spacing.sm,
  },
  headerSubtitle: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  changeTeamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  changeTeamText: {
    marginLeft: Spacing.xs,
    color: Colors.primary,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  teamSelectionContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  selectionTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  selectionSubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  selectionEmptyState: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  selectionEmptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  selectionEmptyText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  teamSelectionList: {
    gap: Spacing.md,
  },
  teamSelectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'transparent',
    ...Shadows.sm,
  },
  teamSelectionCardActive: {
    borderColor: Colors.primary,
  },
  teamSelectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  teamSelectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  teamSelectionText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  teamSelectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  teamSelectionBadgeText: {
    marginLeft: Spacing.xs,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  teamBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  teamBadgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  teamBannerText: {
    flex: 1,
  },
  teamBannerLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  teamBannerName: {
    marginTop: 2,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  // Rankings styles
  rankingsContainer: {
    gap: Spacing.sm,
  },
  rankingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  rankingIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  rankingContent: {
    flex: 1,
  },
  rankingTitle: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  rankingPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  rankingNumber: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rankingNumberText: {
    fontSize: FontSizes.xs,
    color: '#fff',
    fontWeight: '700',
  },
  rankingPlayerName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  rankingStatContainer: {
    alignItems: 'flex-end',
  },
  rankingStat: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
  },
  rankingStatLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  // Chart legend styles
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendLine: {
    width: 16,
    height: 3,
    borderRadius: 1.5,
  },
  legendLineDashed: {
    width: 16,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.7,
  },
  legendText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
});
