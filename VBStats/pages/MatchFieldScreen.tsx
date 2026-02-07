/**
 * Pantalla del campo de voleibol con posiciones de jugadores
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Dimensions,
  Animated,
  ScrollView,
  Platform,
  StatusBar,
  AppState,
  AppStateStatus,
  TextInput,
  Image,
} from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';
import { MenuIcon, PlusIcon, XIcon, DeleteIcon, StatsIcon } from '../components/VectorIcons';
import CustomAlert from '../components/CustomAlert';
import { playersService, settingsService, matchesService, statsService } from '../services/api';
import type { MatchDetails } from './MatchDetailsScreen';
import type { Player, StatSetting, MatchStatCreate, Match } from '../services/types';
import MatchStatsScreen from './MatchStatsScreen';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Safe area paddings para Android
const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;
const ANDROID_NAV_BAR_HEIGHT = 48; // Altura aproximada de la barra de navegación

interface MatchFieldScreenProps {
  onOpenMenu?: () => void;
  matchDetails: MatchDetails;
  userId?: number | null;
  resumeMatchId?: number | null; // If provided, resume this match instead of creating new
}

type Position = {
  id: string;
  label: string;
  playerId: number | null;
  playerName: string | null;
  playerNumber: number | null;
};

type StatCategory = {
  category: string;
  types: StatSetting[];
  color: string;
};

// Colores por categoría (con todas las variantes de nombres)
const STAT_COLORS: Record<string, string> = {
  'Recepción': '#3b82f6',
  'Recepcion': '#3b82f6',
  'recepción': '#3b82f6',
  'recepcion': '#3b82f6',
  'RECEPCIÓN': '#3b82f6',
  'RECEPCION': '#3b82f6',
  'Ataque': '#f59e0b',
  'ataque': '#f59e0b',
  'ATAQUE': '#f59e0b',
  'Bloqueo': '#10b981',
  'bloqueo': '#10b981',
  'BLOQUEO': '#10b981',
  'Saque': '#8b5cf6',
  'saque': '#8b5cf6',
  'SAQUE': '#8b5cf6',
  'Defensa': '#ef4444',
  'defensa': '#ef4444',
  'DEFENSA': '#ef4444',
  'Colocación': '#06b6d4',
  'Colocacion': '#06b6d4',
  'colocación': '#06b6d4',
  'colocacion': '#06b6d4',
  'COLOCACIÓN': '#06b6d4',
  'COLOCACION': '#06b6d4',
};

// Tipo para acciones de estadísticas en memoria
type StatAction = {
  id: string;
  playerId: number;
  playerName: string;
  playerNumber: number | null;
  setNumber: number;
  statSettingId: number;
  statCategory: string;
  statType: string;
  timestamp: number;
};

// Tipo para el feedback visual
type LastStatFeedback = {
  playerName: string;
  statCategory: string;
  statType: string;
  color: string;
  icon: string;
} | null;

export default function MatchFieldScreen({ 
  onOpenMenu, 
  matchDetails,
  userId,
  resumeMatchId
}: MatchFieldScreenProps) {
  // 8 posiciones de campo
  const [positions, setPositions] = useState<Position[]>([
    { id: 'pos1', label: 'Receptor', playerId: null, playerName: null, playerNumber: null },
    { id: 'pos2', label: 'Receptor', playerId: null, playerName: null, playerNumber: null },
    { id: 'pos3', label: 'Central', playerId: null, playerName: null, playerNumber: null },
    { id: 'pos4', label: 'Central', playerId: null, playerName: null, playerNumber: null },
    { id: 'pos5', label: 'Opuesto', playerId: null, playerName: null, playerNumber: null },
    { id: 'pos6', label: 'Colocador', playerId: null, playerName: null, playerNumber: null },
    { id: 'pos7', label: 'Líbero', playerId: null, playerName: null, playerNumber: null },
    { id: 'pos8', label: 'Líbero', playerId: null, playerName: null, playerNumber: null },
  ]);

  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [selectedPositionLabel, setSelectedPositionLabel] = useState<string>('');
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'position' | 'others'>('position');
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [statsByPosition, setStatsByPosition] = useState<Record<string, StatSetting[]>>({});
  const [loadingStats, setLoadingStats] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  
  // Estados para control de sets y partido
  const [currentSet, setCurrentSet] = useState(0);
  const [isSetActive, setIsSetActive] = useState(false);
  const [actionHistory, setActionHistory] = useState<{
    type: 'start_set' | 'end_set' | 'add_stat';
    data: any;
    timestamp: number;
  }[]>([]);
  const [showAddPositionModal, setShowAddPositionModal] = useState(false);
  const [showChangePositionModal, setShowChangePositionModal] = useState(false);
  const [showEndSetAlert, setShowEndSetAlert] = useState(false);
  const [showEndMatchAlert, setShowEndMatchAlert] = useState(false);
  const [showSetStatsModal, setShowSetStatsModal] = useState(false);
  const [completedSetNumber, setCompletedSetNumber] = useState<number>(0);
  const [setStatsFilter, setSetStatsFilter] = useState<number | null>(null);
  const [statsViewType, setStatsViewType] = useState<'match' | number>('match');
  const setStatsFilterScrollRef = useRef<ScrollView>(null);
  const viewTypeScrollRef = useRef<ScrollView>(null);

  // Estados para el resultado del partido
  const [scoreHome, setScoreHome] = useState<string>('');
  const [scoreAway, setScoreAway] = useState<string>('');

  // Estados para el partido en BD
  const [matchId, setMatchId] = useState<number | null>(null);
  const [matchCreated, setMatchCreated] = useState(false);
  const [isRestoringState, setIsRestoringState] = useState(!!resumeMatchId); // True si estamos resumiendo
  const [showMatchStatsScreen, setShowMatchStatsScreen] = useState(false);
  const [finishedMatch, setFinishedMatch] = useState<Match | null>(null);
  
  // Estados para estadísticas en memoria (cache)
  const [pendingStats, setPendingStats] = useState<StatAction[]>([]);
  const [savingStats, setSavingStats] = useState(false);
  
  // Estados para feedback visual
  const [lastStatFeedback, setLastStatFeedback] = useState<LastStatFeedback>(null);
  const [lastPressedButton, setLastPressedButton] = useState<string | null>(null);
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const feedbackScale = useRef(new Animated.Value(0.5)).current;
  const feedbackAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  
  // Ref para mantener el estado más reciente para guardar al desmontar
  const stateRef = useRef({
    matchId: null as number | null,
    userId: userId,
    positions: [] as Position[],
    currentSet: 0,
    isSetActive: false,
    actionHistory: [] as { type: 'start_set' | 'end_set' | 'add_stat'; data: any; timestamp: number; }[],
    pendingStats: [] as StatAction[],
    isRestoringState: !!resumeMatchId, // Add flag to ref
  });
  
  // Actualizar el ref cada vez que cambie el estado
  useEffect(() => {
    stateRef.current = {
      matchId,
      userId,
      positions,
      currentSet,
      isSetActive,
      actionHistory,
      pendingStats,
      isRestoringState,
    };
  }, [matchId, userId, positions, currentSet, isSetActive, actionHistory, pendingStats, isRestoringState]);

  useEffect(() => {
    loadPlayers();
    loadStatSettings();
  }, [matchDetails.teamId]);

  // Crear el partido en BD cuando se carga la pantalla o resumir uno existente
  useEffect(() => {
    const initializeMatch = async () => {
      if (!userId || !matchDetails.teamId) return;
      
      // If resuming an existing match
      if (resumeMatchId) {
        console.log('🔄 Intentando resumir partido:', resumeMatchId);
        try {
          const existingMatch = await matchesService.getById(resumeMatchId);
          console.log('📋 Partido encontrado:', existingMatch);
          
          setMatchId(existingMatch.id);
          setMatchCreated(true);
          
          // Load match state (positions, pending stats)
          const matchState = await matchesService.getMatchState(resumeMatchId);
          console.log('📦 Estado del partido cargado:', matchState);
          
          if (matchState) {
            if (matchState.positions && matchState.positions.length > 0) {
              // Restore positions
              const restoredPositions: Position[] = matchState.positions.map(p => ({
                id: p.id,
                label: p.label,
                playerId: p.playerId,
                playerName: p.playerName,
                playerNumber: p.playerNumber,
              }));
              console.log('Posiciones restauradas:', restoredPositions.filter(p => p.playerId).length);
              setPositions(restoredPositions);
            }
            if (matchState.current_set !== undefined) {
              console.log('Set restaurado:', matchState.current_set);
              setCurrentSet(matchState.current_set);
            }
            if (matchState.is_set_active !== undefined) {
              console.log('Set activo:', matchState.is_set_active);
              setIsSetActive(matchState.is_set_active);
            }
            if (matchState.action_history && Array.isArray(matchState.action_history)) {
              // Restore action history with proper typing
              const restoredHistory = matchState.action_history.map(a => ({
                type: a.type as 'start_set' | 'end_set' | 'add_stat',
                data: a.data,
                timestamp: a.timestamp || a.data?.timestamp || Date.now(),
              }));
              console.log('Historial restaurado:', restoredHistory.length, 'acciones');
              setActionHistory(restoredHistory);
            }
            if (matchState.pending_stats && Array.isArray(matchState.pending_stats)) {
              // Restore pending stats with proper typing
              const restoredStats: StatAction[] = matchState.pending_stats.map(s => ({
                id: s.id,
                playerId: s.playerId,
                playerName: s.playerName,
                playerNumber: s.playerNumber,
                setNumber: s.setNumber,
                statSettingId: s.statSettingId,
                statCategory: s.statCategory,
                statType: s.statType,
                timestamp: s.timestamp,
              }));
              console.log('Estadisticas pendientes restauradas:', restoredStats.length);
              setPendingStats(restoredStats);
            }
            
            // Mark restoration as complete - now auto-save can work
            console.log('Restauracion completa, habilitando auto-save');
            setIsRestoringState(false);
          } else {
            console.log('No hay estado guardado para este partido');
            // No saved state, allow normal auto-save
            setIsRestoringState(false);
          }
          
          console.log('Partido resumido exitosamente:', existingMatch.id);
        } catch (error) {
          console.error('Error resumiendo partido:', error);
          // On error, still allow auto-save (will start fresh)
          setIsRestoringState(false);
        }
        return;
      }
      
      // Create new match
      if (matchCreated) return;
      
      try {
        const newMatch = await matchesService.create({
          user_id: userId,
          team_id: matchDetails.teamId,
          opponent: matchDetails.rivalTeam,
          date: matchDetails.date.toISOString(),
          location: matchDetails.isHome ? 'home' : 'away',
        });
        setMatchId(newMatch.id);
        setMatchCreated(true);
        console.log('Partido creado en BD:', newMatch.id);
      } catch (error) {
        console.error('Error creando partido:', error);
      }
    };
    
    initializeMatch();
  }, [userId, matchDetails, matchCreated, resumeMatchId]);

  // Save match state when app goes to background or component unmounts
  const saveMatchState = useCallback(async () => {
    const state = stateRef.current;
    if (!state.matchId || !state.userId) return;
    
    try {
      // Prepare action history for serialization
      const serializedHistory = state.actionHistory.map(a => ({
        type: a.type,
        data: a.data,
        timestamp: a.timestamp,
      }));
      
      // Prepare pending stats for serialization
      const serializedStats = state.pendingStats.map(s => ({
        id: s.id,
        playerId: s.playerId,
        playerName: s.playerName,
        playerNumber: s.playerNumber,
        setNumber: s.setNumber,
        statSettingId: s.statSettingId,
        statCategory: s.statCategory,
        statType: s.statType,
        timestamp: s.timestamp,
      }));
      
      await matchesService.saveMatchState(state.matchId, {
        positions: state.positions,
        current_set: state.currentSet,
        is_set_active: state.isSetActive,
        action_history: serializedHistory,
        pending_stats: serializedStats,
      });
      console.log('Estado del partido guardado:', {
        matchId: state.matchId,
        positions: state.positions.filter(p => p.playerId).length,
        currentSet: state.currentSet,
        isSetActive: state.isSetActive,
        pendingStats: state.pendingStats.length,
      });
    } catch (error) {
      console.error('Error guardando estado:', error);
    }
  }, []); // No dependencies - uses ref

  // Save state when app goes to background or component unmounts
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // Don't save while restoring
      if (stateRef.current.isRestoringState) {
        console.log('AppState save skipped: still restoring state');
        return;
      }
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        saveMatchState();
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
      // Save state when component unmounts using ref for latest values (only if not restoring)
      if (!stateRef.current.isRestoringState) {
        saveMatchState();
      }
    };
  }, [saveMatchState]);

  // Auto-save state periodically and after changes
  useEffect(() => {
    // Don't save if we don't have a match yet
    if (!matchId) return;
    
    // Don't save while we're still restoring state (prevents overwriting good state)
    if (isRestoringState) {
      console.log('Auto-save skipped: still restoring state');
      return;
    }
    
    // Save state after a short debounce when important data changes
    const saveTimeout = setTimeout(() => {
      saveMatchState();
    }, 2000); // 2 seconds debounce
    
    return () => clearTimeout(saveTimeout);
  }, [matchId, positions, currentSet, isSetActive, pendingStats.length, actionHistory.length, saveMatchState, isRestoringState]);

  // Función para mostrar feedback visual al pulsar botón de estadística
  const showStatFeedback = useCallback((feedback: LastStatFeedback) => {
    // Stop any running animation
    if (feedbackAnimationRef.current) {
      feedbackAnimationRef.current.stop();
      feedbackAnimationRef.current = null;
    }
    
    setLastStatFeedback(feedback);
    
    // Reset animation values
    feedbackOpacity.setValue(1);
    feedbackScale.setValue(0.5);
    
    // Create and store new animation
    const newAnimation = Animated.parallel([
      Animated.timing(feedbackScale, {
        toValue: 1.5,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(feedbackOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]);
    
    feedbackAnimationRef.current = newAnimation;
    
    newAnimation.start(({ finished }) => {
      if (finished) {
        setLastStatFeedback(null);
        feedbackAnimationRef.current = null;
      }
    });
  }, [feedbackOpacity, feedbackScale]);

  const loadPlayers = async (force = false) => {
    const teamId = matchDetails?.teamId;
    if (!teamId) {
      console.warn('[MatchField] loadPlayers skipped: no teamId');
      return;
    }
    if (loadingPlayers && !force) {
      console.log('[MatchField] loadPlayers skipped: already loading (force=false)');
      return;
    }
    console.log(`[MatchField] loadPlayers called (teamId=${teamId}, force=${force})`);
    setLoadingPlayers(true);
    try {
      const teamPlayers = await playersService.getByTeam(teamId);
      console.log(`[MatchField] loadPlayers got ${teamPlayers.length} players for team ${teamId}`);
      setPlayers(teamPlayers);
    } catch (error) {
      console.error('[MatchField] Error loading players:', error);
      // Retry once after a short delay
      if (!force) {
        console.log('[MatchField] Retrying loadPlayers...');
        try {
          const retryPlayers = await playersService.getByTeam(teamId);
          console.log(`[MatchField] Retry got ${retryPlayers.length} players`);
          setPlayers(retryPlayers);
        } catch (retryError) {
          console.error('[MatchField] Retry also failed:', retryError);
        }
      }
    } finally {
      setLoadingPlayers(false);
    }
  };

  const loadStatSettings = async (retryCount = 0) => {
    const maxRetries = 3;
    setLoadingStats(true);
    try {
      console.log('[MatchField] Loading stat settings for userId:', userId, 'attempt:', retryCount + 1);
      const positionTypes = ['Opuesto', 'Central', 'Receptor', 'Colocador', 'Líbero'];
      const statsMap: Record<string, StatSetting[]> = {};
      
      for (const position of positionTypes) {
        let positionSettings = await settingsService.getByPosition(position, userId || undefined);
        
        // If no settings exist, initialize them
        if (positionSettings.length === 0) {
          console.log(`[MatchField] ${position}: No settings found, initializing...`);
          positionSettings = await settingsService.initPosition(position, userId || undefined);
          console.log(`[MatchField] ${position}: ${positionSettings.length} settings initialized`);
        }
        
        console.log(`[MatchField] ${position}: ${positionSettings.length} settings loaded`);
        const enabledSettings = positionSettings.filter(s => s.enabled);
        console.log(`[MatchField] ${position}: ${enabledSettings.length} enabled settings`);
        statsMap[position] = enabledSettings;
      }
      
      console.log('[MatchField] Final statsMap:', Object.keys(statsMap).map(k => `${k}: ${statsMap[k].length}`));
      setStatsByPosition(statsMap);
      console.log('[MatchField] ✅ Stat settings loaded successfully');
    } catch (error) {
      console.error('[MatchField] ❌ Error loading stat settings:', error);
      
      // Retry logic for network/connection errors
      if (retryCount < maxRetries) {
        console.log(`[MatchField] Retrying... (${retryCount + 1}/${maxRetries})`);
        setTimeout(() => loadStatSettings(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      
      // Show user-friendly error after all retries fail
      setErrorMessage('No se pudo cargar la configuración de estadísticas. Por favor, verifica tu conexión a internet.');
      setShowErrorModal(true);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (showPlayerModal && matchDetails?.teamId) {
      // Always refresh players when modal opens
      console.log('[MatchField] Modal opened, refreshing players for team', matchDetails.teamId);
      loadPlayers(true);
    }
  }, [showPlayerModal]);

  const getStatsForPosition = (positionLabel: string): StatCategory[] => {
    const settings = statsByPosition[positionLabel] || [];
    console.log(`getStatsForPosition(${positionLabel}): ${settings.length} settings available`);
    const categoryMap = new Map<string, StatSetting[]>();
    
    // Función helper para normalizar stat_type para comparación
    const normalizeStatType = (statType: string): string => {
      const normalized = statType.toLowerCase().trim();
      // Normalizar variantes
      if (normalized.includes('punto directo') || normalized.includes('ace')) return 'punto_directo';
      if (normalized.includes('doble positiv') || normalized.includes('++')) return 'doble_positivo';
      if (normalized.includes('positiv') || normalized === '+') return 'positivo';
      if (normalized.includes('neutr') || normalized === '-' || normalized === '=') return 'neutro';
      if (normalized.includes('error')) return 'error';
      return normalized;
    };
    
    settings.forEach(setting => {
      if (!categoryMap.has(setting.stat_category)) {
        categoryMap.set(setting.stat_category, []);
      }
      // Evitar duplicados por stat_type normalizado dentro de la misma categoría
      const existing = categoryMap.get(setting.stat_category)!;
      const normalizedNew = normalizeStatType(setting.stat_type);
      const isDuplicate = existing.some(s => normalizeStatType(s.stat_type) === normalizedNew);
      
      if (!isDuplicate) {
        existing.push(setting);
      }
    });
    
    // Ordenar stats en el orden fijo: punto directo/doble positivo, positivo, neutro, error
    const sortInFixedOrder = (types: StatSetting[]): StatSetting[] => {
      const getStatPriority = (statType: string): number => {
        const norm = statType.toLowerCase().trim();
        
        // 1. Punto directo o Doble positivo
        if (norm.includes('punto directo') || norm.includes('ace') || 
            norm.includes('doble positiv') || norm === '++') return 1;
        
        // 2. Positivo (pero NO doble positivo)
        if ((norm.includes('positiv') || norm === '+') && 
          !norm.includes('doble')) return 2;
        
        // 3. Neutro
        if (norm.includes('neutr') || norm === '-' || norm === '=') return 3;
        
        // 4. Error
        if (norm.includes('error')) return 4;
        
        return 99;
      };
      
      return types.sort((a, b) => {
        return getStatPriority(a.stat_type) - getStatPriority(b.stat_type);
      });
    };
    
    return Array.from(categoryMap.entries()).map(([category, types]) => {
      // Buscar color directamente o por variantes
      let color = STAT_COLORS[category];
      if (!color) {
        // Probar sin acentos
        const noAccent = category.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        color = STAT_COLORS[noAccent] || STAT_COLORS[noAccent.toLowerCase()] || '#808080';
      }
      
      return {
        category,
        types: sortInFixedOrder(types),
        color,
      };
    });
  };

  const formatDate = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handlePositionPress = (positionId: string) => {
    const position = positions.find(p => p.id === positionId);
    if (position && position.label) {
      setSelectedPosition(positionId);
      setSelectedPositionLabel(position.label);
      // Abrir modal en la pestaña de posición para filtrar por tipo
      setActiveTab('position');
      setTimeout(() => {
        setShowPlayerModal(true);
      }, 0);
    }
  };

  const handleRemovePlayer = (positionId: string) => {
    setPositions(prev => prev.map(pos => 
      pos.id === positionId 
        ? { ...pos, playerId: null, playerName: null, playerNumber: null }
        : pos
    ));
  };

  const handleSelectPlayer = (player: Player) => {
    if (!selectedPosition) return;

    setPositions(prev => prev.map(pos => 
      pos.id === selectedPosition 
        ? { ...pos, playerId: player.id, playerName: player.name, playerNumber: player.number || null }
        : pos
    ));
    
    setShowPlayerModal(false);
    setSelectedPosition(null);
    setSelectedPositionLabel('');
  };

  const isPlayerAssigned = (playerId: number) => {
    return positions.some(pos => pos.playerId === playerId);
  };

  const getAvailablePlayers = () => {
    return players.filter(player => !isPlayerAssigned(player.id));
  };

  const getPlayersByPosition = (positionLabel: string) => {
    return getAvailablePlayers().filter(player => player.position === positionLabel);
  };

  const getOtherPlayers = (positionLabel: string) => {
    return getAvailablePlayers().filter(player => player.position !== positionLabel);
  };

  const getMatchTitle = () => {
    if (matchDetails.isHome) {
      return `${matchDetails.teamName} - ${matchDetails.rivalTeam}`;
    } else {
      return `${matchDetails.rivalTeam} - ${matchDetails.teamName}`;
    }
  };

  const handleAddStat = (position: Position, category: string, statType: string, settingId: number, color: string) => {
    if (!position.playerId || !isSetActive || !matchId) return;
    
    const actionId = `stat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Crear acción de estadística
    const statAction: StatAction = {
      id: actionId,
      playerId: position.playerId,
      playerName: position.playerName || '',
      playerNumber: position.playerNumber,
      setNumber: currentSet,
      statSettingId: settingId,
      statCategory: category,
      statType: statType,
      timestamp: Date.now(),
    };
    
    // Añadir a pending stats
    setPendingStats(prev => [...prev, statAction]);
    
    // Añadir al historial para poder deshacer
    setActionHistory(prev => [...prev, {
      type: 'add_stat',
      data: statAction,
      timestamp: Date.now(),
    }]);
    
    // Marcar último botón pulsado para highlight
    const buttonKey = `${position.id}_${category}_${statType}`;
    setLastPressedButton(buttonKey);
    
    // Mostrar feedback visual
    const iconName = getStatIconName(statType);
    showStatFeedback({
      playerName: position.playerName?.split(' ')[0] || '',
      statCategory: category,
      statType: statType,
      color: color,
      icon: iconName,
    });
    
    console.log(`📊 Stat añadida: ${position.playerName} - ${category}: ${statType}`);
  };

  // Helper para obtener el nombre del icono
  const getStatIconName = (statType: string): string => {
    const normalizedType = statType.toLowerCase();
    if (normalizedType.includes('doble positiv') || normalizedType.includes('++')) {
      return 'plus-circle-multiple';
    }
    if (normalizedType.includes('punto directo') || normalizedType.includes('ace')) {
      return 'bullseye-arrow';
    }
    if (normalizedType.includes('positiv') || normalizedType.includes('+')) {
      return 'plus-circle';
    }
    if (normalizedType.includes('neutr')) {
      return 'minus-circle';
    }
    if (normalizedType.includes('error')) {
      return 'close-circle';
    }
    return 'circle-outline';
  };

  const handleStartSet = () => {
    if (!isSetActive) {
      const newSetNumber = currentSet + 1;
      
      // Siempre eliminar posiciones vacías al iniciar cualquier set
      // Esto ajusta el grid al espacio completo con solo los jugadores asignados
      setPositions(prev => prev.filter(pos => pos.playerId !== null));
      
      setCurrentSet(newSetNumber);
      setIsSetActive(true);
      
      // Registrar acción en el historial
      setActionHistory(prev => [...prev, {
        type: 'start_set',
        data: { setNumber: newSetNumber },
        timestamp: Date.now(),
      }]);
      
      console.log(`Set ${newSetNumber} iniciado`);
    }
  };

  const handleEndSet = () => {
    if (isSetActive) {
      setShowEndSetAlert(true);
    }
  };

  // Función para guardar las estadísticas pendientes en BD
  const savePendingStats = async (): Promise<boolean> => {
    if (pendingStats.length === 0 || !matchId || !userId) return true;
    
    setSavingStats(true);
    try {
      const statsToSave: MatchStatCreate[] = pendingStats.map(stat => ({
        user_id: userId,
        match_id: matchId,
        player_id: stat.playerId,
        set_number: stat.setNumber,
        stat_setting_id: stat.statSettingId,
        stat_category: stat.statCategory,
        stat_type: stat.statType,
      }));
      
      const result = await statsService.saveMatchStatsBatch(statsToSave);
      console.log(`${result.inserted} estadisticas guardadas en BD`);
      
      // Limpiar stats pendientes del set actual
      setPendingStats([]);
      return true;
    } catch (error) {
      console.error('Error guardando estadisticas:', error);
      return false;
    } finally {
      setSavingStats(false);
    }
  };
  
  const confirmEndSet = async () => {
    // Guardar estadísticas antes de finalizar el set
    const saved = await savePendingStats();
    if (!saved) {
      console.warn('No se pudieron guardar las estadisticas');
    }
    
    const finishedSetNumber = currentSet;
    setIsSetActive(false);
    setLastPressedButton(null);
    
    // Registrar acción en el historial
    setActionHistory(prev => [...prev, {
      type: 'end_set',
      data: { setNumber: finishedSetNumber },
      timestamp: Date.now(),
    }]);
    
    console.log(`Set ${finishedSetNumber} finalizado`);
    setShowEndSetAlert(false);
    
    // Guardar el número del set completado y mostrar estadísticas del set recién finalizado
    setCompletedSetNumber(finishedSetNumber);
    setSetStatsFilter(null); // Reset filter
    setStatsViewType(finishedSetNumber); // Mostrar el set que acaba de finalizar
    setShowSetStatsModal(true);
  };

  const handleEndMatch = async () => {
    setShowEndSetAlert(false);
    setShowEndMatchAlert(true);
  };
  
  const confirmEndMatch = async () => {
    // Guardar estadísticas pendientes
    await savePendingStats();

    // Si no hay estadísticas guardadas, intentar reconstruirlas desde el historial
    if (matchId && userId) {
      try {
        const existingStats = await statsService.getMatchStats(matchId);
        if (!existingStats || existingStats.length === 0) {
          const historyStats = actionHistory
            .filter(a => a.type === 'add_stat' && a.data)
            .map(a => a.data as StatAction)
            .filter(s => s.playerId && s.statSettingId && s.statCategory && s.statType)
            .map(s => ({
              user_id: userId,
              match_id: matchId,
              player_id: s.playerId,
              set_number: s.setNumber,
              stat_setting_id: s.statSettingId,
              stat_category: s.statCategory,
              stat_type: s.statType,
            }));

          if (historyStats.length > 0) {
            await statsService.saveMatchStatsBatch(historyStats);
          }
        }
      } catch (error) {
        console.error('Error reconstruyendo estadisticas:', error);
      }
    }
    
    // Actualizar el partido en BD como finalizado
    if (matchId) {
      try {
        // Preparar los datos del resultado (opcional)
        const scoreHomeNum = scoreHome ? parseInt(scoreHome, 10) : null;
        const scoreAwayNum = scoreAway ? parseInt(scoreAway, 10) : null;
        
        const updatedMatch = await matchesService.finishMatch(
          matchId, 
          currentSet,
          scoreHomeNum,
          scoreAwayNum
        );
        setFinishedMatch(updatedMatch);
        console.log('Partido finalizado y guardado', { scoreHome: scoreHomeNum, scoreAway: scoreAwayNum });
        
        // Delete saved match state since match is finished
        try {
          await matchesService.deleteMatchState(matchId);
          console.log('Estado del partido eliminado');
        } catch (stateError) {
          console.log('No state to delete or error:', stateError);
        }
      } catch (error) {
        console.error('Error finalizando partido:', error);
      }
    }
    
    setShowEndMatchAlert(false);
    // Limpiar los campos de resultado
    setScoreHome('');
    setScoreAway('');
  };

  const handleShowMatchStats = async () => {
    await confirmEndMatch();
    setShowMatchStatsScreen(true);
  };

  const handleBackToField = () => {
    setShowMatchStatsScreen(false);
    // Opcionalmente puedes navegar a inicio aquí
  };

  const handleUndo = () => {
    if (actionHistory.length > 0) {
      const lastAction = actionHistory[actionHistory.length - 1];
      
      console.log('Deshaciendo ultima accion:', lastAction.type);
      
      // Revertir según el tipo de acción
      if (lastAction.type === 'start_set') {
        // Revertir inicio de set: volver al set anterior y marcar como no activo
        setCurrentSet(prev => prev - 1);
        setIsSetActive(false);
        setLastPressedButton(null);
      } else if (lastAction.type === 'end_set') {
        // Revertir finalización de set: marcar como activo nuevamente
        setIsSetActive(true);
      } else if (lastAction.type === 'add_stat') {
        // Eliminar la última estadística de pending
        const statToRemove = lastAction.data as StatAction;
        setPendingStats(prev => prev.filter(s => s.id !== statToRemove.id));
        
        // Actualizar último botón pulsado al anterior
        const remainingStatActions = actionHistory
          .slice(0, -1)
          .filter(a => a.type === 'add_stat');
        if (remainingStatActions.length > 0) {
          const prevStat = remainingStatActions[remainingStatActions.length - 1].data as StatAction;
          const pos = positions.find(p => p.playerId === prevStat.playerId);
          if (pos) {
            setLastPressedButton(`${pos.id}_${prevStat.statCategory}_${prevStat.statType}`);
          }
        } else {
          setLastPressedButton(null);
        }
        
        console.log(`Estadistica eliminada: ${statToRemove.playerName} - ${statToRemove.statCategory}: ${statToRemove.statType}`);
      }
      
      // Eliminar la acción del historial
      setActionHistory(prev => prev.slice(0, -1));
    }
  };

  const handleRemovePosition = (positionId: string) => {
    // Permitir eliminar todas las posiciones
    setPositions(prev => prev.filter(pos => pos.id !== positionId));
  };

  const handleAddPosition = (positionLabel: string) => {
    if (positions.length < 8) {
      const newId = `pos${Date.now()}`;
      setPositions(prev => [...prev, {
        id: newId,
        label: positionLabel,
        playerId: null,
        playerName: null,
        playerNumber: null,
      }]);
    }
    setShowAddPositionModal(false);
  };

  const handleChangePosition = (newPositionLabel: string) => {
    if (!selectedPosition) return;
    
    setPositions(prev => prev.map(pos => 
      pos.id === selectedPosition 
        ? { ...pos, label: newPositionLabel }
        : pos
    ));
    
    setShowChangePositionModal(false);
  };

  const handleOpenStats = () => {
    if (currentSet > 0) {
      // Si hay un set activo, mostrar ese set, si no, mostrar el último completado
      const setToShow = isSetActive ? currentSet : (currentSet > 0 ? currentSet : 1);
      setCompletedSetNumber(setToShow);
      setSetStatsFilter(null);
      setStatsViewType(setToShow);
      setShowSetStatsModal(true);
    }
  };

  // Obtener estadísticas del set completado con filtro
  const getSetStats = (applyPlayerFilter: boolean = true) => {
    let stats: StatAction[] = [];
    
    // Filtrar según el tipo de vista
    if (statsViewType === 'match') {
      // Todo el partido: obtener stats guardadas de todos los sets
      // Si hay set activo: sets completados (<) + pendingStats del actual
      // Si NO hay set activo: todos los sets completados (<=) incluyendo el que acaba de finalizar
      const setCondition = isSetActive 
        ? (setNum: number) => setNum < currentSet 
        : (setNum: number) => setNum <= currentSet;
      
      const completedSetsStats = actionHistory
        .filter(a => a.type === 'add_stat' && setCondition(a.data.setNumber))
        .map(a => a.data);
      
      // Si hay set activo, añadir las stats pendientes del set actual
      stats = isSetActive ? [...completedSetsStats, ...pendingStats] : completedSetsStats;
    } else {
      // Vista de set específico (número)
      const setNumber = typeof statsViewType === 'number' ? statsViewType : currentSet;
      
      // Si es el set actual y está activo, usar pendingStats
      if (setNumber === currentSet && isSetActive) {
        stats = [...pendingStats];
      } else {
        // Si no, buscar en el historial
        stats = actionHistory
          .filter(a => a.type === 'add_stat' && a.data.setNumber === setNumber)
          .map(a => a.data);
      }
    }
    
    // Aplicar filtro por jugador si está activo y se solicita
    if (applyPlayerFilter && setStatsFilter !== null) {
      stats = stats.filter(s => s.playerId === setStatsFilter);
    }
    
    return stats;
  };

  // Función para obtener puntuación de un stat (para G-P)
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

  // Orden fijo para categorías
  const CATEGORY_ORDER = ['ataque', 'recepcion', 'saque', 'bloqueo', 'defensa', 'colocacion'];

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

  // Agrupar estadísticas por categoría
  const getStatsByCategory = (stats: StatAction[]) => {
    const grouped: Record<string, { statType: string; count: number }[]> = {};
    
    stats.forEach(stat => {
      if (!grouped[stat.statCategory]) {
        grouped[stat.statCategory] = [];
      }
      const existing = grouped[stat.statCategory].find(s => s.statType === stat.statType);
      if (existing) {
        existing.count++;
      } else {
        grouped[stat.statCategory].push({ statType: stat.statType, count: 1 });
      }
    });
    
    // Ordenar tipos dentro de cada categoría: doble positivo/punto directo, positivo, neutro, error
    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) => {
          const getPriority = (statType: string): number => {
          const norm = statType.toLowerCase().trim();
          if (norm.includes('punto directo') || norm.includes('ace') || 
            norm.includes('doble positiv') || norm === '++') return 1;
          if ((norm.includes('positiv') || norm === '+') && 
            !norm.includes('doble')) return 2;
          if (norm.includes('neutr') || norm === '-' || norm === '=') return 3;
          if (norm.includes('error')) return 4;
          return 99;
        };
        return getPriority(a.statType) - getPriority(b.statType);
      });
    });
    
    return grouped;
  };

  // Obtener jugadores únicos del set (sin filtro de jugador para mostrar todos en filtros)
  const getSetPlayers = () => {
    // Obtener stats SIN filtro de jugador para mostrar todos los jugadores disponibles
    const stats = getSetStats(false);
    const playersMap = new Map<number, { id: number; name: string; number: number | null }>();
    
    stats.forEach(stat => {
      if (!playersMap.has(stat.playerId)) {
        playersMap.set(stat.playerId, {
          id: stat.playerId,
          name: stat.playerName,
          number: stat.playerNumber,
        });
      }
    });
    
    return Array.from(playersMap.values()).sort((a, b) => (a.number || 0) - (b.number || 0));
  };

  // Autoscroll del selector de tipo de vista cuando se abre el modal o cambia la vista seleccionada
  useEffect(() => {
    if (!showSetStatsModal) return;

    const scrollRef = viewTypeScrollRef.current;
    if (!scrollRef) return;

    // Construir la lista de sets mostrados (misma lógica que en el render)
    const displayedSets = Array.from({ length: currentSet }, (_, i) => i + 1)
      .filter(setNum => setNum < currentSet || !isSetActive);

    let index = 0; // 0 -> Partido

    if (statsViewType === 'match') {
      index = 0;
    } else if (typeof statsViewType === 'number') {
      const setNum = statsViewType as number;
      const pos = displayedSets.indexOf(setNum);
      if (pos >= 0) {
        // +1 por el card 'Partido'
        index = 1 + pos;
      } else if (isSetActive && setNum === currentSet) {
        // El 'Set Actual' está al final cuando está activo
        index = 1 + displayedSets.length;
      }
    }

    // Estimación del ancho de cada card para calcular desplazamiento
    const CARD_ESTIMATED_WIDTH = 120;
    const SPACING_ESTIMATED = 12; // margen entre cards
    const x = Math.max(0, index * (CARD_ESTIMATED_WIDTH + SPACING_ESTIMATED));

    // Esperar un poco a que se renderice el contenido del modal
    const t = setTimeout(() => {
      try {
        scrollRef.scrollTo({ x, animated: true });
      } catch (e) {
        // noop
      }
    }, 120);

    return () => clearTimeout(t);
  }, [showSetStatsModal, statsViewType, currentSet, isSetActive]);

  // Calcular G-P total de las estadísticas
  const calculateGP = (stats: StatAction[]) => {
    let gp = 0;
    stats.forEach(stat => {
      gp += getStatScore(stat.statType);
    });
    return gp;
  };

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

  const getStatIcon = (statType: string, color: string, size: number = 24) => {
    const normalizedType = statType.toLowerCase();
    
    // Doble positivo = icono de doble plus
    if (normalizedType.includes('doble positiv') || normalizedType.includes('++')) {
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
    // Neutro = Equal sign (=)
    if (normalizedType.includes('neutr')) {
      return <MaterialCommunityIcons name="equal" size={size} color={color} />;
    }
    // Error = Close circle
    if (normalizedType.includes('error')) {
      return <MaterialCommunityIcons name="close-circle" size={size} color={color} />;
    }
    
    return <MaterialCommunityIcons name="circle-outline" size={size} color={color} />;
  };

  // Create SVG arc path for pie chart
  const createArcPath = (
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ): string => {
    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);

    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  // Render pie chart for category stats
  const renderCategoryPieChart = (data: { statType: string; count: number; color: string }[], total: number) => {
    if (total === 0) return null;

    const size = 100;
    const center = size / 2;
    const radius = size / 2 - 2;
    const innerRadius = radius * 0.45;

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
      <View style={styles.categoryPieChartContainer}>
        <View style={styles.categoryPieSvgWrapper}>
          <Svg width={size} height={size}>
            <G>
              {segments.map((segment, idx) => {
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
            {/* Donut center */}
            <Path
              d={`M ${center} ${center - innerRadius} A ${innerRadius} ${innerRadius} 0 1 1 ${center - 0.01} ${center - innerRadius} Z`}
              fill={Colors.surface}
            />
          </Svg>
        </View>

        {/* Legend table */}
        <View style={styles.categoryPieLegend}>
          <View style={styles.categoryPieLegendHeader}>
            <Text style={styles.categoryPieLegendHeaderText}>Tipo</Text>
            <Text style={styles.categoryPieLegendHeaderRight}>Cant.</Text>
            <Text style={styles.categoryPieLegendHeaderRight}>%</Text>
          </View>
          {segments.map((segment, idx) => (
            <View key={idx} style={styles.categoryPieLegendRow}>
              <View style={styles.categoryPieLegendTypeCell}>
                {getStatIcon(segment.statType, segment.color, 16)}
                <Text style={[styles.categoryPieLegendTypeName, { color: segment.color }]} numberOfLines={1}>
                  {segment.statType}
                </Text>
              </View>
              <Text style={styles.categoryPieLegendCount}>{segment.count}</Text>
              <Text style={styles.categoryPieLegendPercent}>{Math.round(segment.percentage)}%</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Si se debe mostrar la pantalla de estadísticas del partido, renderizarla
  if (showMatchStatsScreen && finishedMatch) {
    return (
      <MatchStatsScreen 
        match={finishedMatch} 
        onBack={handleBackToField}
        onOpenMenu={onOpenMenu}
      />
    );
  }

  const renderPlayerRow = (position: Position, index: number) => {
    const categories = position.playerId ? getStatsForPosition(position.label) : [];
    
    return (
      <View key={position.id} style={[styles.playerRow, index < positions.length - 1 && styles.playerRowDivider]}>
        {/* Columna jugador */}
        <TouchableOpacity
          style={[
            styles.playerCell,
            position.playerId ? styles.playerCellFilled : null
          ]}
          onPress={() => handlePositionPress(position.id)}
          onLongPress={() => position.playerId && handleRemovePlayer(position.id)}
          activeOpacity={0.7}
        >
          {position.playerId ? (
            <>
              <View style={styles.playerNumberCircle}>
                <Text style={styles.playerRowNumber}>{position.playerNumber}</Text>
              </View>
              <Text style={styles.playerRowName} numberOfLines={1}>
                {position.playerName?.split(' ')[0]}
              </Text>
              <View style={styles.playerChangeIndicator}>
                <MaterialCommunityIcons name="swap-horizontal" size={12} color={Colors.primary} />
              </View>
            </>
          ) : (
            <>
              <PlusIcon size={28} color={Colors.text} />
              <Text style={styles.positionAbbrev}>{position.label.substring(0, 3)}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Columnas de estadísticas por categoría */}
        <View style={styles.statsRow}>
          {position.playerId ? (
            categories.map((cat) => (
              <View key={cat.category} style={styles.categoryColumn}>
                <View style={[styles.categoryHeader, { backgroundColor: cat.color }]}>
                  <Text style={styles.categoryHeaderText}>
                    {cat.category.substring(0, 3)}
                  </Text>
                </View>
                <View style={styles.statButtonsGrid}>
                  {/* Layout dinámico según cantidad de botones */}
                  {cat.types.map((stat, idx) => {
                    const total = cat.types.length;
                    let btnStyle: any = styles.statBtn;
                    
                    // 4 botones: 50% x 50% (grid 2x2)
                    if (total === 4) {
                      btnStyle = styles.statBtn;
                    }
                    // 3 botones: 2 arriba 50%, 1 abajo 100%
                    else if (total === 3) {
                      btnStyle = idx < 2 ? styles.statBtnHalf : styles.statBtnFull;
                    }
                    // 2 botones: cada uno 100% ancho
                    else if (total === 2) {
                      btnStyle = styles.statBtnFull;
                    }
                    // 1 botón: 100% todo
                    else if (total === 1) {
                      btnStyle = styles.statBtnFullHeight;
                    }
                    
                    const buttonKey = `${position.id}_${cat.category}_${stat.stat_type}`;
                    const isHighlighted = lastPressedButton === buttonKey;
                    const isDisabled = !isSetActive;
                    
                    return (
                      <TouchableOpacity
                        key={`${stat.id}-${idx}`}
                        style={[
                          btnStyle, 
                          { borderColor: 'transparent', borderWidth: 3 },
                          isHighlighted && { borderColor: cat.color, backgroundColor: cat.color + '15' },
                          isDisabled && { opacity: 0.4 }
                        ]}
                        onPress={() => handleAddStat(position, cat.category, stat.stat_type, stat.id, cat.color)}
                        activeOpacity={0.6}
                        disabled={isDisabled}
                      >
                        {getStatIcon(stat.stat_type, cat.color, 22)}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))
          ) : (
            <TouchableOpacity
              style={styles.emptyStatsPlaceholder}
              onPress={() => handlePositionPress(position.id)}
              activeOpacity={0.7}
              disabled={isSetActive}
            >
              <Text style={styles.emptyStatsText}>Selecciona jugador</Text>
              {!isSetActive && (
                <TouchableOpacity 
                  style={styles.deletePositionButton}
                  onPress={() => handleRemovePosition(position.id)}
                  activeOpacity={0.7}
                >
                  <DeleteIcon size={20} color="#ef4444" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Background accents to match theme (soft pink blobs) */}
      <View style={styles.backgroundAccentTop} pointerEvents="none" />
      {/* Header oscuro compacto */}
      <View style={styles.header}>
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.menuButton} onPress={onOpenMenu}>
            <MenuIcon size={22} color="#FFFFFF" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, !isSetActive && styles.actionButtonPrimary]}
            onPress={handleStartSet}
            disabled={isSetActive}
            activeOpacity={0.7}
          >
            <Text style={[styles.actionButtonText, !isSetActive && styles.actionButtonTextPrimary]}>
              Iniciar
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.setDisplay}
            onPress={handleOpenStats}
            disabled={currentSet === 0}
            activeOpacity={0.7}
          >
            <View style={styles.setDisplayContent}>
              <Text style={styles.setLabel}>SET</Text>
              <Text style={styles.setNumber}>{currentSet || '—'}</Text>
            </View>
            {currentSet > 0 && (
              <MaterialCommunityIcons 
                name="chart-bar" 
                size={14} 
                color={Colors.textTertiary} 
                style={styles.setStatsHint}
              />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, isSetActive && styles.actionButtonPrimary]}
            onPress={handleEndSet}
            disabled={!isSetActive}
            activeOpacity={0.7}
          >
            <Text style={[styles.actionButtonText, isSetActive && styles.actionButtonTextPrimary]}>
              Finalizar
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.undoButton, actionHistory.length === 0 && styles.buttonDisabled]}
            onPress={handleUndo}
            disabled={actionHistory.length === 0}
            activeOpacity={0.7}
          >
            <Text style={styles.undoIcon}>↶</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contenido principal: Filas de jugadores con sus estadísticas */}
      <View style={styles.mainContent}>
        {positions.length === 0 ? (
          <View style={styles.emptyPositionsContainer}>
            <Text style={styles.emptyPositionsText}>No hay posiciones configuradas</Text>
            <Text style={styles.emptyPositionsSubtext}>Añade posiciones para comenzar</Text>
          </View>
        ) : (
          positions.map((pos, idx) => renderPlayerRow(pos, idx))
        )}
        
        {/* Botón para añadir posición - visible siempre que haya menos de 8 jugadores */}
        {positions.length < 8 && (
          <TouchableOpacity 
            style={styles.addPositionButton}
            onPress={() => setShowAddPositionModal(true)}
            activeOpacity={0.7}
          >
            <PlusIcon size={24} color={Colors.primary} />
            <Text style={styles.addPositionText}>Añadir posición</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* CustomAlert para finalizar set */}
      <CustomAlert
        visible={showEndSetAlert}
        title="Finalizar Set"
        message={`¿Qué deseas hacer con el set ${currentSet}?`}
        buttonLayout="column"
        buttons={[
          {
            text: 'Finalizar set',
            onPress: confirmEndSet,
            style: 'default'
          },
          {
            text: 'Finalizar partido',
            onPress: handleEndMatch,
            style: 'destructive'
          },
          {
            text: 'Cancelar',
            onPress: () => setShowEndSetAlert(false),
            style: 'cancel'
          }
        ]}
      />

      {/* Modal para finalizar partido con resultado */}
      <Modal
        visible={showEndMatchAlert}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowEndMatchAlert(false);
          setScoreHome('');
          setScoreAway('');
        }}
      >
        <View style={styles.endMatchModalOverlay}>
          <View style={styles.endMatchModalContent}>
            <View style={styles.endMatchHeader}>
              <View style={styles.endMatchLogoWrapper}>
                <Image
                  source={require('../assets/VBStats_logo_sinfondo.png')}
                  style={styles.endMatchLogo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.endMatchAppName}>VBStats</Text>
            </View>

            <View style={styles.endMatchContentArea}>
              <View style={styles.endMatchIconContainer}>
                <MaterialCommunityIcons name="trophy-outline" size={32} color={Colors.primary} />
              </View>
              <Text style={styles.endMatchModalTitle}>Partido finalizado</Text>
              <Text style={styles.endMatchModalSubtitle}>
                Añade el resultado del partido (opcional)
              </Text>
              
              <View style={styles.scoreInputContainer}>
                <View style={styles.scoreInputWrapper}>
                  <View style={styles.scoreLabelContainer}>
                    <Text style={styles.scoreLabel} numberOfLines={2} ellipsizeMode="tail">
                      {matchDetails.teamName || 'Local'}
                    </Text>
                  </View>
                  <TextInput
                    style={styles.scoreInput}
                    value={scoreHome}
                    onChangeText={setScoreHome}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.textTertiary}
                    maxLength={2}
                  />
                </View>
                
                <Text style={styles.scoreSeparator}>-</Text>
                
                <View style={styles.scoreInputWrapper}>
                  <View style={styles.scoreLabelContainer}>
                    <Text style={styles.scoreLabel} numberOfLines={2} ellipsizeMode="tail">
                      {matchDetails.rivalTeam || 'Rival'}
                    </Text>
                  </View>
                  <TextInput
                    style={styles.scoreInput}
                    value={scoreAway}
                    onChangeText={setScoreAway}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.textTertiary}
                    maxLength={2}
                  />
                </View>
              </View>
              
              <View style={styles.endMatchButtonsContainer}>
                <TouchableOpacity
                  style={[styles.endMatchButton, styles.endMatchButtonPrimary]}
                  onPress={handleShowMatchStats}
                  activeOpacity={0.8}
                >
                  <Text style={styles.endMatchButtonTextPrimary}>Ver estadísticas</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.endMatchButton, styles.endMatchButtonSecondary]}
                  onPress={() => {
                    confirmEndMatch();
                    // TODO: Navegar a inicio
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.endMatchButtonTextSecondary}>Volver a inicio</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.endMatchButton, styles.endMatchButtonCancel]}
                  onPress={() => {
                    setShowEndMatchAlert(false);
                    setScoreHome('');
                    setScoreAway('');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.endMatchButtonTextCancel}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal selección de jugador */}
      <Modal
        visible={showPlayerModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPlayerModal(false);
          setSelectedPosition(null);
          setSelectedPositionLabel('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Jugador</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowPlayerModal(false);
                  setSelectedPosition(null);
                  setSelectedPositionLabel('');
                }}
              >
                <XIcon size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'position' && styles.tabActive
                ]}
                onPress={() => setActiveTab('position')}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === 'position' && styles.tabTextActive
                ]}>
                  {selectedPositionLabel}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'others' && styles.tabActive
                ]}
                onPress={() => setActiveTab('others')}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === 'others' && styles.tabTextActive
                ]}>
                  Otros
                </Text>
              </TouchableOpacity>
            </View>

            {/* Content area wrapper with explicit flex */}
            <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
              {(() => {
                console.log('[MatchField Modal] Rendering content...');
                console.log('[MatchField Modal] Total players:', players.length);
                console.log('[MatchField Modal] Players:', players.map(p => `${p.name} (${p.position})`).join(', '));
                console.log('[MatchField Modal] selectedPositionLabel:', selectedPositionLabel);
                console.log('[MatchField Modal] activeTab:', activeTab);
                console.log('[MatchField Modal] loadingPlayers:', loadingPlayers);
                
                if (!selectedPositionLabel) {
                  console.log('[MatchField Modal] No selectedPositionLabel');
                  return (
                    <View style={styles.loadingContainer}>
                      <Text style={styles.loadingText}>Cargando...</Text>
                    </View>
                  );
                }
                
                if (loadingPlayers) {
                  console.log('[MatchField Modal] Still loading players');
                  return (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color={Colors.primary} />
                      <Text style={styles.loadingText}>Cargando jugadores...</Text>
                    </View>
                  );
                }
                
                const availablePlayers = getAvailablePlayers();
                console.log('[MatchField Modal] Available players:', availablePlayers.length);
                console.log('[MatchField Modal] Available:', availablePlayers.map(p => `${p.name} (${p.position})`).join(', '));
                
                if (availablePlayers.length === 0) {
                  console.log('[MatchField Modal] No available players');
                  return (
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>
                        {players.length === 0 
                          ? 'No hay jugadores en este equipo. Verifica que el equipo tenga jugadores asignados.'
                          : 'Todos los jugadores ya están asignados'}
                      </Text>
                      {players.length === 0 && (
                        <TouchableOpacity
                          style={{ marginTop: Spacing.md, padding: Spacing.sm, backgroundColor: Colors.primary, borderRadius: BorderRadius.md }}
                          onPress={() => loadPlayers(true)}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: '#fff', fontWeight: '600', fontSize: FontSizes.sm }}>Reintentar</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }
                
                // Get players for the active tab
                let playersToShow = activeTab === 'position' 
                  ? getPlayersByPosition(selectedPositionLabel)
                  : getOtherPlayers(selectedPositionLabel);
                
                console.log('[MatchField Modal] playersToShow (before fallback):', playersToShow.length);
                
                // If position tab is empty but there are available players, show ALL available
                if (playersToShow.length === 0 && activeTab === 'position' && availablePlayers.length > 0) {
                  console.log('[MatchField Modal] Applying fallback: showing all available players');
                  playersToShow = availablePlayers;
                }
                
                console.log('[MatchField Modal] Final playersToShow:', playersToShow.length);
              
              return (
                <View style={styles.playerListWrapper}>
                  <FlatList
                    data={playersToShow}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.playerItem}
                        onPress={() => handleSelectPlayer(item)}
                        activeOpacity={0.7}
                      >
                        {item.number && (
                          <View style={styles.playerItemNumber}>
                            <Text style={styles.playerItemNumberText}>{item.number}</Text>
                          </View>
                        )}
                        <View style={styles.playerItemInfo}>
                          <Text style={styles.playerItemName}>{item.name}</Text>
                          <Text style={styles.playerItemPosition}>
                            {item.position}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    contentContainerStyle={styles.playerListContent}
                    ListEmptyComponent={
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                          {activeTab === 'position'
                            ? `No hay jugadores de ${selectedPositionLabel} disponibles`
                            : 'No hay otros jugadores disponibles'}
                        </Text>
                      </View>
                    }
                  />
                </View>
                );
              })()}
            </View>

            {/* Footer con botones de eliminar y modificar posición */}
            {selectedPosition && (
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalFooterButton, styles.modalFooterButtonDelete]}
                  onPress={() => {
                    handleRemovePosition(selectedPosition);
                    setShowPlayerModal(false);
                    setSelectedPosition(null);
                    setSelectedPositionLabel('');
                  }}
                  activeOpacity={0.7}
                >
                  <DeleteIcon size={24} color="#FFFFFF" />
                  <Text style={styles.modalFooterButtonText} numberOfLines={2} adjustsFontSizeToFit>Eliminar{"\n"}posición</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalFooterButton, styles.modalFooterButtonChange]}
                  onPress={() => {
                    setShowPlayerModal(false);
                    setShowChangePositionModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="swap-horizontal" size={24} color="#FFFFFF" />
                  <Text style={styles.modalFooterButtonText} numberOfLines={2} adjustsFontSizeToFit>Modificar{"\n"}posición</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal añadir posición */}
      <Modal
        visible={showAddPositionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddPositionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addPositionModalContent}>
            {/* Header al estilo CustomAlert */}
            <View style={styles.customAlertHeader}>
              <View style={styles.customAlertLogoWrapper}>
                <Image
                  source={require('../assets/VBStats_logo_sinfondo.png')}
                  style={styles.customAlertLogo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.customAlertAppName}>VBStats</Text>
            </View>
            
            {/* Content area */}
            <ScrollView 
              style={styles.customAlertScrollView}
              contentContainerStyle={styles.customAlertContentArea}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.customAlertIconContainer}>
                <PlusIcon size={32} color={Colors.primary} />
              </View>
              <Text style={styles.customAlertTitle}>Añadir Posición</Text>
              <Text style={styles.customAlertSubtitle}>Selecciona la posición del jugador</Text>
              
              <View style={styles.positionOptionsContainer}>
                {['Receptor', 'Central', 'Opuesto', 'Colocador', 'Líbero'].map((pos) => (
                  <TouchableOpacity
                    key={pos}
                    style={styles.positionOption}
                    onPress={() => handleAddPosition(pos)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.positionOptionText}>{pos}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <TouchableOpacity
                style={styles.customAlertCancelButton}
                onPress={() => setShowAddPositionModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.customAlertCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal cambiar posición */}
      <Modal
        visible={showChangePositionModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowChangePositionModal(false);
          setSelectedPosition(null);
          setSelectedPositionLabel('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addPositionModalContent}>
            {/* Header al estilo CustomAlert */}
            <View style={styles.customAlertHeader}>
              <View style={styles.customAlertLogoWrapper}>
                <Image
                  source={require('../assets/VBStats_logo_sinfondo.png')}
                  style={styles.customAlertLogo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.customAlertAppName}>VBStats</Text>
            </View>
            
            {/* Content area */}
            <ScrollView 
              style={styles.customAlertScrollView}
              contentContainerStyle={styles.customAlertContentArea}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.customAlertIconContainer}>
                <MaterialCommunityIcons name="swap-horizontal" size={32} color={Colors.primary} />
              </View>
              <Text style={styles.customAlertTitle}>Cambiar Posición</Text>
              <Text style={styles.customAlertSubtitle}>Selecciona la nueva posición</Text>
              
              <View style={styles.positionOptionsContainer}>
              {['Receptor', 'Central', 'Opuesto', 'Colocador', 'Líbero'].map((pos) => (
                <TouchableOpacity
                  key={pos}
                  style={styles.positionOption}
                  onPress={() => handleChangePosition(pos)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.positionOptionText}>{pos}</Text>
                </TouchableOpacity>
              ))}
              </View>
              
              <TouchableOpacity
                style={styles.customAlertCancelButton}
                onPress={() => {
                  setShowChangePositionModal(false);
                  setSelectedPosition(null);
                  setSelectedPositionLabel('');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.customAlertCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de estadísticas del set */}
      <Modal
        visible={showSetStatsModal}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent={true}
        onRequestClose={() => setShowSetStatsModal(false)}
      >
        <View style={styles.setStatsContainer}>
          {/* Safe Area Header Container */}
          <View style={styles.statsModalSafeHeader}>
            {/* Modern Unified Header */}
            <View style={styles.statsModalHeaderModern}>
              {/* Top Row: Close button and title */}
              <View style={styles.statsModalTopRow}>
                <TouchableOpacity 
                  style={styles.statsModalCloseButtonModern}
                  onPress={() => setShowSetStatsModal(false)}
                >
                  <MaterialCommunityIcons name="close" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.statsModalTitleContainerModern}>
                  <MaterialCommunityIcons name="chart-bar" size={20} color="#FFFFFF" />
                  <Text style={styles.statsModalTitleModern}>Estadísticas</Text>
                </View>
                <View style={{ width: 36 }} />
              </View>

              {/* Filter Tabs Row: Match / Sets */}
              <ScrollView 
                ref={viewTypeScrollRef}
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.statsModalFilterTabs}
              >
                {/* Partido completo */}
                <TouchableOpacity
                  style={[styles.statsFilterTab, statsViewType === 'match' && styles.statsFilterTabActive]}
                  onPress={() => setStatsViewType('match')}
                >
                  <MaterialCommunityIcons 
                    name="trophy" 
                    size={16} 
                    color={statsViewType === 'match' ? Colors.primary : 'rgba(255,255,255,0.7)'} 
                  />
                  <Text style={[styles.statsFilterTabText, statsViewType === 'match' && styles.statsFilterTabTextActive]}>
                    Partido
                  </Text>
                </TouchableOpacity>

                {/* Sets individuales completados */}
                {Array.from({ length: currentSet }, (_, i) => i + 1)
                  .filter(setNum => setNum < currentSet || !isSetActive)
                  .map(setNum => (
                    <TouchableOpacity
                      key={`set-${setNum}`}
                      style={[styles.statsFilterTab, statsViewType === setNum && styles.statsFilterTabActive]}
                      onPress={() => setStatsViewType(setNum)}
                    >
                      <MaterialCommunityIcons 
                        name="volleyball" 
                        size={16} 
                        color={statsViewType === setNum ? Colors.primary : 'rgba(255,255,255,0.7)'} 
                      />
                      <Text style={[styles.statsFilterTabText, statsViewType === setNum && styles.statsFilterTabTextActive]}>
                        Set {setNum}
                      </Text>
                    </TouchableOpacity>
                  ))}

                {/* Set actual (solo si hay un set activo) */}
                {isSetActive && (
                  <TouchableOpacity
                    style={[styles.statsFilterTab, statsViewType === currentSet && styles.statsFilterTabActive]}
                    onPress={() => setStatsViewType(currentSet)}
                  >
                    <View style={styles.liveIndicator} />
                    <Text style={[styles.statsFilterTabText, statsViewType === currentSet && styles.statsFilterTabTextActive]}>
                      Set Actual
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>

              {/* Player Filter Row */}
              <View style={styles.statsModalPlayerFilterRow}>
                <ScrollView 
                  ref={setStatsFilterScrollRef}
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.statsModalPlayerFilterContent}
                >
                  <TouchableOpacity
                    style={[styles.playerChip, setStatsFilter === null && styles.playerChipActive]}
                    onPress={() => {
                      setSetStatsFilter(null);
                      setStatsFilterScrollRef.current?.scrollTo({ x: 0, animated: true });
                    }}
                  >
                    <MaterialCommunityIcons 
                      name="account-group" 
                      size={14} 
                      color={setStatsFilter === null ? Colors.primary : 'rgba(255,255,255,0.8)'} 
                    />
                    <Text style={[styles.playerChipText, setStatsFilter === null && styles.playerChipTextActive]}>
                      Equipo
                    </Text>
                  </TouchableOpacity>
                  {getSetPlayers().map((player, index) => (
                    <TouchableOpacity
                      key={player.id}
                      style={[styles.playerChip, setStatsFilter === player.id && styles.playerChipActive]}
                      onPress={() => {
                        setSetStatsFilter(player.id);
                        setTimeout(() => {
                          setStatsFilterScrollRef.current?.scrollTo({ 
                            x: (index + 1) * 90, 
                            animated: true 
                          });
                        }, 100);
                      }}
                    >
                      <View style={[styles.playerChipNumber, setStatsFilter === player.id && styles.playerChipNumberActive]}>
                        <Text style={[styles.playerChipNumberText, setStatsFilter === player.id && styles.playerChipNumberTextActive]}>
                          {player.number}
                        </Text>
                      </View>
                      <Text style={[styles.playerChipText, setStatsFilter === player.id && styles.playerChipTextActive]}>
                        {player.name.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>

          {/* Contenido de estadísticas */}
          <ScrollView style={styles.setStatsContent} showsVerticalScrollIndicator={false}>
            {(() => {
              const stats = getSetStats(true);
              const statsByCategory = getStatsByCategory(stats);
              const orderedCategoryKeys = sortCategories(Object.keys(statsByCategory));
              const totalActions = stats.length;

              if (totalActions === 0) {
                return (
                  <View style={styles.setStatsEmpty}>
                    <MaterialCommunityIcons name="information-outline" size={64} color={Colors.textTertiary} />
                    <Text style={styles.setStatsEmptyText}>Sin estadísticas registradas</Text>
                  </View>
                );
              }

              return (
                <>
                  {/* Resumen Total con G-P */}
                  <View style={styles.setStatsSummary}>
                    <Text style={styles.setStatsCategoriesTitle}>Resumen</Text>
                    <View style={styles.summaryGPContainer}>
                      <View style={styles.summaryGPCard}>
                        <Text style={styles.summaryGPLabel}>G-P</Text>
                        <Text style={[
                          styles.summaryGPValue,
                          calculateGP(stats) > 0 && styles.gpValuePositive,
                          calculateGP(stats) < 0 && styles.gpValueNegative
                        ]}>{calculateGP(stats) > 0 ? '+' : ''}{calculateGP(stats)}</Text>
                      </View>
                      <View style={styles.summaryGPCard}>
                        <Text style={styles.summaryGPLabel}>Total Acciones</Text>
                        <Text style={styles.summaryGPValue}>{totalActions}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Desglose por Categoría */}
                  <View style={styles.setStatsCategories}>
                    <Text style={styles.setStatsCategoriesTitle}>Desglose por Categoría</Text>
                    {orderedCategoryKeys.map((category) => {
                      const catStats = statsByCategory[category] || [];
                      const total = catStats.reduce((sum, s) => sum + s.count, 0);
                      const categoryColor = STAT_COLORS[category] || Colors.primary;
                      // Prepare data for pie chart
                      const pieData = catStats.map(stat => ({
                        statType: stat.statType,
                        count: stat.count,
                        color: getStatColor(stat.statType),
                      }));
                      return (
                        <View key={category} style={styles.setStatsCategoryCard}>
                          <View style={styles.setStatsCategoryHeader}>
                            <StatsIcon size={20} color={categoryColor} />
                            <Text style={styles.setStatsCategoryName}>{category}</Text>
                            <Text style={styles.setStatsCategoryTotal}>{total} acciones</Text>
                          </View>
                          {/* Pie chart for this category */}
                          {renderCategoryPieChart(pieData, total)}
                        </View>
                      );
                    })}
                  </View>
                </>
              );
            })()}
          </ScrollView>

          {/* Footer con botón para continuar */}
          <View style={styles.setStatsFooter}>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={() => setShowSetStatsModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.continueButtonText}>Continuar Partido</Text>
              <MaterialCommunityIcons name="arrow-right" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Visual Feedback Overlay - Animated icon + stat name */}
      {lastStatFeedback && (
        <Animated.View
          style={[
            styles.feedbackOverlay,
            {
              opacity: feedbackOpacity,
              transform: [{ scale: feedbackScale }],
            },
          ]}
          pointerEvents="none"
        >
          <View style={[styles.feedbackContent, { borderColor: lastStatFeedback.color }]}>
            {getStatIcon(lastStatFeedback.statType, lastStatFeedback.color, 64)}
            <Text style={[styles.feedbackStatName, { color: lastStatFeedback.color }]}>
              {lastStatFeedback.statType}
            </Text>
            <Text style={styles.feedbackCategoryName}>
              {lastStatFeedback.statCategory}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* CustomAlert para errores de carga */}
      <CustomAlert
        visible={showErrorModal}
        title="Error"
        message={errorMessage}
        buttons={[
          {
            text: 'OK',
            onPress: () => setShowErrorModal(false),
            style: 'default'
          }
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR_HEIGHT : 0,
    paddingBottom: Platform.OS === 'android' ? ANDROID_NAV_BAR_HEIGHT : 0,
  },
  header: {
    backgroundColor: '#1a1a1a',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  undoButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  undoIcon: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlignVertical: 'center',
    paddingBottom: 4,
  },
  buttonDisabled: {
    opacity: 0.3,
    backgroundColor: Colors.primary + '25',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  actionButtonPrimary: {
    backgroundColor: Colors.primary,
    borderColor: '#FFFFFF',
  },
  actionButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  actionButtonTextPrimary: {
    color: '#FFFFFF',
  },
  setDisplay: {
    width: 70,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: Colors.primary,
    position: 'relative',
  },
  setDisplayContent: {
    alignItems: 'center',
  },
  setStatsHint: {
    position: 'absolute',
    bottom: 2,
    right: 4,
    opacity: 0.7,
  },
  setLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  setNumber: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.primary,
  },
  
  // Contenido principal
  mainContent: {
    flex: 1,
  },
  
  // Fila de jugador
  playerRow: {
    flex: 1,
    flexDirection: 'row',
  },
  playerRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  
  // Celda del jugador (izquierda)
  playerCell: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingVertical: 2,
    paddingHorizontal: 4,
    position: 'relative',
  },
  playerCellFilled: {
    backgroundColor: Colors.primary + '05',
  },
  playerNumberCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary + '15',
    borderWidth: 2,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  playerRowNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  playerRowName: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  playerChangeIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  positionAbbrev: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  
  // Fila de estadísticas
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  
  // Columna de categoría
  categoryColumn: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  categoryHeader: {
    paddingVertical: 1,
    alignItems: 'center',
  },
  categoryHeaderText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  statButtonsGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statBtn: {
    width: '50%',
    height: '50%',
    borderWidth: 0.5,
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statBtnHalf: {
    width: '50%',
    height: '50%',
    borderWidth: 0.5,
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statBtnFull: {
    width: '100%',
    height: '50%',
    borderWidth: 0.5,
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statBtnFullHeight: {
    width: '100%',
    height: '100%',
    borderWidth: 0.5,
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statBtnEmpty: {
    width: '50%',
    height: '50%',
    backgroundColor: Colors.backgroundLight,
  },
  
  // Placeholder cuando no hay jugador
  emptyStatsPlaceholder: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  emptyStatsText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    flex: 1,
    textAlign: 'center',
  },
  deletePositionButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: 'transparent',
  },
  
  // Mensaje cuando no hay posiciones
  emptyPositionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  emptyPositionsText: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  emptyPositionsSubtext: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
  },
  
  addPositionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.primary + '10',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.04)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    borderStyle: 'dashed',
  },
  addPositionText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: Spacing.sm,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '95%',
    maxWidth: 400,
    height: '75%',
    maxHeight: '85%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.backgroundLight,
  },
  modalFooterButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.lg,
    minHeight: 70,
  },
  modalFooterButtonDelete: {
    backgroundColor: '#ef4444',
  },
  modalFooterButtonChange: {
    backgroundColor: Colors.primary,
  },
  modalFooterButtonText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundLight,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  tabText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  loadingContainer: {
    flex: 1,
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: '#FFFFFF',
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  playerListWrapper: {
    flex: 1,
    minHeight: 200,
    backgroundColor: '#FFFFFF',
  },
  playerListContent: {
    padding: Spacing.md,
    flexGrow: 1,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playerItemNumber: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: Colors.primary + '20',
    borderWidth: 2,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  playerItemNumberText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  playerItemInfo: {
    flex: 1,
  },
  playerItemName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  playerItemPosition: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  
  // Modal añadir posición
  addPositionModalContent: {
    width: '95%',
    maxWidth: 400,
    maxHeight: '90%',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  
  // Estilos CustomAlert para modales
  customAlertHeader: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  customAlertLogoWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  customAlertLogo: {
    width: 28,
    height: 28,
  },
  customAlertAppName: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textOnPrimary,
    letterSpacing: 0.5,
  },
  customAlertScrollView: {
    maxHeight: '100%',
  },
  customAlertContentArea: {
    backgroundColor: '#ffffff',
    padding: Spacing.xl,
    alignItems: 'center',
  },
  customAlertIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  customAlertTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  customAlertSubtitle: {
    fontSize: FontSizes.md,
    color: '#4a4a4a',
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  customAlertCancelButton: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: Spacing.md,
  },
  customAlertCancelButtonText: {
    color: '#424242',
    fontSize: FontSizes.md,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  backgroundAccentTop: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    backgroundColor: '#F3D9E6',
    opacity: 0.14,
    borderRadius: 260,
    transform: [{ scale: 1.1 }],
  },
  
  positionOptionsContainer: {
    width: '100%',
    gap: Spacing.sm,
  },
  positionOption: {
    padding: Spacing.md + 2,
    borderRadius: BorderRadius.md,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  positionOptionText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  
  // Feedback Overlay Styles
  feedbackOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 9999,
  },
  feedbackContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    minWidth: 180,
  },
  feedbackStatName: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: Spacing.md,
    textTransform: 'capitalize',
  },
  feedbackCategoryName: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  setStatsContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Modern Unified Stats Modal Header
  statsModalSafeHeader: {
    backgroundColor: '#1a1a2e',
    paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR_HEIGHT : 0,
  },
  statsModalHeaderModern: {
    backgroundColor: '#1a1a2e',
    paddingBottom: Spacing.md,
  },
  statsModalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  statsModalCloseButtonModern: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsModalTitleContainerModern: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statsModalTitleModern: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statsModalFilterTabs: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  statsFilterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statsFilterTabActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  statsFilterTabText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  statsFilterTabTextActive: {
    color: Colors.primary,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  statsModalPlayerFilterRow: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  statsModalPlayerFilterContent: {
    gap: Spacing.sm,
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  playerChipActive: {
    backgroundColor: '#FFFFFF',
  },
  playerChipText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  playerChipTextActive: {
    color: Colors.primary,
  },
  playerChipNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerChipNumberActive: {
    backgroundColor: Colors.primary + '20',
  },
  playerChipNumberText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  playerChipNumberTextActive: {
    color: Colors.primary,
  },
  setStatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  setStatsTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  // Nuevos estilos modernos para el modal de estadísticas
  statsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statsModalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsModalTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  statsModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statsModalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  statsModalSubtitle: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  viewTypeSection: {
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
  },
  viewTypeScrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  viewTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
    ...Shadows.sm,
  },
  viewTypeCardActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  viewTypeCardText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  viewTypeCardTextActive: {
    color: '#FFFFFF',
  },
  playerFilterSection: {
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  playerFilterLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  playerFilterScrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  playerFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 50,
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginRight: Spacing.xs,
  },
  playerFilterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  playerFilterPillText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  playerFilterPillTextActive: {
    color: '#FFFFFF',
  },
  playerFilterNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerFilterNumberActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  playerFilterNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.text,
  },
  playerFilterNumberTextActive: {
    color: '#FFFFFF',
  },
  // Estilos antiguos que se mantienen
  viewTypeFilters: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  viewTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
  },
  viewTypeChipActive: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary,
  },
  viewTypeChipText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  viewTypeChipTextActive: {
    color: Colors.primary,
  },
  setStatsFilters: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
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
    backgroundColor: Colors.surface,
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
  setStatsContent: {
    flex: 1,
  },
  setStatsEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl * 2,
  },
  setStatsEmptyText: {
    fontSize: FontSizes.lg,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  setStatsSummary: {
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  summaryGPContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  summaryGPCard: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  summaryGPLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  summaryGPValue: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
  },
  gpValuePositive: {
    color: '#22c55e',
  },
  gpValueNegative: {
    color: '#ef4444',
  },
  setStatsCategories: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  setStatsCategoriesTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  setStatsCategoryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  setStatsCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  setStatsCategoryName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  setStatsCategoryTotal: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.primary,
  },
  setStatsCategoryList: {
    gap: Spacing.xs,
  },
  setStatsStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  setStatsStatTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  setStatsStatType: {
    fontSize: FontSizes.sm,
    color: Colors.text,
  },
  setStatsStatCount: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  setStatsFooter: {
    padding: Spacing.lg,
    paddingBottom: Platform.OS === 'android' ? Spacing.lg + ANDROID_NAV_BAR_HEIGHT : Spacing.lg,
    backgroundColor: '#1a1a2e',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  continueButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Category pie chart styles
  categoryPieChartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  categoryPieSvgWrapper: {
    width: 100,
    height: 100,
  },
  categoryPieLegend: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  categoryPieLegendHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    alignItems: 'center',
  },
  categoryPieLegendHeaderText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  categoryPieLegendHeaderRight: {
    width: 45,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  categoryPieLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '40',
  },
  categoryPieLegendTypeCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
  },
  categoryPieLegendTypeName: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  categoryPieLegendCount: {
    width: 45,
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'right',
  },
  categoryPieLegendPercent: {
    width: 45,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.success,
    textAlign: 'right',
  },
  // Estilos para el modal de fin de partido
  endMatchModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  endMatchModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  endMatchHeader: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  endMatchLogoWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  endMatchLogo: {
    width: 28,
    height: 28,
  },
  endMatchAppName: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textOnPrimary,
    letterSpacing: 0.5,
  },
  endMatchContentArea: {
    backgroundColor: '#ffffff',
    padding: Spacing.xl,
    alignItems: 'center',
  },
  endMatchIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  endMatchModalTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  endMatchModalSubtitle: {
    fontSize: FontSizes.md,
    color: '#4a4a4a',
    marginBottom: Spacing.lg,
    textAlign: 'center',
    lineHeight: 22,
  },
  scoreInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
    width: '100%',
  },
  scoreInputWrapper: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
    height: 130,
    justifyContent: 'flex-start',
  },
  scoreLabelContainer: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  scoreLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: '#4a4a4a',
    width: '100%',
    textAlign: 'center',
  },
  scoreInput: {
    width: 70,
    height: 70,
    backgroundColor: '#ffffff',
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    fontSize: 32,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  scoreSeparator: {
    fontSize: 32,
    fontWeight: '700',
    color: '#9e9e9e',
    alignSelf: 'center',
    width: 28,
    textAlign: 'center',
  },
  endMatchButtonsContainer: {
    width: '100%',
    gap: Spacing.sm,
  },
  endMatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
  },
  endMatchButtonPrimary: {
    backgroundColor: Colors.primary,
    ...Shadows.md,
  },
  endMatchButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  endMatchButtonCancel: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  endMatchButtonTextPrimary: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  endMatchButtonTextSecondary: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#424242',
  },
  endMatchButtonTextCancel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#424242',
  },
});
