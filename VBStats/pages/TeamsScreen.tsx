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
import { CustomAlert } from '../components';
import { teamsService, playersService, Team, Player } from '../services/api';

// Safe area paddings para Android
const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;
const ANDROID_NAV_BAR_HEIGHT = 48;

interface TeamsScreenProps {
  onBack?: () => void;
  onOpenMenu?: () => void;
  teams: Team[];
  onTeamsChange: (teams: Team[]) => void;
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

export default function TeamsScreen({ onBack, onOpenMenu, teams, onTeamsChange }: TeamsScreenProps) {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [showEditPlayerModal, setShowEditPlayerModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
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
    try {
      const [fetchedTeams, allPlayers] = await Promise.all([
        teamsService.getAll(),
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
    if (newTeamName.trim()) {
      setLoading(true);
      try {
        const newTeam = await teamsService.create(newTeamName.trim());
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
    if (!teamToDelete) return;
    
    try {
      await teamsService.delete(teamToDelete.id);
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
            onPress={() => setShowTeamModal(true)}
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Equipo</Text>
              <TouchableOpacity onPress={() => setShowTeamModal(false)}>
                <CloseIcon size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.inputLabel}>Nombre del equipo</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Club Deportivo VB"
              placeholderTextColor={Colors.textTertiary}
              value={newTeamName}
              onChangeText={setNewTeamName}
            />
            
            <TouchableOpacity
              style={[styles.modalButton, (!newTeamName.trim() || loading) && styles.modalButtonDisabled]}
              onPress={handleAddTeam}
              disabled={!newTeamName.trim() || loading}
            >
              <Text style={styles.modalButtonText}>
                {loading ? 'Creando...' : 'Crear Equipo'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal para añadir jugador */}
      <Modal visible={showPlayerModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Jugador</Text>
              <TouchableOpacity onPress={() => setShowPlayerModal(false)}>
                <CloseIcon size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.inputLabel}>Nombre</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre del jugador"
              placeholderTextColor={Colors.textTertiary}
              value={newPlayer.name}
              onChangeText={(text) => {
                try {
                  setNewPlayer(prev => ({ ...prev, name: text }));
                } catch (error) {
                  console.error('Error updating player name:', error);
                }
              }}
              autoCapitalize="words"
            />
            
            <Text style={styles.inputLabel}>Dorsal</Text>
            <TextInput
              style={styles.input}
              placeholder="Número"
              placeholderTextColor={Colors.textTertiary}
              value={newPlayer.number}
              onChangeText={(text) => {
                try {
                  const numericValue = text.replace(/[^0-9]/g, '');
                  setNewPlayer(prev => ({ ...prev, number: numericValue }));
                } catch (error) {
                  console.error('Error updating player number:', error);
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
                    newPlayer.position === pos && styles.positionOptionSelected,
                  ]}
                  onPress={() => {
                    try {
                      setNewPlayer(prev => ({ ...prev, position: pos }));
                    } catch (error) {
                      console.error('Error updating position:', error);
                    }
                  }}
                >
                  <Text style={[
                    styles.positionOptionText,
                    newPlayer.position === pos && styles.positionOptionTextSelected,
                  ]}>
                    {pos}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity
              style={[
                styles.modalButton,
                !newPlayer.name.trim() && styles.modalButtonDisabled,
              ]}
              onPress={handleAddPlayer}
              disabled={!newPlayer.name.trim() || loading}
            >
              <Text style={styles.modalButtonText}>
                {loading ? 'Guardando...' : 'Añadir Jugador'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
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
