/**
 * Tests for the push notification service.
 *
 * Regression these exist for: the service used the pre-v22 namespaced Firebase API
 * (`require('@react-native-firebase/messaging').default()`). In v26 that default
 * export does not exist, so the call evaluated to `undefined`, the module looked
 * unavailable, the OS permission dialog was never shown, no token was registered,
 * and every broadcast reported 0 devices — all without a single error in the logs.
 */

import * as fs from 'fs';
import * as path from 'path';

const registerPushToken = jest.fn().mockResolvedValue(undefined);
const removePushToken = jest.fn().mockResolvedValue(undefined);

jest.mock('../../services/adminService', () => ({
  adminService: {
    registerPushToken: (...args: unknown[]) => registerPushToken(...args),
    removePushToken: (...args: unknown[]) => removePushToken(...args),
  },
}));

/** Minimal stand-in for the v26 modular messaging API. */
const makeModularMock = (overrides: Record<string, unknown> = {}) => {
  const instance = { __instance: true };
  return {
    getMessaging: jest.fn(() => instance),
    getToken: jest.fn().mockResolvedValue('fcm-token-123'),
    requestPermission: jest.fn().mockResolvedValue(1),
    hasPermission: jest.fn().mockResolvedValue(1),
    onTokenRefresh: jest.fn(() => () => {}),
    onMessage: jest.fn(() => () => {}),
    registerDeviceForRemoteMessages: jest.fn().mockResolvedValue(undefined),
    isDeviceRegisteredForRemoteMessages: jest.fn(() => true),
    deleteToken: jest.fn().mockResolvedValue(undefined),
    AuthorizationStatus: { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
    ...overrides,
  };
};

beforeEach(() => {
  jest.resetModules();
  registerPushToken.mockClear();
  removePushToken.mockClear();
});

describe('installed Firebase messaging package', () => {
  // Guards the assumption the service is built on. If a future upgrade brings the
  // namespaced API back, or drops a function we call, this fails loudly here.
  const distPath = path.join(
    __dirname, '..', '..',
    'node_modules', '@react-native-firebase', 'messaging', 'dist', 'module', 'index.js'
  );

  test('exposes the modular functions the service depends on', () => {
    const src = fs.readFileSync(distPath, 'utf8');
    for (const fn of [
      'getMessaging', 'getToken', 'requestPermission', 'hasPermission',
      'onTokenRefresh', 'onMessage', 'registerDeviceForRemoteMessages',
      'isDeviceRegisteredForRemoteMessages',
    ]) {
      expect(src).toMatch(new RegExp(`export function ${fn}\\b`));
    }
  });

  test('has no default export, which is why the namespaced call broke', () => {
    const src = fs.readFileSync(distPath, 'utf8');
    expect(src).not.toMatch(/export default/);
  });
});

describe('requestPermissionAndRegister', () => {
  test('registers the device token when permission is granted', async () => {
    jest.doMock('@react-native-firebase/messaging', () => makeModularMock(), { virtual: true });
    const { notificationService } = require('../../services/notificationService');

    const status = await notificationService.requestPermissionAndRegister();

    expect(status).toBe('granted');
    expect(registerPushToken).toHaveBeenCalledWith('fcm-token-123', expect.any(String));
  });

  test('does not register when the user refuses', async () => {
    jest.doMock(
      '@react-native-firebase/messaging',
      () => makeModularMock({ requestPermission: jest.fn().mockResolvedValue(0) }),
      { virtual: true }
    );
    const { notificationService } = require('../../services/notificationService');

    const status = await notificationService.requestPermissionAndRegister();

    expect(status).toBe('denied');
    expect(registerPushToken).not.toHaveBeenCalled();
  });

  test('reports unavailable — and does NOT mark as asked — when the module lacks the modular API', async () => {
    // Exactly the broken situation: a module object with no getMessaging.
    jest.doMock('@react-native-firebase/messaging', () => ({ somethingElse: true }), { virtual: true });
    const { notificationService } = require('../../services/notificationService');

    const status = await notificationService.requestPermissionAndRegister();

    expect(status).toBe('unavailable');
    expect(registerPushToken).not.toHaveBeenCalled();
    // Critical: the user must still be asked once the build is fixed.
    expect(await notificationService.hasBeenPrompted()).toBe(false);
  });
});

describe('syncTokenIfAlreadyGranted', () => {
  test('registers silently when permission is already granted', async () => {
    jest.doMock('@react-native-firebase/messaging', () => makeModularMock(), { virtual: true });
    const { notificationService } = require('../../services/notificationService');

    await notificationService.syncTokenIfAlreadyGranted();

    expect(registerPushToken).toHaveBeenCalledWith('fcm-token-123', expect.any(String));
  });

  test('does nothing when permission was refused', async () => {
    jest.doMock(
      '@react-native-firebase/messaging',
      () => makeModularMock({ hasPermission: jest.fn().mockResolvedValue(0) }),
      { virtual: true }
    );
    const { notificationService } = require('../../services/notificationService');

    await notificationService.syncTokenIfAlreadyGranted();

    expect(registerPushToken).not.toHaveBeenCalled();
  });
});

describe('getDiagnostics', () => {
  test('reports the module as unavailable when the modular API is missing', async () => {
    jest.doMock('@react-native-firebase/messaging', () => ({}), { virtual: true });
    const { notificationService } = require('../../services/notificationService');

    const d = await notificationService.getDiagnostics();

    expect(d.moduleAvailable).toBe(false);
    expect(d.tokenRegistered).toBe(false);
  });
});
