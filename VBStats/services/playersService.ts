/**
 * Players Service
 */

import { API_ENDPOINTS } from './config';
import { Player } from './types';

export const playersService = {
  getAll: async (): Promise<Player[]> => {
    const response = await fetch(API_ENDPOINTS.players);
    if (!response.ok) throw new Error('Failed to fetch players');
    return response.json();
  },

  getById: async (id: number): Promise<Player> => {
    const response = await fetch(`${API_ENDPOINTS.players}/${id}`);
    if (!response.ok) throw new Error('Failed to fetch player');
    return response.json();
  },

  getByTeam: async (teamId: number): Promise<Player[]> => {
    const allPlayers = await playersService.getAll();
    return allPlayers.filter(p => p.team_id === teamId);
  },

  create: async (data: { name: string; team_id: number; position: string; number?: number }): Promise<Player> => {
    try {
      console.log('Creating player:', data);
      const response = await fetch(API_ENDPOINTS.players, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Create player error response:', errorText);
        throw new Error(`Failed to create player: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Player created successfully:', result);
      return result;
    } catch (error) {
      console.error('Error in playersService.create:', error);
      throw error;
    }
  },

  update: async (id: number, data: { name: string; team_id: number; position: string; number?: number }): Promise<Player> => {
    const response = await fetch(`${API_ENDPOINTS.players}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update player');
    return response.json();
  },

  delete: async (id: number): Promise<void> => {
    const response = await fetch(`${API_ENDPOINTS.players}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete player');
  },
};
