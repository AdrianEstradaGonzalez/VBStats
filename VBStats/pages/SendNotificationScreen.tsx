/**
 * SendNotificationScreen - Allows superadmin to compose and send push notifications
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows, SAFE_AREA_TOP } from '../styles';
import { adminService, AdminNotification, SendNotificationResult } from '../services/adminService';
import CustomAlert from '../components/CustomAlert';
import { useTranslation } from 'react-i18next';

interface SendNotificationScreenProps {
  onBack: () => void;
  userId: number | null;
}

export default function SendNotificationScreen({ onBack, userId }: SendNotificationScreenProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirmAlert, setShowConfirmAlert] = useState(false);
  const [showResultAlert, setShowResultAlert] = useState(false);
  const [sendResult, setSendResult] = useState<SendNotificationResult | null>(null);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    if (!userId) return;
    try {
      const data = await adminService.getNotifications(userId);
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!userId || !title.trim() || !body.trim()) return;
    setShowConfirmAlert(false);
    setSending(true);

    try {
      const result = await adminService.sendNotification(userId, title.trim(), body.trim());
      setSendResult(result);
      setShowResultAlert(true);
      setTitle('');
      setBody('');
      loadNotifications();
    } catch (error) {
      console.error('Error sending notification:', error);
      setSendResult(null);
      setShowResultAlert(true);
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderNotification = ({ item }: { item: AdminNotification }) => (
    <View style={styles.notificationItem}>
      <View style={styles.notificationHeader}>
        <Text style={styles.notificationTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.recipientsBadge}>
          <MaterialCommunityIcons name="account-multiple" size={14} color="#3b82f6" />
          <Text style={styles.recipientsText}>{item.recipients_count}</Text>
        </View>
      </View>
      <Text style={styles.notificationBody} numberOfLines={2}>{item.body}</Text>
      <Text style={styles.notificationDate}>{formatDate(item.sent_at)}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.sendNotification')}</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.content}>
        {/* Compose Form */}
        <View style={styles.composeSection}>
          <Text style={styles.sectionTitle}>{t('admin.composeNotification')}</Text>

          <TextInput
            style={styles.input}
            placeholder={t('admin.notificationTitle')}
            placeholderTextColor={Colors.textTertiary}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          <TextInput
            style={[styles.input, styles.bodyInput]}
            placeholder={t('admin.notificationBody')}
            placeholderTextColor={Colors.textTertiary}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.sendButton, (!title.trim() || !body.trim() || sending) && styles.sendButtonDisabled]}
            onPress={() => setShowConfirmAlert(true)}
            disabled={!title.trim() || !body.trim() || sending}
            activeOpacity={0.7}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="send" size={20} color="#fff" />
                <Text style={styles.sendButtonText}>{t('admin.send')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* History */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>{t('admin.notificationHistory')}</Text>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.lg }} />
          ) : notifications.length === 0 ? (
            <Text style={styles.emptyText}>{t('admin.noNotifications')}</Text>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderNotification}
              contentContainerStyle={{ paddingBottom: Spacing.xxl }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>

      {/* Confirm Send Alert */}
      <CustomAlert
        visible={showConfirmAlert}
        title={t('admin.confirmSend')}
        message={t('admin.confirmSendMessage')}
        type="warning"
        icon={<MaterialCommunityIcons name="bell-ring" size={32} color="#f59e0b" />}
        buttons={[
          {
            text: t('common.cancel'),
            onPress: () => setShowConfirmAlert(false),
            style: 'cancel',
          },
          {
            text: t('admin.send'),
            onPress: handleSend,
            style: 'default',
          },
        ]}
        onClose={() => setShowConfirmAlert(false)}
      />

      {/* Result Alert */}
      <CustomAlert
        visible={showResultAlert}
        title={sendResult ? t('admin.notificationSent') : t('common.error')}
        message={
          sendResult
            ? t('admin.notificationSentMessage', { count: sendResult.successCount })
            : t('admin.notificationSendError')
        }
        type={sendResult ? 'success' : 'warning'}
        icon={
          <MaterialCommunityIcons
            name={sendResult ? 'check-circle' : 'alert-circle'}
            size={32}
            color={sendResult ? '#22c55e' : Colors.error}
          />
        }
        buttons={[
          {
            text: t('common.understood'),
            onPress: () => setShowResultAlert(false),
            style: 'default',
          },
        ]}
        onClose={() => setShowResultAlert(false)}
      />
    </KeyboardAvoidingView>
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
  composeSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSizes.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bodyInput: {
    minHeight: 100,
    maxHeight: 150,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  historySection: {
    flex: 1,
  },
  notificationItem: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  recipientsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f620',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  recipientsText: {
    fontSize: FontSizes.xs,
    color: '#3b82f6',
    fontWeight: '600',
  },
  notificationBody: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  notificationDate: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
});
