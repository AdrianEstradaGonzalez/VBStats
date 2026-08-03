/**
 * Users Service - API calls for user management
 *
 * Authenticated calls go through `apiFetch`, which attaches the session token.
 * Only the pre-login endpoints (login, register, password recovery) skip auth.
 */

import { API_BASE_URL } from './api';
import { User, LoginCredentials, RegisterData } from './types';
import { apiFetch, apiFetchJson, setSessionToken } from './http';

const USERS_URL = `${API_BASE_URL}/users`;

/** Store the token returned by any endpoint that starts a session. */
const adoptSession = async (user: User): Promise<User> => {
  if (user && user.session_token) {
    await setSessionToken(user.session_token);
  }
  return user;
};

export const usersService = {
  // Login user
  login: async (credentials: LoginCredentials): Promise<User> => {
    const response = await apiFetchJson(`${USERS_URL}/login`, 'POST', credentials, { skipAuth: true });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    return adoptSession(await response.json());
  },

  // Register new user
  register: async (data: RegisterData): Promise<User> => {
    const response = await apiFetchJson(`${USERS_URL}/register`, 'POST', data, { skipAuth: true });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }

    return adoptSession(await response.json());
  },

  // Step 1 of verified registration: request an email verification code.
  // The account is NOT created until the code is verified.
  requestRegisterCode: async (data: RegisterData): Promise<{ message: string }> => {
    const response = await apiFetchJson(`${USERS_URL}/register/request-code`, 'POST', data, { skipAuth: true });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al enviar el código de verificación');
    }

    return response.json();
  },

  // Step 2 of verified registration: verify the code and create the account.
  verifyRegisterCode: async (email: string, code: string): Promise<User> => {
    const response = await apiFetchJson(`${USERS_URL}/register/verify-code`, 'POST', { email, code }, { skipAuth: true });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Código inválido o expirado');
    }

    return adoptSession(await response.json());
  },

  // Sign in / sign up with a Google idToken
  googleSignIn: async (idToken: string): Promise<User> => {
    const response = await apiFetchJson(`${USERS_URL}/google`, 'POST', { idToken }, { skipAuth: true });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al iniciar sesión con Google');
    }

    return adoptSession(await response.json());
  },

  // Get user by ID
  getById: async (id: number): Promise<User> => {
    const response = await apiFetch(`${USERS_URL}/${id}`);

    if (!response.ok) {
      throw new Error('Failed to fetch user');
    }

    return response.json();
  },

  // Update user profile (name / email).
  // Changing the password goes through `changePassword`, which verifies the current one.
  update: async (id: number, data: Partial<User>): Promise<User> => {
    const response = await apiFetchJson(`${USERS_URL}/${id}`, 'PUT', data);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to update user');
    }

    return response.json();
  },

  // Delete user account (requires password confirmation)
  delete: async (id: number, password: string): Promise<void> => {
    const response = await apiFetchJson(`${USERS_URL}/${id}`, 'DELETE', { password });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete user');
    }
  },

  // Change password
  changePassword: async (id: number, currentPassword: string, newPassword: string): Promise<void> => {
    const response = await apiFetchJson(`${USERS_URL}/${id}/change-password`, 'POST', {
      currentPassword,
      newPassword,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to change password');
    }
  },

  /**
   * Checks whether this device still holds the active session.
   * The server never returns another account's token: on success it echoes back the
   * caller's own token, so the existing "signed in elsewhere" comparison still works.
   */
  getSession: async (id: number): Promise<{ session_token: string | null }> => {
    const response = await apiFetch(`${USERS_URL}/${id}/session`);
    if (!response.ok) {
      throw new Error('Failed to fetch session');
    }
    return response.json();
  },

  // Logout (clear session token)
  logout: async (id: number): Promise<void> => {
    const response = await apiFetch(`${USERS_URL}/${id}/logout`, { method: 'POST' });
    await setSessionToken(null);
    if (!response.ok) {
      throw new Error('Failed to logout');
    }
  },

  // Request password reset - sends email with reset code
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await apiFetchJson(`${USERS_URL}/forgot-password`, 'POST', { email }, { skipAuth: true });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al enviar el correo de recuperación');
    }

    return response.json();
  },

  /**
   * Verifies the recovery code typed by the user.
   * The server no longer returns the full reset token — the code itself is what the
   * next step consumes, so a valid-looking prefix can't be exchanged for someone
   * else's token.
   */
  verifyResetToken: async (email: string, code: string): Promise<{ valid: boolean; email?: string }> => {
    const response = await apiFetchJson(`${USERS_URL}/verify-reset-token`, 'POST', { email, code }, { skipAuth: true });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Código inválido o expirado');
    }

    return response.json();
  },

  // Reset password with the recovery code
  resetPassword: async (email: string, code: string, newPassword: string): Promise<{ message: string }> => {
    const response = await apiFetchJson(`${USERS_URL}/reset-password`, 'POST', { email, code, newPassword }, { skipAuth: true });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al restablecer la contraseña');
    }

    return response.json();
  },
};
