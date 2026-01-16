/**
 * Users Service - API calls for user management
 */

import { API_BASE_URL } from './api';
import { User, LoginCredentials, RegisterData } from './types';

const USERS_URL = `${API_BASE_URL}/users`;

export const usersService = {
  // Login user
  login: async (credentials: LoginCredentials): Promise<User> => {
    const response = await fetch(`${USERS_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }
    
    return response.json();
  },

  // Register new user
  register: async (data: RegisterData): Promise<User> => {
    const response = await fetch(`${USERS_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }
    
    return response.json();
  },

  // Get user by ID
  getById: async (id: number): Promise<User> => {
    const response = await fetch(`${USERS_URL}/${id}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch user');
    }
    
    return response.json();
  },

  // Update user
  update: async (id: number, data: Partial<User & { password?: string }>): Promise<User> => {
    const response = await fetch(`${USERS_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update user');
    }
    
    return response.json();
  },

  // Delete user
  delete: async (id: number): Promise<void> => {
    const response = await fetch(`${USERS_URL}/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete user');
    }
  },
};
