/**
 * Admin Service - API calls for superadmin features
 *
 * Identity comes from the session token attached by `apiFetch`; user ids are no
 * longer sent in headers or query strings.
 */

import { API_BASE_URL } from './api';
import { apiFetch, apiFetchJson } from './http';

const ADMIN_URL = `${API_BASE_URL}/admin`;

export type NotificationAudience = 'all' | 'free' | 'basic' | 'pro' | 'paid';

export interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  subscription_type: 'free' | 'basic' | 'pro';
  subscription_expires_at: string | null;
  auto_renew: boolean;
  created_at: string;
  last_login_at: string | null;
  is_superadmin?: boolean;
  device_count?: number;
}

export interface AdminNotification {
  id: number;
  title: string;
  body: string;
  sent_at: string;
  recipients_count: number;
  audience: NotificationAudience;
  sent_by_email?: string | null;
}

export interface NotificationAudienceInfo {
  configured: boolean;
  devices: number;
  users: number;
  byPlatform: Array<{ platform: string; devices: number }>;
  byPlan: { free: number | null; basic: number | null; pro: number | null };
}

export interface SendNotificationResult {
  message: string;
  notificationId: number;
  totalTokens: number;
  successCount: number;
  failCount: number;
}

export const adminService = {
  // Check if the current session belongs to a superadmin
  isSuperadmin: async (): Promise<boolean> => {
    try {
      const response = await apiFetch(`${ADMIN_URL}/is-superadmin`);
      if (!response.ok) return false;
      const data = await response.json();
      return data.isSuperadmin === true;
    } catch {
      return false;
    }
  },

  // Register this device's push token
  registerPushToken: async (token: string, platform: string): Promise<void> => {
    const response = await apiFetchJson(`${ADMIN_URL}/push-token`, 'POST', { token, platform });
    if (!response.ok) {
      throw new Error('Failed to register push token');
    }
  },

  // Remove this device's push token (logout / permission revoked)
  removePushToken: async (token: string): Promise<void> => {
    await apiFetchJson(`${ADMIN_URL}/push-token`, 'DELETE', { token });
  },

  // How many devices a notification would reach (superadmin only)
  getNotificationAudience: async (): Promise<NotificationAudienceInfo> => {
    const response = await apiFetch(`${ADMIN_URL}/notifications/audience`);
    if (!response.ok) throw new Error('Failed to fetch audience');
    return response.json();
  },

  // Get sent notifications history (superadmin only)
  getNotifications: async (): Promise<AdminNotification[]> => {
    const response = await apiFetch(`${ADMIN_URL}/notifications`);
    if (!response.ok) throw new Error('Failed to fetch notifications');
    return response.json();
  },

  // Send a notification (superadmin only)
  sendNotification: async (
    title: string,
    body: string,
    audience: NotificationAudience = 'all'
  ): Promise<SendNotificationResult> => {
    const response = await apiFetchJson(`${ADMIN_URL}/notifications/send`, 'POST', { title, body, audience }, {
      timeoutMs: 60000,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to send notification');
    }
    return response.json();
  },

  // Get all users (superadmin only)
  getUsers: async (): Promise<AdminUser[]> => {
    const response = await apiFetch(`${ADMIN_URL}/users`);
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  },

  // Delete a user and all their data (superadmin only)
  deleteUser: async (targetUserId: number): Promise<void> => {
    const response = await apiFetch(`${ADMIN_URL}/users/${targetUserId}`, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to delete user');
    }
  },
};
