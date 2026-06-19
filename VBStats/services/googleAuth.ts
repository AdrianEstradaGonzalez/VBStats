/**
 * Google Sign-In wrapper.
 *
 * Thin, defensive layer over @react-native-google-signin/google-signin so the rest
 * of the app never crashes if the native module isn't installed/linked yet or if the
 * Web client ID hasn't been configured. Both are required for Google Sign-In to work:
 *   1. `npm install @react-native-google-signin/google-signin` + native rebuild
 *   2. Set GOOGLE_WEB_CLIENT_ID in services/config.ts (and the matching backend env)
 *
 * See GOOGLE_SIGNIN_SETUP.md for the full setup guide.
 */

import { GOOGLE_WEB_CLIENT_ID, isGoogleSignInConfigured } from './config';

// Lazy/defensive require so a missing native module doesn't break the JS bundle.
let GoogleSignin: any = null;
let statusCodes: any = null;
let loadError: string | null = null;

function loadModule(): boolean {
  if (GoogleSignin) return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-google-signin/google-signin');
    GoogleSignin = mod.GoogleSignin;
    statusCodes = mod.statusCodes;
    return !!GoogleSignin;
  } catch (e: any) {
    loadError = e?.message || 'Módulo de Google Sign-In no instalado';
    return false;
  }
}

let configured = false;

function ensureConfigured(): boolean {
  if (!isGoogleSignInConfigured()) return false;
  if (!loadModule()) return false;
  if (!configured) {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID.trim(),
      offlineAccess: false,
    });
    configured = true;
  }
  return true;
}

/** True only when both the native module is available and a Web client ID is set. */
export const isGoogleAvailable = (): boolean => isGoogleSignInConfigured() && loadModule();

export class GoogleSignInCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'GoogleSignInCancelled';
  }
}

/**
 * Launches the Google Sign-In flow and returns the idToken to send to the backend.
 * Throws GoogleSignInCancelled if the user dismisses the dialog.
 */
export async function signInWithGoogle(): Promise<string> {
  if (!isGoogleSignInConfigured()) {
    throw new Error('Google Sign-In no está configurado (falta GOOGLE_WEB_CLIENT_ID).');
  }
  if (!ensureConfigured()) {
    throw new Error(loadError || 'Google Sign-In no está disponible en esta build.');
  }

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();

    // Support both newer ({ data: { idToken } }) and older ({ idToken }) shapes
    const idToken: string | undefined = result?.data?.idToken ?? result?.idToken;
    if (!idToken) {
      throw new Error('No se recibió el token de Google.');
    }
    return idToken;
  } catch (error: any) {
    const code = error?.code;
    if (
      statusCodes &&
      (code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS)
    ) {
      throw new GoogleSignInCancelled();
    }
    throw error;
  }
}

/** Best-effort sign-out from the Google session (does not touch the app session). */
export async function signOutFromGoogle(): Promise<void> {
  try {
    if (ensureConfigured()) {
      await GoogleSignin.signOut();
    }
  } catch {
    // ignore
  }
}
