/**
 * Admin Service - API calls for superadmin features
 */

import { API_BASE_URL } from './api';

const ADMIN_URL = `${API_BASE_URL}/admin`;

export interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  subscription_type: 'free' | 'basic' | 'pro';
  subscription_expires_at: string | null;
  auto_renew: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface AdminNotification {
  id: number;
  title: string;
  body: string;
  sent_at: string;
  recipients_count: number;
}

export interface SendNotificationResult {
  message: string;
  notificationId: number;
  totalTokens: number;
  successCount: number;
  failCount: number;
}

export const adminService = {
  // Check if the current user is a superadmin
  isSuperadmin: async (userId: number): Promise<boolean> => {
    try {
      const response = await fetch(`${ADMIN_URL}/is-superadmin?userId=${userId}`);
      if (!response.ok) return false;
      const data = await response.json();
      return data.isSuperadmin === true;
    } catch {
      return false;
    }
  },

  // Register push token for notifications
  registerPushToken: async (userId: number, token: string, platform: string): Promise<void> => {
    await fetch(`${ADMIN_URL}/push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token, platform }),
    });
  },

  // Get all notifications (superadmin only)
  getNotifications: async (userId: number): Promise<AdminNotification[]> => {
    const response = await fetch(`${ADMIN_URL}/notifications`, {
      headers: { 'x-user-id': String(userId) },
    });
    if (!response.ok) throw new Error('Failed to fetch notifications');
    return response.json();
  },

  // Send notification to all users (superadmin only)
  sendNotification: async (userId: number, title: string, body: string): Promise<SendNotificationResult> => {
    const response = await fetch(`${ADMIN_URL}/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': String(userId),
      },
      body: JSON.stringify({ title, body }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send notification');
    }
    return response.json();
  },

  // Get all users (superadmin only)
  getUsers: async (userId: number): Promise<AdminUser[]> => {
    const response = await fetch(`${ADMIN_URL}/users`, {
      headers: { 'x-user-id': String(userId) },
    });
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  },

  // Delete a user and all their data (superadmin only)
  deleteUser: async (adminId: number, targetUserId: number): Promise<void> => {
    const response = await fetch(`${ADMIN_URL}/users/${targetUserId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': String(adminId) },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete user');
    }
  },
};
