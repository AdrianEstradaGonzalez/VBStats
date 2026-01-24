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
import Svg, { Path, Circle, Line, Text as SvgText, Rect } from 'react-native-svg';
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
  const [infoAlertVisible, setInfoAlertVisible] = useState(false);
  const [infoAlertTitle, setInfoAlertTitle] = useState('');
  const [infoAlertContent, setInfoAlertContent] = useState<string>('');

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

  // Renderizar gráfico de líneas suavizadas con ejes
  const renderSmoothLineChart = (
    data: { value: number; label: string }[], 
    color: string, 
    title: string,
    unit: string = '',
    showSign: boolean = true,
    legendLabel: string = 'Serie'
  ) => {
    if (data.length < 2) {
      return (
        <View style={styles.noChartData}>
          <Text style={styles.noChartDataText}>Se necesitan al menos 2 partidos para mostrar el gráfico</Text>
        </View>
      );
    }

    const values = data.map(d => d.value);
    const maxValue = Math.max(...values, 0);
    const minValue = Math.min(...values, 0);
    const range = maxValue - minValue || 1;
    
    const chartWidth = CHART_WIDTH - 80;
    const chartHeight = CHART_HEIGHT - 100;
    const pointsCount = data.length;
    const xSpacing = chartWidth / (pointsCount - 1);
    
    // Calcular puntos
    const points = data.map((d, i) => ({
      x: i * xSpacing,
      y: chartHeight - ((d.value - minValue) / range) * chartHeight,
      value: d.value,
      label: d.label,
    }));
    
    // Crear path curvo usando Bezier curves
    let pathData = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const xMid = (current.x + next.x) / 2;
      const yMid = (current.y + next.y) / 2;
      pathData += ` Q ${current.x},${current.y} ${xMid},${yMid}`;
      if (i < points.length - 2) {
        pathData += ` T ${next.x},${next.y}`;
      } else {
        pathData += ` Q ${next.x},${next.y} ${next.x},${next.y}`;
      }
    }

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{title}</Text>
        <View style={{ marginLeft: 40, marginTop: 10 }}>
          <Svg width={chartWidth + 20} height={chartHeight + 30}>
            {/* Grid lines */}
            {[0, 1, 2, 3, 4].map(i => {
              const y = (chartHeight / 4) * i;
              return (
                <Line
                  key={`grid-${i}`}
                  x1={0}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="#94a3b8"
                  strokeOpacity={0.25}
                  strokeWidth="1"
                />
              );
            })}
            
            {/* Line path */}
            <Path
              d={pathData}
              stroke={color}
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Data points */}
            {points.map((point, i) => (
              <Circle
                key={`point-${i}`}
                cx={point.x}
                cy={point.y}
                r="4"
                fill={color}
              />
            ))}
            
            {/* X-axis labels */}
            {points.map((point, i) => (
              <SvgText
                key={`label-${i}`}
                x={point.x}
                y={chartHeight + 18}
                fontSize="9"
                fill={Colors.textSecondary}
                textAnchor="middle"
              >
                {point.label}
              </SvgText>
            ))}
          </Svg>
          
          {/* Y-axis labels */}
          <View style={{ position: 'absolute', left: -40, top: 0, height: chartHeight }}>
            {[0, 1, 2, 3, 4].map(i => {
              const val = maxValue - (range / 4) * i;
              const y = (chartHeight / 4) * i - 5;
              return (
                <Text key={`y-${i}`} style={[styles.chartAxisText, { position: 'absolute', top: y }]}>
                  {showSign && val > 0 ? '+' : ''}{val.toFixed(0)}{unit}
                </Text>
              );
            })}
          </View>
        </View>
        
        <View style={styles.chartLegendImproved}>
          <View style={styles.legendItemImproved}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={[styles.legendTextImproved, { color }]}>{legendLabel}</Text>
          </View>
        </View>
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
    unit2: string = '',
    infoText?: string
  ) => {
    if (data1.length < 2) {
      return (
        <View style={styles.noChartData}>
          <Text style={styles.noChartDataText}>Se necesitan al menos 2 partidos para mostrar el gráfico</Text>
        </View>
      );
    }

    const isPercentage = unit1 === '%' && unit2 === '%';
    const values1 = data1.map(d => d.value);
    const values2 = data2.map(d => d.value);
    const maxValue = isPercentage ? 100 : Math.max(...values1, ...values2, 1);
    const minValue = isPercentage ? 0 : Math.min(...values1, ...values2, 0);
    const range = maxValue - minValue || 1;
    
    const chartWidth = CHART_WIDTH - 80;
    const chartHeight = CHART_HEIGHT - 100;
    const pointsCount = data1.length;
    const xSpacing = chartWidth / (pointsCount - 1);
    
    // Calcular puntos para ambas series
    const points1 = data1.map((d, i) => ({
      x: i * xSpacing,
      y: chartHeight - ((d.value - minValue) / range) * chartHeight,
      value: d.value,
      label: d.label,
    }));
    
    const points2 = data2.map((d, i) => ({
      x: i * xSpacing,
      y: chartHeight - ((d.value - minValue) / range) * chartHeight,
      value: d.value,
      label: d.label,
    }));
    
    // Crear paths curvos
    const createPath = (points: { x: number; y: number }[]) => {
      let pathData = `M ${points[0].x} ${points[0].y}`;
      for (let i = 0; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        const xMid = (current.x + next.x) / 2;
        const yMid = (current.y + next.y) / 2;
        pathData += ` Q ${current.x},${current.y} ${xMid},${yMid}`;
        if (i < points.length - 2) {
          pathData += ` T ${next.x},${next.y}`;
        } else {
          pathData += ` Q ${next.x},${next.y} ${next.x},${next.y}`;
        }
      }
      return pathData;
    };

    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartHeaderRow}>
          <Text style={styles.chartTitle}>{title}</Text>
          {infoText ? (
            <TouchableOpacity
              style={styles.chartInfoButton}
              onPress={() => {
                setInfoAlertTitle('Cálculo de porcentajes');
                setInfoAlertContent(String(infoText));
                setInfoAlertVisible(true);
              }}
            >
              <MaterialCommunityIcons name="information-outline" size={18} color={Colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={{ marginLeft: 40, marginTop: 10 }}>
          <Svg width={chartWidth + 20} height={chartHeight + 30}>
            {/* Grid lines */}
            {[0, 1, 2, 3, 4].map(i => {
              const y = (chartHeight / 4) * i;
              return (
                <Line
                  key={`grid-${i}`}
                  x1={0}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="#94a3b8"
                  strokeOpacity={0.25}
                  strokeWidth="1"
                />
              );
            })}
            
            {/* Line paths */}
            <Path
              d={createPath(points1)}
              stroke={color1}
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d={createPath(points2)}
              stroke={color2}
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="5,5"
            />
            
            {/* Data points */}
            {points1.map((point, i) => (
              <Circle
                key={`point1-${i}`}
                cx={point.x}
                cy={point.y}
                r="4"
                fill={color1}
              />
            ))}
            {points2.map((point, i) => (
              <Circle
                key={`point2-${i}`}
                cx={point.x}
                cy={point.y}
                r="4"
                fill={color2}
              />
            ))}
            
            {/* X-axis labels */}
            {points1.map((point, i) => (
              <SvgText
                key={`label-${i}`}
                x={point.x}
                y={chartHeight + 18}
                fontSize="9"
                fill={Colors.textSecondary}
                textAnchor="middle"
              >
                {point.label}
              </SvgText>
            ))}
          </Svg>
          
          {/* Y-axis labels */}
          <View style={{ position: 'absolute', left: -40, top: 0, height: chartHeight }}>
            {[0, 1, 2, 3, 4].map(i => {
              const val = maxValue - (range / 4) * i;
              const y = (chartHeight / 4) * i - 5;
              return (
                <Text key={`y-${i}`} style={[styles.chartAxisText, { position: 'absolute', top: y }]}>
                  {val.toFixed(0)}{unit1}
                </Text>
              );
            })}
          </View>
        </View>
        
        {/* Leyenda mejorada */}
        <View style={styles.chartLegendImproved}>
          <View style={styles.legendItemImproved}>
            <View style={[styles.legendDot, { backgroundColor: color1 }]} />
            <Text style={[styles.legendTextImproved, { color: color1 }]}>{legend1}</Text>
          </View>
          <View style={styles.legendItemImproved}>
            <View style={[styles.legendDotDashed, { borderColor: color2 }]} />
            <Text style={[styles.legendTextImproved, { color: color2 }]}>{legend2}</Text>
          </View>
        </View>
      </View>
    );
  };

  // Renderizar gráfico de barras mejorado con manejo de negativos
  const renderImprovedBarChart = (
    data: { label: string; value: number; color: string }[],
    title: string,
    legendLabel: string = 'Serie',
    legendColor: string = Colors.text,
    showLegend: boolean = true
  ) => {
    if (data.length === 0) return null;
    
    const values = data.map(d => d.value);
    const maxValue = Math.max(...values, 0);
    const minValue = Math.min(...values, 0);
    const range = maxValue - minValue || 1;
    
    const chartWidth = CHART_WIDTH - 80;
    const chartHeight = CHART_HEIGHT - 100;
    const barWidth = Math.min(32, (chartWidth / data.length) * 0.6);
    const spacing = chartWidth / data.length;
    const zeroY = chartHeight - ((-minValue) / range) * chartHeight;

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{title}</Text>
        <View style={{ marginLeft: 40, marginTop: 10 }}>
          <Svg width={chartWidth + 20} height={chartHeight + 30}>
            {/* Grid lines */}
            {[0, 1, 2, 3, 4].map(i => {
              const y = (chartHeight / 4) * i;
              return (
                <Line
                  key={`grid-${i}`}
                  x1={0}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="#94a3b8"
                  strokeOpacity={0.25}
                  strokeWidth="1"
                />
              );
            })}
            
            {/* Zero line */}
            {minValue < 0 && (
              <Line
                x1={0}
                y1={zeroY}
                x2={chartWidth}
                y2={zeroY}
                stroke="#9ca3af"
                strokeWidth="2"
              />
            )}
            
            {/* Bars */}
            {data.map((item, i) => {
              const x = spacing * i + (spacing - barWidth) / 2;
              const barHeight = Math.abs((item.value / range) * chartHeight);
              const y = item.value >= 0 
                ? zeroY - barHeight 
                : zeroY;
              
              return (
                <React.Fragment key={`bar-${i}`}>
                  <Rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={item.color}
                    rx="3"
                  />
                  <SvgText
                    x={x + barWidth / 2}
                    y={chartHeight + 18}
                    fontSize="9"
                    fill={Colors.textSecondary}
                    textAnchor="middle"
                  >
                    {item.label}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
          
          {/* Y-axis labels */}
          <View style={{ position: 'absolute', left: -40, top: 0, height: chartHeight }}>
            {[0, 1, 2, 3, 4].map(i => {
              const val = maxValue - (range / 4) * i;
              const y = (chartHeight / 4) * i - 5;
              return (
                <Text key={`y-${i}`} style={[styles.chartAxisText, { position: 'absolute', top: y }]}>
                  {val.toFixed(0)}
                </Text>
              );
            })}
          </View>
        </View>
        
        {showLegend && (
          <View style={styles.chartLegendImproved}>
            <View style={styles.legendItemImproved}>
              <View style={[styles.legendDot, { backgroundColor: legendColor }]} />
              <Text style={[styles.legendTextImproved, { color: legendColor }]}>{legendLabel}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  // Renderizar gráfico de línea simple para acciones positivas
  const renderSimpleLineChart = (
    data: { value: number; label: string }[], 
    color: string, 
    title: string,
    legendLabel: string = 'Serie'
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
    
    const chartWidth = CHART_WIDTH - 80;
    const chartHeight = CHART_HEIGHT - 100;
    const pointsCount = data.length;
    const xSpacing = chartWidth / (pointsCount - 1);
    
    // Calcular puntos
    const points = data.map((d, i) => ({
      x: i * xSpacing,
      y: chartHeight - ((d.value - minValue) / range) * chartHeight,
      value: d.value,
      label: d.label,
    }));
    
    // Crear path curvo
    let pathData = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const xMid = (current.x + next.x) / 2;
      const yMid = (current.y + next.y) / 2;
      pathData += ` Q ${current.x},${current.y} ${xMid},${yMid}`;
      if (i < points.length - 2) {
        pathData += ` T ${next.x},${next.y}`;
      } else {
        pathData += ` Q ${next.x},${next.y} ${next.x},${next.y}`;
      }
    }

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{title}</Text>
        <View style={{ marginLeft: 40, marginTop: 10 }}>
          <Svg width={chartWidth + 20} height={chartHeight + 30}>
            {/* Grid lines */}
            {[0, 1, 2, 3, 4].map(i => {
              const y = (chartHeight / 4) * i;
              return (
                <Line
                  key={`grid-${i}`}
                  x1={0}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="#94a3b8"
                  strokeOpacity={0.25}
                  strokeWidth="1"
                />
              );
            })}
            
            {/* Line path */}
            <Path
              d={pathData}
              stroke={color}
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Data points */}
            {points.map((point, i) => (
              <Circle
                key={`point-${i}`}
                cx={point.x}
                cy={point.y}
                r="4"
                fill={color}
              />
            ))}
            
            {/* X-axis labels */}
            {points.map((point, i) => (
              <SvgText
                key={`label-${i}`}
                x={point.x}
                y={chartHeight + 18}
                fontSize="9"
                fill={Colors.textSecondary}
                textAnchor="middle"
              >
                {point.label}
              </SvgText>
            ))}
          </Svg>
          
          {/* Y-axis labels */}
          <View style={{ position: 'absolute', left: -40, top: 0, height: chartHeight }}>
            {[0, 1, 2, 3, 4].map(i => {
              const val = maxValue - (range / 4) * i;
              const y = (chartHeight / 4) * i - 5;
              return (
                <Text key={`y-${i}`} style={[styles.chartAxisText, { position: 'absolute', top: y }]}>
                  {val.toFixed(0)}
                </Text>
              );
            })}
          </View>
        </View>
        
        <View style={styles.chartLegendImproved}>
          <View style={styles.legendItemImproved}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={[styles.legendTextImproved, { color }]}>{legendLabel}</Text>
          </View>
        </View>
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
        const denominator = d.doblePositivo + d.positivo + d.neutro + d.error;
        if (denominator > 0) {
          if (cat === 'Recepción') {
            // Recepción: (doblePos + pos) / (doblePos + pos + neutro + error) * 100
            const eficacia = ((d.doblePositivo + d.positivo) / denominator) * 100;
            d.eficacia = Math.round(Math.max(0, Math.min(100, eficacia)));
          } else if (cat === 'Ataque') {
            // Ataque: pos / (pos + neutro + error) * 100
            const ataqueDenominator = d.positivo + d.neutro + d.error;
            const eficacia = ataqueDenominator > 0 ? (d.positivo / ataqueDenominator) * 100 : 0;
            d.eficacia = Math.round(Math.max(0, Math.min(100, eficacia)));
          } else {
            // Otras categorías mantienen fórmula original
            const rawEficacia = ((d.doblePositivo + d.positivo - d.error) / denominator) * 100;
            d.eficacia = Math.round(Math.max(0, Math.min(100, rawEficacia)));
          }
        }
      });

      return {
        matchId: match.id,
        date: match.date || '',
        opponent: match.opponent || 'Sin rival',
        categoryDetails,
      };
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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

    // Datos para Recepción (ambas medidas en porcentaje)
    const recepcionData = getDetailedCategoryStats.map(m => {
      const r = m.categoryDetails['Recepción'];
      const total = r ? (r.doblePositivo + r.positivo + r.neutro + r.error) : 0;
      const doblePosPct = total > 0 ? Math.round((r!.doblePositivo / total) * 100) : 0;
      return {
        eficacia: r?.eficacia || 0,
        doblePosPct: Math.max(0, Math.min(100, doblePosPct)),
        label: m.opponent.length > 5 ? m.opponent.substring(0, 5) : m.opponent,
      };
    });

    // Datos para Ataque: anotación (acciones positivas) + eficacia/eficiencia
    const ataqueData = getDetailedCategoryStats.map(m => {
      const a = m.categoryDetails['Ataque'];
      const denom = a ? (a.positivo + a.neutro + a.error) : 0;
      const eficaciaPct = denom > 0 ? (a!.positivo / denom) * 100 : 0;
      const eficienciaPct = denom > 0 ? ((a!.positivo - a!.error) / denom) * 100 : 0;
      return {
        positivos: a?.positivo || 0,
        eficacia: Math.max(0, Math.min(100, Math.round(eficaciaPct))),
        eficiencia: Math.max(0, Math.min(100, Math.round(eficienciaPct))),
        label: m.opponent.length > 5 ? m.opponent.substring(0, 5) : m.opponent,
      };
    });

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

    const hasRecepcion = recepcionData.some(d => d.eficacia !== 0 || d.doblePosPct !== 0);
    const hasAtaque = ataqueData.some(d => d.eficacia !== 0 || d.eficiencia !== 0 || d.positivos !== 0);
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
          recepcionData.map(d => ({ value: d.doblePosPct, label: d.label })),
          categoryColor('Recepción'),
          '#0ea5e9',
          'Recepción',
          'Eficacia %',
          'Doble Pos %',
          '%',
          '%',
          'Eficacia de Recepción:\n\nNumerador: doble positivo + positivo\nDenominador: doble positivo + positivo + neutro + error\n\nEficacia % = (Numerador ÷ Denominador) × 100'
        )}

        {/* Ataque: Anotación (acciones positivas) */}
        {hasAtaque && renderSimpleLineChart(
          ataqueData.map(d => ({ value: d.positivos, label: d.label })),
          categoryColor('Ataque'),
          'Ataque - Anotación',
          'Acciones positivas'
        )}

        {/* Ataque: Eficacia + Eficiencia */}
        {hasAtaque && renderDualLineChart(
          ataqueData.map(d => ({ value: d.eficacia, label: d.label })),
          ataqueData.map(d => ({ value: d.eficiencia, label: d.label })),
          categoryColor('Ataque'),
          '#f97316',
          'Ataque - Eficacia y Eficiencia',
          'Eficacia %',
          'Eficiencia %',
          '%',
          '%',
          'Eficacia de Ataque:\n\nNumerador: positivo\nDenominador: positivo + neutro + error\n\nEficacia % = (Numerador ÷ Denominador) × 100\n\n━━━━━━━━━━━━━━━\n\nEficiencia de Ataque:\n\nNumerador: positivo - error\nDenominador: positivo + neutro + error\n\nEficiencia % = (Numerador ÷ Denominador) × 100'
        )}

        {/* Bloqueo: Acciones positivas */}
        {hasBloqueo && renderSimpleLineChart(
          bloqueoData,
          categoryColor('Bloqueo'),
          'Bloqueo',
          'Número de bloqueos'
        )}

        {/* Defensa: Acciones positivas */}
        {hasDefensa && renderSimpleLineChart(
          defensaData,
          categoryColor('Defensa'),
          'Defensa',
          'Número de defensas'
        )}

        {/* Saque: Puntos directos */}
        {hasSaque && renderSimpleLineChart(
          saqueData,
          categoryColor('Saque'),
          'Saque',
          'Puntos directos'
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
      recepcionDobles: number;
      recepcionPos: number;
      recepcionNeutro: number;
      recepcionError: number;
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
            recepcionDobles: 0,
            recepcionPos: 0,
            recepcionNeutro: 0,
            recepcionError: 0,
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
          if (normalized.includes('doble positiv') || normalized === '++') {
            p.recepcionDobles += 1;
          } else if (normalized.includes('positiv') || normalized === '+') {
            p.recepcionPos += 1;
          } else if (normalized.includes('neutr') || normalized === '-' || normalized === '=') {
            p.recepcionNeutro += 1;
          } else if (normalized.includes('error')) {
            p.recepcionError += 1;
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
      .sort((a, b) => {
        // Nueva fórmula ataque: pos / (pos + neutro + error)
        const denomA = a.ataquePositivo + (a.ataqueTotal - a.ataquePositivo);
        const denomB = b.ataquePositivo + (b.ataqueTotal - b.ataquePositivo);
        const eficaciaA = denomA > 0 ? a.ataquePositivo / denomA : 0;
        const eficaciaB = denomB > 0 ? b.ataquePositivo / denomB : 0;
        return eficaciaB - eficaciaA;
      })[0];
    const mejorReceptor = [...players]
      .filter(p => (p.recepcionDobles + p.recepcionPos + p.recepcionNeutro + p.recepcionError) >= 5)
      .sort((a, b) => {
        const totalA = a.recepcionDobles + a.recepcionPos + a.recepcionNeutro + a.recepcionError;
        const totalB = b.recepcionDobles + b.recepcionPos + b.recepcionNeutro + b.recepcionError;
        // Nueva fórmula: (doblePos + pos) / (doblePos + pos + neutro + error)
        const eficaciaA = totalA > 0 ? (a.recepcionDobles + a.recepcionPos) / totalA : 0;
        const eficaciaB = totalB > 0 ? (b.recepcionDobles + b.recepcionPos) / totalB : 0;
        return eficaciaB - eficaciaA;
      })[0];
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
        stat: Math.round(Math.max(0, Math.min(100, (() => {
          const denom = mejorAtacante.ataquePositivo + (mejorAtacante.ataqueTotal - mejorAtacante.ataquePositivo);
          return denom > 0 ? (mejorAtacante.ataquePositivo / denom) * 100 : 0;
        })()))),
        label: '% eficacia'
      } : null,
      mejorReceptor: mejorReceptor ? {
        ...mejorReceptor,
        stat: Math.round(Math.max(0, Math.min(100, (() => {
          const total = mejorReceptor.recepcionDobles + mejorReceptor.recepcionPos + mejorReceptor.recepcionNeutro + mejorReceptor.recepcionError;
          return total > 0
            ? ((mejorReceptor.recepcionDobles + mejorReceptor.recepcionPos) / total) * 100
            : 0;
        })()))),
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
                'Evolución G-P por Partido',
                '',
                true,
                'G-P'
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
                'G-P Promedio por Categoría',
                'G-P Promedio',
                Colors.text,
                false
              )}
            </View>

            {/* TOP de jugadores */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TOP Jugadores</Text>
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

      {/* Info formulas alert */}
      <CustomAlert
        visible={infoAlertVisible}
        icon={<MaterialCommunityIcons name="information-outline" size={48} color={Colors.primary} />}
        iconBackgroundColor={Colors.primary + '15'}
        title={infoAlertTitle}
        // use contentComponent for rich formula display
        contentComponent={<View style={styles.formulaContainer}>
          <Text style={styles.formulaText}>{infoAlertContent}</Text>
          <View style={styles.formulaDivider} />
          <Text style={styles.formulaNote}>Las fórmulas usan: positivo = acciones con resultado favorable, neutro = acciones neutrales, error = acciones con error.</Text>
        </View>}
        buttons={[
          {
            text: 'Cerrar',
            onPress: () => setInfoAlertVisible(false),
            style: 'primary',
          },
        ]} message={''}      />
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
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chartInfoButton: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary + '15',
  },
  chartContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  chartTitle: {
    fontSize: FontSizes.md,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.md,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  chartAxisText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  barValueLabel: {
    fontSize: 11,
    color: '#0f172a',
    fontWeight: '700',
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
    color: '#64748b',
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
  // Improved legend styles
  chartLegendImproved: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xl,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  legendItemImproved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendDotDashed: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  legendTextImproved: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  formulaContainer: {
    width: '100%',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
  },
  formulaText: {
    fontSize: FontSizes.md,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  formulaDivider: {
    height: 1,
    backgroundColor: Colors.border,
    width: '100%',
    marginVertical: Spacing.sm,
  },
  formulaNote: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
});
