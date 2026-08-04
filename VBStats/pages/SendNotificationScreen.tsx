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
import {
  adminService,
  AdminNotification,
  SendNotificationResult,
  NotificationAudience,
  NotificationAudienceInfo,
} from '../services/adminService';
import CustomAlert from '../components/CustomAlert';
import { notificationService } from '../services/notificationService';
import { useTranslation } from 'react-i18next';

interface SendNotificationScreenProps {
  onBack: () => void;
  userId?: number | null;
}

const AUDIENCES: Array<{ id: NotificationAudience; label: string; icon: string }> = [
  { id: 'all', label: 'Todos', icon: 'account-group' },
  { id: 'free', label: 'Gratis', icon: 'account-outline' },
  { id: 'basic', label: 'Básico', icon: 'account' },
  { id: 'pro', label: 'Pro', icon: 'crown' },
  { id: 'paid', label: 'De pago', icon: 'credit-card-check' },
];

export default function SendNotificationScreen({ onBack }: SendNotificationScreenProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<NotificationAudience>('all');
  const [sending, setSending] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [audienceInfo, setAudienceInfo] = useState<NotificationAudienceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmAlert, setShowConfirmAlert] = useState(false);
  const [showResultAlert, setShowResultAlert] = useState(false);
  const [sendResult, setSendResult] = useState<SendNotificationResult | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  /** Notification pending re-send confirmation. */
  const [resendTarget, setResendTarget] = useState<AdminNotification | null>(null);
  const [diagnostics, setDiagnostics] = useState<{
    moduleAvailable: boolean;
    permission: string;
    tokenRegistered: boolean;
  } | null>(null);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const [data, info] = await Promise.all([
        adminService.getNotifications(),
        adminService.getNotificationAudience().catch(() => null),
      ]);
      setNotifications(data);
      setAudienceInfo(info);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }

    // Why this device may not be receiving anything — the "0 devices" case was
    // impossible to diagnose from inside the app before.
    try {
      const d = await notificationService.getDiagnostics();
      setDiagnostics({
        moduleAvailable: d.moduleAvailable,
        permission: d.permission,
        tokenRegistered: d.tokenRegistered,
      });
    } catch {
      setDiagnostics(null);
    }
  };

  /** Loads a past notification back into the form so it can be tweaked and sent. */
  const handleReuse = (item: AdminNotification) => {
    setTitle(item.title);
    setBody(item.body);
    setAudience(item.audience || 'all');
  };

  /** Sends a past notification again, unchanged. */
  const handleResend = async () => {
    if (!resendTarget) return;
    const target = resendTarget;
    setResendTarget(null);
    setSending(true);
    setSendError(null);

    try {
      const result = await adminService.sendNotification(
        target.title,
        target.body,
        target.audience || 'all'
      );
      setSendResult(result);
      setShowResultAlert(true);
      loadNotifications();
    } catch (error: any) {
      console.error('Error resending notification:', error);
      setSendResult(null);
      setSendError(error?.message || null);
      setShowResultAlert(true);
    } finally {
      setSending(false);
    }
  };

  /** Devices the currently selected audience would reach. */
  const estimatedReach = (): number | null => {
    if (!audienceInfo) return null;
    const plan = audienceInfo.byPlan || { free: 0, basic: 0, pro: 0 };
    switch (audience) {
      case 'free': return Number(plan.free || 0);
      case 'basic': return Number(plan.basic || 0);
      case 'pro': return Number(plan.pro || 0);
      case 'paid': return Number(plan.basic || 0) + Number(plan.pro || 0);
      default: return audienceInfo.devices;
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    setShowConfirmAlert(false);
    setSending(true);
    setSendError(null);

    try {
      const result = await adminService.sendNotification(title.trim(), body.trim(), audience);
      setSendResult(result);
      setShowResultAlert(true);
      setTitle('');
      setBody('');
      loadNotifications();
    } catch (error: any) {
      console.error('Error sending notification:', error);
      setSendResult(null);
      // Surface the real reason (e.g. Firebase not configured) instead of a
      // generic failure message.
      setSendError(error?.message || null);
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
    // Tapping loads it into the form to edit; the button re-sends it as-is.
    <TouchableOpacity
      style={styles.notificationItem}
      onPress={() => handleReuse(item)}
      activeOpacity={0.7}
    >
      <View style={styles.notificationHeader}>
        <Text style={styles.notificationTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.recipientsBadge}>
          <MaterialCommunityIcons name="account-multiple" size={14} color="#3b82f6" />
          <Text style={styles.recipientsText}>{item.recipients_count}</Text>
        </View>
      </View>
      <Text style={styles.notificationBody} numberOfLines={2}>{item.body}</Text>
      <View style={styles.notificationFooter}>
        <Text style={styles.notificationDate}>{formatDate(item.sent_at)}</Text>
        <View style={styles.notificationActions}>
          {item.audience && item.audience !== 'all' && (
            <Text style={styles.audienceTag}>
              {AUDIENCES.find(a => a.id === item.audience)?.label || item.audience}
            </Text>
          )}
          <TouchableOpacity
            style={styles.resendButton}
            onPress={() => setResendTarget(item)}
            disabled={sending}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="send-clock" size={16} color={Colors.primary} />
            <Text style={styles.resendButtonText}>Reenviar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
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

          {audienceInfo && !audienceInfo.configured && (
            <View style={styles.warningBanner}>
              <MaterialCommunityIcons name="alert" size={18} color="#f59e0b" />
              <Text style={styles.warningText}>
                El servidor no tiene credenciales de Firebase. Define FIREBASE_SERVICE_ACCOUNT_BASE64 para poder enviar.
              </Text>
            </View>
          )}

          {/* Why this device might not be receiving anything */}
          {diagnostics && !(diagnostics.moduleAvailable && diagnostics.permission === 'granted' && diagnostics.tokenRegistered) && (
            <View style={styles.warningBanner}>
              <MaterialCommunityIcons name="cellphone-off" size={18} color="#f59e0b" />
              <Text style={styles.warningText}>
                {!diagnostics.moduleAvailable
                  ? 'Este dispositivo no tiene Firebase disponible: la app se compiló sin google-services.json.'
                  : diagnostics.permission !== 'granted'
                  ? 'Este dispositivo no tiene permiso de notificaciones. Actívalo en los ajustes del teléfono.'
                  : 'Este dispositivo aún no ha registrado su token. Cierra sesión y vuelve a entrar.'}
              </Text>
            </View>
          )}

          {audienceInfo && audienceInfo.devices === 0 && (
            <View style={styles.warningBanner}>
              <MaterialCommunityIcons name="information" size={18} color="#f59e0b" />
              <Text style={styles.warningText}>
                No hay ningún dispositivo registrado todavía. Los usuarios deben abrir la app y aceptar las notificaciones.
              </Text>
            </View>
          )}

          {/* Audience selector */}
          <View style={styles.audienceRow}>
            {AUDIENCES.map(option => (
              <TouchableOpacity
                key={option.id}
                style={[styles.audienceChip, audience === option.id && styles.audienceChipActive]}
                onPress={() => setAudience(option.id)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={option.icon}
                  size={14}
                  color={audience === option.id ? '#fff' : Colors.textSecondary}
                />
                <Text style={[styles.audienceChipText, audience === option.id && styles.audienceChipTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {estimatedReach() !== null && (
            <Text style={styles.reachText}>
              Llegará a aproximadamente {estimatedReach()} dispositivo(s)
            </Text>
          )}

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

      {/* Confirm re-send */}
      <CustomAlert
        visible={!!resendTarget}
        title="Reenviar notificación"
        message={resendTarget ? `Se enviará de nuevo "${resendTarget.title}" a: ${AUDIENCES.find(a => a.id === (resendTarget.audience || 'all'))?.label || 'Todos'}.` : ''}
        type="warning"
        icon={<MaterialCommunityIcons name="send-clock" size={32} color="#f59e0b" />}
        buttons={[
          {
            text: t('common.cancel'),
            onPress: () => setResendTarget(null),
            style: 'cancel',
          },
          {
            text: 'Reenviar',
            onPress: handleResend,
            style: 'default',
          },
        ]}
        onClose={() => setResendTarget(null)}
      />

      {/* Result Alert */}
      <CustomAlert
        visible={showResultAlert}
        title={sendResult ? t('admin.notificationSent') : t('common.error')}
        message={
          sendResult
            ? t('admin.notificationSentMessage', { count: sendResult.successCount })
            : sendError || t('admin.notificationSendError')
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
  notificationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  audienceTag: {
    fontSize: FontSizes.xs,
    color: Colors.primary,
    fontWeight: '600',
  },
  notificationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  resendButtonText: {
    fontSize: FontSizes.xs,
    color: Colors.primary,
    fontWeight: '600',
  },
  audienceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  audienceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  audienceChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  audienceChipText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  audienceChipTextActive: {
    color: '#fff',
  },
  reachText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: '#f59e0b18',
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: FontSizes.xs,
    color: '#f59e0b',
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
});
