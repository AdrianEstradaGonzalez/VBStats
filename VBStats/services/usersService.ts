/**
 * Users Service - API calls for user management
 */

import { API_BASE_URL } from './api';
import { User, LoginCredentials, RegisterData } from './types';

const USERS_URL = `${API_BASE_URL}/users`;
const REQUEST_TIMEOUT_MS = 15000;

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

export const usersService = {
  // Login user
  login: async (credentials: LoginCredentials): Promise<User> => {
    const response = await fetchWithTimeout(`${USERS_URL}/login`, {
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

  // Step 1 of verified registration: request an email verification code.
  // The account is NOT created until the code is verified.
  requestRegisterCode: async (data: RegisterData): Promise<{ message: string }> => {
    const response = await fetch(`${USERS_URL}/register/request-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al enviar el código de verificación');
    }

    return response.json();
  },

  // Step 2 of verified registration: verify the code and create the account.
  verifyRegisterCode: async (email: string, code: string): Promise<User> => {
    const response = await fetch(`${USERS_URL}/register/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Código inválido o expirado');
    }

    return response.json();
  },

  // Sign in / sign up with a Google idToken
  googleSignIn: async (idToken: string): Promise<User> => {
    const response = await fetch(`${USERS_URL}/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al iniciar sesión con Google');
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

  // Delete user account (requires password confirmation)
  delete: async (id: number, password: string): Promise<void> => {
    const response = await fetch(`${USERS_URL}/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete user');
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
    const response = await fetchWithTimeout(`${USERS_URL}/${id}/session`);
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
