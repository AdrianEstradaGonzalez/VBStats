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

  // Change password
  changePassword: async (id: number, currentPassword: string, newPassword: string): Promise<void> => {
    const response = await fetch(`${USERS_URL}/${id}/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to change password');
    }
  },

  // Get current session token
  getSession: async (id: number): Promise<{ session_token: string | null }> => {
    const response = await fetch(`${USERS_URL}/${id}/session`);
    if (!response.ok) {
      throw new Error('Failed to fetch session');
    }
    return response.json();
  },

  // Logout (clear session token)
  logout: async (id: number): Promise<void> => {
    const response = await fetch(`${USERS_URL}/${id}/logout`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to logout');
    }
  },

  // Request password reset - sends email with reset code
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await fetch(`${USERS_URL}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al enviar el correo de recuperación');
    }
    
    return response.json();
  },

  // Verify reset token
  verifyResetToken: async (token: string): Promise<{ valid: boolean; email?: string; fullToken?: string }> => {
    const response = await fetch(`${USERS_URL}/verify-reset-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Código inválido o expirado');
    }
    
    return response.json();
  },

  // Reset password with token
  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    const response = await fetch(`${USERS_URL}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al restablecer la contraseña');
    }
    
    return response.json();
  },
};
