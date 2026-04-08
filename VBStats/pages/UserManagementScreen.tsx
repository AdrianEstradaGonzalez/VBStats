/**
 * UserManagementScreen - View all app users with subscription details
 * Superadmin only. Sorted by last name.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows, SAFE_AREA_TOP } from '../styles';
import { adminService, AdminUser } from '../services/adminService';
import { useTranslation } from 'react-i18next';

interface UserManagementScreenProps {
  onBack: () => void;
  userId: number | null;
}

export default function UserManagementScreen({ onBack, userId }: UserManagementScreenProps) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    if (!userId) return;
    try {
      const data = await adminService.getUsers(userId);
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sort users by last name (surname) extracted from name field
  const sortedUsers = useMemo(() => {
    let filtered = users;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = users.filter(
        u =>
          (u.name && u.name.toLowerCase().includes(q)) ||
          u.email.toLowerCase().includes(q)
      );
    }

    return [...filtered].sort((a, b) => {
      const getSurname = (name: string | null) => {
        if (!name) return '';
        const parts = name.trim().split(/\s+/);
        return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : parts[0].toLowerCase();
      };
      const surnameA = getSurname(a.name);
      const surnameB = getSurname(b.name);
      if (surnameA === surnameB) {
        return (a.name || a.email).localeCompare(b.name || b.email);
      }
      return surnameA.localeCompare(surnameB);
    });
  }, [users, searchQuery]);

  const getPlanBadge = (type: string) => {
    switch (type) {
      case 'pro':
        return { text: 'PRO', color: '#f59e0b', bg: '#f59e0b20' };
      case 'basic':
        return { text: 'BASIC', color: '#3b82f6', bg: '#3b82f620' };
      default:
        return { text: 'FREE', color: Colors.textTertiary, bg: Colors.textTertiary + '20' };
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return t('admin.never');
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderUser = ({ item }: { item: AdminUser }) => {
    const badge = getPlanBadge(item.subscription_type);
    const isExpired = item.subscription_expires_at
      ? new Date(item.subscription_expires_at) < new Date()
      : false;

    return (
      <View style={styles.userCard}>
        {/* Row 1: Name + Plan badge */}
        <View style={styles.userHeaderRow}>
          <View style={styles.userIdentity}>
            <View style={styles.avatarSmall}>
              <MaterialCommunityIcons name="account" size={20} color={Colors.primary} />
            </View>
            <View style={styles.userNameContainer}>
              <Text style={styles.userName} numberOfLines={1}>
                {item.name || item.email.split('@')[0]}
              </Text>
              <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
            </View>
          </View>
          <View style={[styles.planBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.planBadgeText, { color: badge.color }]}>{badge.text}</Text>
          </View>
        </View>

        {/* Row 2: Details */}
        <View style={styles.userDetailsRow}>
          <View style={styles.detailItem}>
            <MaterialCommunityIcons name="calendar-clock" size={14} color={Colors.textTertiary} />
            <Text style={styles.detailLabel}>{t('admin.expires')}:</Text>
            <Text style={[styles.detailValue, isExpired && styles.expiredText]}>
              {formatDate(item.subscription_expires_at)}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <MaterialCommunityIcons name="login" size={14} color={Colors.textTertiary} />
            <Text style={styles.detailLabel}>{t('admin.lastLogin')}:</Text>
            <Text style={styles.detailValue}>
              {formatDateTime(item.last_login_at)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.userManagement')}</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.content}>
        {/* Stats bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{users.length}</Text>
            <Text style={styles.statLabel}>{t('admin.totalUsers')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#f59e0b' }]}>
              {users.filter(u => u.subscription_type === 'pro').length}
            </Text>
            <Text style={styles.statLabel}>PRO</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#3b82f6' }]}>
              {users.filter(u => u.subscription_type === 'basic').length}
            </Text>
            <Text style={styles.statLabel}>BASIC</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: Colors.textTertiary }]}>
              {users.filter(u => u.subscription_type === 'free').length}
            </Text>
            <Text style={styles.statLabel}>FREE</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('admin.searchUsers')}
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Users list */}
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
        ) : (
          <FlatList
            data={sortedUsers}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderUser}
            contentContainerStyle={{ paddingBottom: Spacing.xxl }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>{t('admin.noUsersFound')}</Text>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: SAFE_AREA_TOP + Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSizes.md,
    paddingVertical: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  userCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  userHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  userIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userNameContainer: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  userName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  userEmail: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  planBadge: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  planBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
  },
  userDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  detailValue: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  expiredText: {
    color: Colors.error,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
});
