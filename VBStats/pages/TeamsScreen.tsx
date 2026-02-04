/**
 * Pantalla de Mis Equipos
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  SafeAreaView,
  Alert,
  Platform,
  StatusBar,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';
import { 
  AddIcon, 
  ChevronRightIcon, 
  TeamIcon, 
  CloseIcon,
  EditIcon,
  DeleteIcon,
  MenuIcon,
  VolleyballIcon,
} from '../components/VectorIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { CustomAlert } from '../components';
import { teamsService, playersService, Team, Player } from '../services/api';
import { SubscriptionType, subscriptionService, BASIC_MAX_TEAMS } from '../services/subscriptionService';

// Safe area paddings para Android
const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;
const ANDROID_NAV_BAR_HEIGHT = 48;

interface TeamsScreenProps {
  onBack?: () => void;
  onOpenMenu?: () => void;
  teams: Team[];
  onTeamsChange: (teams: Team[]) => void;
  userId: number | null;
  subscriptionType?: SubscriptionType;
  onUpgradeToPro?: () => void;
}

const POSITIONS = ['Receptor', 'Central', 'Opuesto', 'Colocador', 'Líbero'] as const;

const POSITION_ORDER: Record<string, number> = {
  'Receptor': 1,
  'Colocador': 2,
  'Central': 3,
  'Opuesto': 4,
  'Líbero': 5,
};

const sortPlayers = (players: Player[]): Player[] => {
  return [...players].sort((a, b) => {
    const posOrderA = POSITION_ORDER[a.position] || 999;
    const posOrderB = POSITION_ORDER[b.position] || 999;
    
    if (posOrderA !== posOrderB) {
      return posOrderA - posOrderB;
    }
    
    // Same position, sort by number
    const numA = a.number || 999;
    const numB = b.number || 999;
    return numA - numB;
  });
};

export default function TeamsScreen({ onBack, onOpenMenu, teams, onTeamsChange, userId, subscriptionType = 'pro', onUpgradeToPro }: TeamsScreenProps) {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [showEditPlayerModal, setShowEditPlayerModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showTeamLimitAlert, setShowTeamLimitAlert] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newPlayer, setNewPlayer] = useState<{
    name: string;
    number: string;
    position: string;
  }>({
    name: '',
    number: '',
    position: 'Receptor',
  });
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(false);

  // Load players when a team is selected
  useEffect(() => {
    if (selectedTeam) {
      loadTeamPlayers(selectedTeam.id);
    }
  }, [selectedTeam?.id]);

  const loadTeamPlayers = async (teamId: number) => {
    try {
      const teamPlayers = await playersService.getByTeam(teamId);
      setSelectedTeam(prev => prev ? { ...prev, players: teamPlayers } : null);
    } catch (error) {
      console.error('Error loading players:', error);
    }
  };

  const reloadTeamsWithCounts = async () => {
    if (userId == null) {
      // No userId available — skip reloading teams
      return;
    }
    try {
      const [fetchedTeams, allPlayers] = await Promise.all([
        teamsService.getAll(userId),
        playersService.getAll()
      ]);
      const teamsWithCounts = fetchedTeams.map(team => ({
        ...team,
        playerCount: allPlayers.filter(p => p.team_id === team.id).length
      }));
      onTeamsChange(teamsWithCounts);
    } catch (error) {
      console.error('Error reloading teams:', error);
      // Don't throw, just log - we don't want to crash the app
    }
  };

  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setShowEditPlayerModal(true);
  };

  const handleUpdatePlayer = async () => {
    if (editingPlayer && selectedTeam) {
      setLoading(true);
      try {
        await playersService.update(editingPlayer.id, {
          name: editingPlayer.name,
          team_id: editingPlayer.team_id,
          position: editingPlayer.position,
          number: editingPlayer.number,
        });
        await loadTeamPlayers(selectedTeam.id);
        await reloadTeamsWithCounts();
        setShowEditPlayerModal(false);
        setEditingPlayer(null);
      } catch (error) {
        console.error('Error updating player:', error);
        Alert.alert('Error', 'No se pudo actualizar el jugador');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddTeam = async () => {
    if (newTeamName.trim() && userId) {
      setLoading(true);
      try {
        const newTeam = await teamsService.create(newTeamName.trim(), userId);
        onTeamsChange([...teams, newTeam]);
        setNewTeamName('');
        setShowTeamModal(false);
      } catch (error) {
        console.error('Error creating team:', error);
        Alert.alert('Error', 'No se pudo crear el equipo');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddPlayer = async () => {
    if (selectedTeam && newPlayer.name.trim()) {
      setLoading(true);
      try {
        await playersService.create({
          name: newPlayer.name.trim(),
          team_id: selectedTeam.id,
          position: newPlayer.position,
          number: newPlayer.number ? parseInt(newPlayer.number, 10) : undefined,
        });
        
        await loadTeamPlayers(selectedTeam.id);
        await reloadTeamsWithCounts();
        setNewPlayer({ name: '', number: '', position: 'Receptor' });
        setShowPlayerModal(false);
      } catch (error) {
        console.error('Error adding player:', error);
        Alert.alert('Error', 'No se pudo añadir el jugador. Por favor, verifica la conexión con el servidor.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteTeam = (team: Team) => {
    setTeamToDelete(team);
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteTeam = async () => {
    if (!teamToDelete || !userId) return;
    
    try {
      await teamsService.delete(teamToDelete.id, userId);
      onTeamsChange(teams.filter(t => t.id !== teamToDelete.id));
      if (selectedTeam?.id === teamToDelete.id) {
        setSelectedTeam(null);
      }
      setShowDeleteConfirmModal(false);
      setTeamToDelete(null);
    } catch (error) {
      console.error('Error deleting team:', error);
      Alert.alert('Error', 'No se pudo eliminar el equipo');
    }
  };

  const handleDeletePlayer = async (playerId: number) => {
    if (selectedTeam) {
      try {
        await playersService.delete(playerId);
        await loadTeamPlayers(selectedTeam.id);
        await reloadTeamsWithCounts();
      } catch (error) {
        console.error('Error deleting player:', error);
        Alert.alert('Error', 'No se pudo eliminar el jugador');
      }
    }
  };

  const getPositionColor = (position: Player['position']) => {
    const colors: Record<string, string> = {
      'Receptor': '#3b82f6',
      'Central': '#10b981',
      'Opuesto': '#f59e0b',
      'Colocador': '#a855f7',
      'Líbero': '#ef4444',
    };
    return colors[position] || '#6b7280';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={onOpenMenu}>
          <MenuIcon size={28} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <TeamIcon size={24} color={Colors.primary} />
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            {selectedTeam ? selectedTeam.name : 'Mis Equipos'}
          </Text>
        </View>
        {selectedTeam ? (
          <TouchableOpacity style={styles.backButton} onPress={() => setSelectedTeam(null)}>
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      {!selectedTeam ? (
        // Lista de equipos
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {teams.length === 0 ? (
            <View style={styles.emptyState}>
              <TeamIcon size={80} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>Sin equipos</Text>
              <Text style={styles.emptyText}>
                Crea tu primer equipo para comenzar
              </Text>
            </View>
          ) : (
            teams.map((team) => (
              <TouchableOpacity
                key={team.id}
                style={styles.teamCard}
                onPress={() => setSelectedTeam(team)}
                activeOpacity={0.7}
              >
                <View style={styles.teamIconContainer}>
                  <TeamIcon size={32} color={Colors.primary} />
                </View>
                <View style={styles.teamInfo}>
                  <Text style={styles.teamName}>{team.name}</Text>
                  <Text style={styles.teamPlayers}>
                    {team.playerCount || 0} jugador{(team.playerCount || 0) !== 1 ? 'es' : ''}
                  </Text>
                </View>
                <View style={styles.teamActions}>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteTeam(team)}
                  >
                    <DeleteIcon size={20} color={Colors.error} />
                  </TouchableOpacity>
                  <ChevronRightIcon size={24} color={Colors.textTertiary} />
                </View>
              </TouchableOpacity>
            ))
          )}

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              // Check team limit for basic subscription
              if (!subscriptionService.canCreateTeam(subscriptionType, teams.length)) {
                setShowTeamLimitAlert(true);
                return;
              }
              setShowTeamModal(true);
            }}
            activeOpacity={0.7}
          >
            <AddIcon size={24} color={Colors.textOnPrimary} />
            <Text style={styles.addButtonText}>Añadir Equipo</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        // Detalle del equipo con jugadores
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {(selectedTeam.players || []).length === 0 ? (
            <View style={styles.emptyState}>
              <VolleyballIcon size={80} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>Sin jugadores</Text>
              <Text style={styles.emptyText}>
                Añade jugadores a tu equipo
              </Text>
            </View>
          ) : (
            sortPlayers(selectedTeam.players || []).map((player) => (
              <View key={player.id} style={styles.playerCard}>
                <View style={[styles.playerNumber, { backgroundColor: getPositionColor(player.position) }]}>
                  <Text style={styles.playerNumberText}>{player.number || '?'}</Text>
                </View>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{player.name}</Text>
                  <View style={[styles.positionBadge, { backgroundColor: getPositionColor(player.position) + '20' }]}>
                    <Text style={[styles.positionText, { color: getPositionColor(player.position) }]}>
                      {player.position}
                    </Text>
                  </View>
                </View>
                <View style={styles.playerActions}>
                  <TouchableOpacity
                    style={styles.editPlayerButton}
                    onPress={() => handleEditPlayer(player)}
                  >
                    <EditIcon size={18} color="#1976d2" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deletePlayerButton}
                    onPress={() => handleDeletePlayer(player.id)}
                  >
                    <DeleteIcon size={18} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowPlayerModal(true)}
            activeOpacity={0.7}
          >
            <AddIcon size={24} color={Colors.textOnPrimary} />
            <Text style={styles.addButtonText}>Añadir Jugador</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Modal para añadir equipo */}
      <Modal visible={showTeamModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.teamModalContent}>
            {/* Modern Header with Logo and App Name */}
            <View style={styles.teamModalHeader}>
              <View style={styles.logoWrapper}>
                <Image
                  source={require('../assets/VBStats_logo_sinfondo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.appName}>VBStats</Text>
            </View>

            {/* Content Area - White Background */}
            <View style={styles.teamModalContentArea}>
              <View style={styles.teamModalIconContainer}>
                <TeamIcon size={32} color={Colors.primary} />
              </View>

              <Text style={styles.teamModalTitle}>Crear Nuevo Equipo</Text>
              <Text style={styles.teamModalSubtitle}>Ingresa el nombre de tu equipo</Text>

              <TextInput
                style={styles.teamInput}
                placeholder="Ej: Club Deportivo VB"
                placeholderTextColor={Colors.textTertiary}
                value={newTeamName}
                onChangeText={setNewTeamName}
                autoFocus
              />

              <View style={styles.teamModalButtons}>
                <TouchableOpacity
                  style={styles.teamCancelButton}
                  onPress={() => {
                    setShowTeamModal(false);
                    setNewTeamName('');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.teamCancelButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.teamCreateButton,
                    (!newTeamName.trim() || loading) && styles.teamCreateButtonDisabled,
                  ]}
                  onPress={handleAddTeam}
                  disabled={!newTeamName.trim() || loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.teamCreateButtonText}>
                    {loading ? 'Creando...' : 'Crear Equipo'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para añadir jugador */}
      <Modal visible={showPlayerModal} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.addPlayerModalContent}>
            {/* Header compacto */}
            <View style={styles.addPlayerModalHeader}>
              <View style={styles.addPlayerIconWrapper}>
                <VolleyballIcon size={24} color={Colors.primary} />
              </View>
              <Text style={styles.addPlayerModalTitle}>Añadir Jugador</Text>
              <TouchableOpacity 
                style={styles.addPlayerCloseButton}
                onPress={() => {
                  setShowPlayerModal(false);
                  setNewPlayer({ name: '', number: '', position: 'Receptor' });
                }}
              >
                <CloseIcon size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Formulario */}
            <ScrollView 
              style={styles.addPlayerFormScroll}
              contentContainerStyle={styles.addPlayerFormContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.addPlayerLabel}>Nombre del jugador *</Text>
              <TextInput
                style={styles.addPlayerInput}
                placeholder="Ej: Juan García"
                placeholderTextColor={Colors.textTertiary}
                value={newPlayer.name}
                onChangeText={(text) => setNewPlayer(prev => ({ ...prev, name: text }))}
                autoCapitalize="words"
                autoFocus
              />

              <Text style={styles.addPlayerLabel}>Número de dorsal</Text>
              <TextInput
                style={styles.addPlayerInput}
                placeholder="Ej: 7"
                placeholderTextColor={Colors.textTertiary}
                value={newPlayer.number}
                onChangeText={(text) => {
                  const numericValue = text.replace(/[^0-9]/g, '');
                  setNewPlayer(prev => ({ ...prev, number: numericValue }));
                }}
                keyboardType="numeric"
                maxLength={2}
              />

              <Text style={styles.addPlayerLabel}>Posición *</Text>
              <View style={styles.addPlayerPositionsGrid}>
                {POSITIONS.map((pos) => (
                  <TouchableOpacity
                    key={pos}
                    style={[
                      styles.addPlayerPositionChip,
                      newPlayer.position === pos && styles.addPlayerPositionChipSelected,
                    ]}
                    onPress={() => setNewPlayer(prev => ({ ...prev, position: pos }))}
                  >
                    <Text style={[
                      styles.addPlayerPositionText,
                      newPlayer.position === pos && styles.addPlayerPositionTextSelected,
                    ]}>
                      {pos}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Botones */}
            <View style={styles.addPlayerButtonsContainer}>
              <TouchableOpacity
                style={styles.addPlayerCancelBtn}
                onPress={() => {
                  setShowPlayerModal(false);
                  setNewPlayer({ name: '', number: '', position: 'Receptor' });
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.addPlayerCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.addPlayerSubmitBtn,
                  (!newPlayer.name.trim() || loading) && styles.addPlayerSubmitBtnDisabled,
                ]}
                onPress={handleAddPlayer}
                disabled={!newPlayer.name.trim() || loading}
                activeOpacity={0.7}
              >
                <Text style={styles.addPlayerSubmitBtnText}>
                  {loading ? 'Guardando...' : 'Añadir'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal para editar jugador */}
      <Modal visible={showEditPlayerModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Jugador</Text>
              <TouchableOpacity onPress={() => { setShowEditPlayerModal(false); setEditingPlayer(null); }}>
                <CloseIcon size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            {editingPlayer && (
              <>
                <Text style={styles.inputLabel}>Nombre</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nombre del jugador"
                  placeholderTextColor={Colors.textTertiary}
                  value={editingPlayer.name}
                  onChangeText={(text) => {
                    try {
                      setEditingPlayer(prev => prev ? { ...prev, name: text } : null);
                    } catch (error) {
                      console.error('Error updating edit player name:', error);
                    }
                  }}
                  autoCapitalize="words"
                />
                
                <Text style={styles.inputLabel}>Dorsal</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Número"
                  placeholderTextColor={Colors.textTertiary}
                  value={editingPlayer.number?.toString() || ''}
                  onChangeText={(text) => {
                    try {
                      const numericValue = text ? parseInt(text.replace(/[^0-9]/g, ''), 10) : undefined;
                      setEditingPlayer(prev => prev ? { ...prev, number: numericValue } : null);
                    } catch (error) {
                      console.error('Error updating edit player number:', error);
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={2}
                />
                
                <Text style={styles.inputLabel}>Posición</Text>
                <View style={styles.positionsGrid}>
                  {POSITIONS.map((pos) => (
                    <TouchableOpacity
                      key={pos}
                      style={[
                        styles.positionOption,
                        editingPlayer.position === pos && styles.positionOptionSelected,
                      ]}
                      onPress={() => {
                        try {
                          setEditingPlayer(prev => prev ? { ...prev, position: pos } : null);
                        } catch (error) {
                          console.error('Error updating edit position:', error);
                        }
                      }}
                    >
                      <Text style={[
                        styles.positionOptionText,
                        editingPlayer.position === pos && styles.positionOptionTextSelected,
                      ]}>
                        {pos}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    !editingPlayer.name.trim() && styles.modalButtonDisabled,
                  ]}
                  onPress={handleUpdatePlayer}
                  disabled={!editingPlayer.name.trim() || loading}
                >
                  <Text style={styles.modalButtonText}>
                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de confirmación para eliminar equipo */}
      <CustomAlert
        visible={showDeleteConfirmModal}
        icon={<DeleteIcon size={48} color={Colors.error} />}
        iconBackgroundColor={Colors.error + '15'}
        title="¿Eliminar equipo?"
        message={`¿Estás seguro de que deseas eliminar el equipo "${teamToDelete?.name}"?`}
        warning="Esta acción no se puede deshacer y se eliminarán todos los jugadores asociados."
        buttons={[
          {
            text: 'Cancelar',
            onPress: () => {
              setShowDeleteConfirmModal(false);
              setTeamToDelete(null);
            },
            style: 'cancel',
          },
          {
            text: 'Eliminar',
            onPress: confirmDeleteTeam,
            style: 'destructive',
          },
        ]}
      />

      {/* Modal de límite de equipos para cuenta básica */}
      <CustomAlert
        visible={showTeamLimitAlert}
        icon={<MaterialCommunityIcons name="crown" size={48} color="#f59e0b" />}
        iconBackgroundColor="#f59e0b15"
        title="Límite de equipos alcanzado"
        message={`Con la cuenta Básico puedes crear hasta ${BASIC_MAX_TEAMS} equipos. Actualmente tienes ${teams.length} equipos.`}
        warning="Mejora a VBStats Pro para crear equipos ilimitados."
        buttonLayout="column"
        buttons={[
          {
            text: 'Obtener VBStats Pro',
            icon: <MaterialCommunityIcons name="crown" size={18} color="#fff" />,
            onPress: () => {
              setShowTeamLimitAlert(false);
              onUpgradeToPro?.();
            },
            style: 'primary',
          },
          {
            text: 'Cancelar',
            onPress: () => setShowTeamLimitAlert(false),
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
    marginHorizontal: Spacing.sm,
  },
  headerTitle: {
    flex: 1,
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
    minWidth: 60,
  },
  backButtonText: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: '600',
  },
  scrollContent: {
    padding: Spacing.lg,
    flexGrow: 1,
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
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  teamIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  teamPlayers: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  teamActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    padding: Spacing.sm,
    marginRight: Spacing.sm,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    ...Shadows.md,
  },
  addButtonText: {
    color: Colors.textOnPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    marginLeft: Spacing.sm,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playerNumber: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  playerNumberText: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: Colors.textOnPrimary,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  positionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  positionText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
  },
  playerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  editPlayerButton: {
    padding: Spacing.sm,
    backgroundColor: 'transparent',
    borderRadius: 999,
  },
  deletePlayerButton: {
    padding: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  // Estilos del modal de crear equipo (estilo CustomAlert)
  teamModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  teamModalHeader: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  logoWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  logo: {
    width: 28,
    height: 28,
  },
  appName: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textOnPrimary,
    letterSpacing: 0.5,
  },
  teamModalContentArea: {
    backgroundColor: '#ffffff',
    padding: Spacing.xl,
    alignItems: 'center',
  },
  teamModalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  teamModalTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  teamModalSubtitle: {
    fontSize: FontSizes.md,
    color: '#4a4a4a',
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  teamInput: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: BorderRadius.md,
    padding: Spacing.md + 4,
    fontSize: FontSizes.md,
    color: '#1a1a1a',
    marginBottom: Spacing.lg,
    fontWeight: '500',
  },
  teamModalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: Spacing.md,
  },
  teamCancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 48,
  },
  teamCancelButtonText: {
    color: '#424242',
    fontSize: FontSizes.md,
    fontWeight: '600',
    textAlign: 'center',
  },
  teamCreateButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    ...Shadows.md,
  },
  teamCreateButtonDisabled: {
    backgroundColor: Colors.border,
    opacity: 0.6,
  },
  teamCreateButtonText: {
    color: Colors.textOnPrimary,
    fontSize: FontSizes.md,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Estilos del modal de añadir jugador - Diseño limpio y funcional
  addPlayerModalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    maxHeight: '80%',
    ...Shadows.lg,
  },
  addPlayerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundLight,
  },
  addPlayerIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  addPlayerModalTitle: {
    flex: 1,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  addPlayerCloseButton: {
    padding: Spacing.xs,
  },
  addPlayerFormScroll: {
    maxHeight: 320,
  },
  addPlayerFormContent: {
    padding: Spacing.lg,
  },
  addPlayerLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  addPlayerInput: {
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  addPlayerPositionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  addPlayerPositionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundLight,
  },
  addPlayerPositionChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  addPlayerPositionText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  addPlayerPositionTextSelected: {
    color: Colors.textOnPrimary,
    fontWeight: '600',
  },
  addPlayerButtonsContainer: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.backgroundLight,
  },
  addPlayerCancelBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addPlayerCancelBtnText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  addPlayerSubmitBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  addPlayerSubmitBtnDisabled: {
    backgroundColor: Colors.border,
    opacity: 0.6,
  },
  addPlayerSubmitBtnText: {
    color: Colors.textOnPrimary,
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  // Estilos del modal de editar jugador (se mantienen como estaban)
  modalContent: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  inputLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  positionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.lg,
  },
  positionOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  positionOptionSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  positionOptionText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  positionOptionTextSelected: {
    color: Colors.textOnPrimary,
    fontWeight: '600',
  },
  modalButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadows.md,
  },
  modalButtonDisabled: {
    backgroundColor: Colors.border,
    opacity: 0.6,
  },
  modalButtonText: {
    color: Colors.textOnPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
});
